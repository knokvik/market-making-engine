from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set

from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.inventory import InventoryManager, PnLSnapshot
from mm_engine.order_book import OrderBook
from mm_engine.performance import PerformanceSummary, summarize_performance
from mm_engine.simulation.config import SimulationConfig
from mm_engine.simulation.latency import QuoteLatencyQueue
from mm_engine.strategy.base import QuotingStrategy
from mm_engine.strategy.symmetric import SymmetricQuoter
from mm_engine.types import Fill, Side


@dataclass
class BacktestResult:
    pnl_curve: List[PnLSnapshot] = field(default_factory=list)
    fills: List[Fill] = field(default_factory=list)
    summary: Optional[PerformanceSummary] = None


class BacktestEngine:
    """Replay market events and run a quoting strategy against the live book."""

    def __init__(
        self,
        *,
        strategy: Optional[QuotingStrategy] = None,
        simulation: Optional[SimulationConfig] = None,
        our_order_id_start: int = 10_000_000,
    ) -> None:
        self.book = OrderBook()
        self.strategy = strategy or SymmetricQuoter()
        self.simulation = simulation or SimulationConfig()
        self.inventory = InventoryManager()
        self.inventory._cost_config = self.simulation.costs
        self._latency_queue = QuoteLatencyQueue()
        self._our_order_id = our_order_id_start
        self._our_orders: Set[int] = set()
        self._active_quotes: Dict[Side, int] = {}

    def run(self, events: Iterable[MarketEvent]) -> BacktestResult:
        event_list = list(events)
        self._configure_strategy_session(event_list)

        pnl_curve: List[PnLSnapshot] = []
        our_fills: List[Fill] = []

        for event in event_list:
            quote_fills = self._activate_pending_quotes(event.timestamp)
            for fill in quote_fills:
                our_fills.append(fill)
                self._record_our_fill(fill)

            market_fills = self._apply_market_event(event)
            self._process_market_fills(market_fills)

            self._notify_strategy(event)
            if self.strategy.should_requote(event, self.book):
                scheduled_fills = self._schedule_quotes(event.timestamp)
                for fill in scheduled_fills:
                    our_fills.append(fill)
                    self._record_our_fill(fill)

            snapshot = self._snapshot(event.timestamp)
            if snapshot is not None:
                pnl_curve.append(snapshot)

        quote_fills = self._activate_pending_quotes(event_list[-1].timestamp if event_list else 0)
        for fill in quote_fills:
            our_fills.append(fill)
            self._record_our_fill(fill)

        summary = summarize_performance(pnl_curve, self.inventory.state)
        return BacktestResult(pnl_curve=pnl_curve, fills=our_fills, summary=summary)

    def _configure_strategy_session(self, events: List[MarketEvent]) -> None:
        if not events:
            return
        configure_session = getattr(self.strategy, "configure_session", None)
        if callable(configure_session):
            configure_session(events[0].timestamp, events[-1].timestamp)

    def _notify_strategy(self, event: MarketEvent) -> None:
        note_timestamp = getattr(self.strategy, "note_timestamp", None)
        if callable(note_timestamp):
            note_timestamp(event.timestamp)

    def _apply_market_event(self, event: MarketEvent) -> List[Fill]:
        if event.event_type is EventType.ADD:
            assert event.side is not None
            assert event.price is not None
            assert event.quantity is not None
            _, fills = self.book.add_limit_order(
                event.side,
                event.price,
                event.quantity,
                order_id=event.order_id,
                timestamp=event.timestamp,
            )
            return fills

        if event.event_type is EventType.CANCEL:
            self.book.cancel_order(event.order_id)
            return []

        if event.event_type is EventType.PARTIAL_CANCEL:
            assert event.quantity is not None
            self.book.reduce_order(event.order_id, event.quantity)
            return []

        if event.event_type is EventType.EXECUTION:
            assert event.quantity is not None
            self.book.reduce_order(event.order_id, event.quantity)
            return []

        return []

    def _process_market_fills(self, fills: List[Fill]) -> None:
        for fill in fills:
            if fill.maker_order_id in self._our_orders:
                self._record_our_fill(fill)

    def _record_our_fill(self, fill: Fill) -> None:
        our_id = None
        if fill.maker_order_id in self._our_orders:
            our_id = fill.maker_order_id
        elif fill.taker_order_id in self._our_orders:
            our_id = fill.taker_order_id
        if our_id is None:
            return
        self.inventory.on_fill(fill, our_id)
        if fill.maker_order_id in self._our_orders and fill.maker_order_id not in self.book._order_index:
            self._our_orders.discard(fill.maker_order_id)
            for side, order_id in list(self._active_quotes.items()):
                if order_id == fill.maker_order_id:
                    del self._active_quotes[side]
        if fill.taker_order_id in self._our_orders and fill.taker_order_id not in self.book._order_index:
            self._our_orders.discard(fill.taker_order_id)
            for side, order_id in list(self._active_quotes.items()):
                if order_id == fill.taker_order_id:
                    del self._active_quotes[side]

    def _schedule_quotes(self, timestamp: int) -> List[Fill]:
        quote = self.strategy.compute_quote(self.book, self.inventory.position)
        self._cancel_active_quotes()
        self._latency_queue.clear()

        if quote is None:
            return []

        latency = self.simulation.quote_latency_ns
        if latency <= 0:
            return self._post_quote_pair(quote, timestamp)

        activate_at = timestamp + latency
        fills: List[Fill] = []
        if self.strategy.bid_allowed(self.inventory.position):
            self._latency_queue.schedule(
                activate_at=activate_at,
                side=Side.BID,
                price=quote.bid_price,
                size=quote.quote_size,
            )
        if self.strategy.ask_allowed(self.inventory.position):
            self._latency_queue.schedule(
                activate_at=activate_at,
                side=Side.ASK,
                price=quote.ask_price,
                size=quote.quote_size,
            )
        return fills

    def _activate_pending_quotes(self, timestamp: int) -> List[Fill]:
        fills: List[Fill] = []
        for pending in self._latency_queue.pop_ready(timestamp):
            fills.extend(
                self._replace_quote(
                    pending.side,
                    pending.price,
                    pending.size,
                    timestamp,
                )
            )
        return fills

    def _post_quote_pair(self, quote, timestamp: int) -> List[Fill]:
        fills: List[Fill] = []
        fills.extend(self._replace_quote(Side.BID, quote.bid_price, quote.quote_size, timestamp))
        fills.extend(self._replace_quote(Side.ASK, quote.ask_price, quote.quote_size, timestamp))
        return fills

    def _replace_quote(self, side: Side, price: float, size: int, timestamp: int) -> List[Fill]:
        if side is Side.BID and not self.strategy.bid_allowed(self.inventory.position):
            return self._cancel_side(side)
        if side is Side.ASK and not self.strategy.ask_allowed(self.inventory.position):
            return self._cancel_side(side)

        if side in self._active_quotes:
            self.book.cancel_order(self._active_quotes[side])
            del self._active_quotes[side]

        order_id = self._next_order_id()
        _, fills = self.book.add_limit_order(
            side,
            price,
            size,
            order_id=order_id,
            timestamp=timestamp,
        )
        if order_id in self.book._order_index:
            self._our_orders.add(order_id)
            self._active_quotes[side] = order_id
        return fills

    def _cancel_side(self, side: Side) -> List[Fill]:
        if side in self._active_quotes:
            self.book.cancel_order(self._active_quotes[side])
            self._our_orders.discard(self._active_quotes[side])
            del self._active_quotes[side]
        return []

    def _cancel_active_quotes(self) -> None:
        for side in list(self._active_quotes):
            self._cancel_side(side)

    def _snapshot(self, timestamp: int) -> Optional[PnLSnapshot]:
        mid = self.book.mid_price
        if mid is None:
            return None
        return PnLSnapshot(
            timestamp=timestamp,
            mid_price=mid,
            position=self.inventory.position,
            cash=self.inventory.state.cash,
            realized_pnl=self.inventory.state.realized_pnl,
            mark_to_market_pnl=self.inventory.mark_to_market(mid),
            unrealized_pnl=self.inventory.unrealized_pnl(mid),
        )

    def _next_order_id(self) -> int:
        order_id = self._our_order_id
        self._our_order_id += 1
        return order_id