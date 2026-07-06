from __future__ import annotations

import asyncio
import random
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set

from mm_engine.backtest.engine import BacktestEngine
from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.feed.live.base import LiveBookSnapshot, create_live_adapter
from mm_engine.inventory import PnLSnapshot
from mm_engine.performance import summarize_performance
from mm_engine.replay.session import ReplayConfig, ReplayFrame, ReplayController
from mm_engine.replay.telemetry import (
    build_book_ladder,
    build_latency_breakdown,
    build_pnl_decomposition,
    build_queue_analytics,
    build_quote_decision,
    format_replay_timestamp,
    generate_ai_summary,
)
from mm_engine.types import Fill, Side

OUR_ORDER_FLOOR = 10_000_000

_feed_bg_loop: Optional[asyncio.AbstractEventLoop] = None
_feed_bg_thread: Optional[threading.Thread] = None


def _background_feed_loop() -> asyncio.AbstractEventLoop:
    global _feed_bg_loop, _feed_bg_thread
    if _feed_bg_loop is not None and _feed_bg_loop.is_running():
        return _feed_bg_loop
    loop = asyncio.new_event_loop()

    def _runner() -> None:
        asyncio.set_event_loop(loop)
        loop.run_forever()

    _feed_bg_thread = threading.Thread(target=_runner, daemon=True, name="mm-live-feed-loop")
    _feed_bg_thread.start()
    _feed_bg_loop = loop
    return loop


@dataclass
class AlgoState:
    active: bool = False
    strategy: str = "avellaneda_stoikov"
    quotes_posted: int = 0
    fills: int = 0
    win_rate: float = 0.0


class LivePaperController:
    """Live market data + simulated paper execution."""

    def __init__(self, config: ReplayConfig, *, root: Optional[Path] = None) -> None:
        self.config = config
        self.root = root or Path(__file__).resolve().parents[3]
        self._engine: Optional[BacktestEngine] = None
        self._fills: List[Fill] = []
        self._fill_pnls: List[float] = []
        self._pnl_curve: List[PnLSnapshot] = []
        self._quote_trail: List[Dict[str, float]] = []
        self._log_events: List[Dict[str, str]] = []
        self._max_abs_inventory = 0
        self._winning_fills = 0
        self._quote_updates = 0
        self._market_order_id = 1
        self._last_snapshot: Optional[LiveBookSnapshot] = None
        self._last_step_latency_ms = 0.0
        self._events_per_sec = 0.0
        self._adapter = None
        self._feed_task: Optional[asyncio.Task] = None
        self._feed_future: Optional[asyncio.Future] = None
        self._feed_should_run = False
        self._connected = False
        self._ping_ms = 0.0
        self._connection_quality = "disconnected"
        self._packet_loss_pct = 0.0
        self._algo = AlgoState(strategy=config.strategy)
        self._frame_dirty = True
        self._cached_frame: Optional[ReplayFrame] = None
        self._tick_seq = 0
        self._paper_sim_ticks = 0
        self._last_paper_sim_ns = 0
        self._replay_helper = ReplayController(config, root=self.root, enable_shadows=False)

    def _build_engine(self) -> BacktestEngine:
        return self._replay_helper._build_engine()

    def reset(self) -> ReplayFrame:
        self.stop_feed()
        self._engine = self._build_engine()
        self._fills = []
        self._fill_pnls = []
        self._pnl_curve = []
        self._quote_trail = []
        self._log_events = []
        self._max_abs_inventory = 0
        self._winning_fills = 0
        self._quote_updates = 0
        self._market_order_id = 1
        self._last_snapshot = None
        self._paper_sim_ticks = 0
        self._last_paper_sim_ns = 0
        self._algo = AlgoState(active=self.config.auto_trade, strategy=self.config.strategy)
        self._frame_dirty = True
        self._append_log("system", "Paper session reset", "info")
        return self.current_frame()

    def set_auto_trade(self, active: bool) -> None:
        self.config.auto_trade = active
        self._algo.active = active
        self._frame_dirty = True

    def apply_config(self, config: ReplayConfig) -> ReplayFrame:
        was_running = self._feed_task is not None and not self._feed_task.done()
        self.stop_feed()
        self.config = config
        self.reset()
        if config.feed_type in ("live", "paper_trading"):
            self.start_feed()
        return self.current_frame()

    def seed_initial_quote(self) -> None:
        """Prime the book so the first websocket frame already has a live mid."""
        sym = self.config.symbol
        if not sym:
            return
        try:
            if self.config.asset_class == "stock":
                from mm_engine.feed.live.yahoo import fetch_yahoo_quote

                quote = fetch_yahoo_quote(sym)
                if quote is None:
                    return
                bid, ask, mid = quote.bid, quote.ask, quote.mid
                exchange = self.config.exchange or "Alpaca"
            else:
                import urllib.request

                url = f"https://api.binance.com/api/v3/ticker/bookTicker?symbol={sym.upper()}"
                req = urllib.request.Request(url, headers={"User-Agent": "mm-engine/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    import json

                    data = json.loads(resp.read().decode())
                bid = float(data.get("bidPrice") or 0)
                ask = float(data.get("askPrice") or 0)
                if bid <= 0 or ask <= 0:
                    return
                mid = (bid + ask) / 2.0
                exchange = self.config.exchange or "Binance"

            bids = [(bid, 100.0)] + [(bid - i * 0.01, 50.0) for i in range(1, 8)]
            asks = [(ask, 100.0)] + [(ask + i * 0.01, 50.0) for i in range(1, 8)]
            snap = LiveBookSnapshot(
                timestamp_ns=time.time_ns(),
                symbol=sym.upper(),
                exchange=exchange,
                bids=bids,
                asks=asks,
                last_price=mid,
                last_qty=1.0,
                last_side="buy",
            )
            self._connected = True
            self._connection_quality = "good"
            self._on_snapshot(snap)
        except Exception:
            pass

    def start_feed(self) -> None:
        self._feed_should_run = True
        if (self._feed_task and not self._feed_task.done()) or (
            self._feed_future and not self._feed_future.done()
        ):
            return
        try:
            loop = asyncio.get_running_loop()
            self._feed_task = loop.create_task(self._run_feed())
            return
        except RuntimeError:
            pass
        bg_loop = _background_feed_loop()
        self._feed_future = asyncio.run_coroutine_threadsafe(self._run_feed(), bg_loop)

    def stop_feed(self) -> None:
        self._feed_should_run = False
        if self._feed_task and not self._feed_task.done():
            self._feed_task.cancel()
        if self._feed_future and not self._feed_future.done():
            self._feed_future.cancel()
        self._feed_task = None
        self._feed_future = None
        self._connected = False

    async def _run_feed(self) -> None:
        backoff = 1.0
        while self._feed_should_run:
            adapter = create_live_adapter(
                asset_class=self.config.asset_class,
                symbol=self.config.symbol,
                exchange=self.config.exchange,
            )
            self._adapter = adapter
            try:
                await adapter.connect()
                self._connected = True
                self._connection_quality = adapter.health.connection_quality
                prefetch = getattr(adapter, "prefetch_snapshot", None)
                if prefetch is not None:
                    seed = await prefetch()
                    if seed is not None:
                        self._on_snapshot(seed)
                        self._frame_dirty = True

                async for snap in adapter.snapshots():
                    if not self._feed_should_run:
                        break
                    self._on_snapshot(snap)
                    self._frame_dirty = True
                    self._connected = adapter.health.connected
                    self._ping_ms = adapter.health.ping_ms
                    self._events_per_sec = adapter.health.events_per_sec
                    self._connection_quality = adapter.health.connection_quality
                backoff = 1.0
            except asyncio.CancelledError:
                break
            except Exception as exc:
                self._connection_quality = "critical"
                self._append_log("feed", f"Feed error: {exc}", "danger")
            finally:
                await adapter.disconnect()

            if not self._feed_should_run:
                break
            self._connected = False
            self._connection_quality = "reconnecting"
            self._frame_dirty = True
            self._append_log("feed", f"Reconnecting {self.config.symbol} feed…", "warning")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.5, 8.0)

    def _on_snapshot(self, snap: LiveBookSnapshot) -> None:
        if self._engine is None:
            self._engine = self._build_engine()
        engine = self._engine
        started = time.perf_counter()

        keep = set(engine._our_orders) | set(engine._active_quotes.values())
        engine.book.clear_orders_except(keep)

        ts = snap.timestamp_ns
        for price, qty in snap.bids:
            oid = self._next_market_order_id()
            engine.book.add_limit_order(
                Side.BID, price, max(1, int(qty)), order_id=oid, timestamp=ts
            )
        for price, qty in snap.asks:
            oid = self._next_market_order_id()
            engine.book.add_limit_order(
                Side.ASK, price, max(1, int(qty)), order_id=oid, timestamp=ts
            )

        if snap.last_price and snap.last_side and self.config.auto_trade:
            self._maybe_simulate_aggressive_fill(engine, snap)

        tick_event = MarketEvent(timestamp=ts, event_type=EventType.ADD, order_id=0)
        if self.config.auto_trade:
            need_quotes = not engine._active_quotes or engine.strategy.should_requote(
                tick_event, engine.book
            )
            if need_quotes:
                fills = engine._schedule_quotes(ts)
                for fill in fills:
                    self._record_fill(fill, engine)
                self._quote_updates += 1
            self._simulate_paper_taker_flow(engine, ts)

        self._record_quote_trail(engine, ts)
        snapshot = engine._snapshot(ts)
        if snapshot:
            self._pnl_curve.append(snapshot)
            if len(self._pnl_curve) > 500:
                self._pnl_curve.pop(0)

        self._last_snapshot = snap
        elapsed = time.perf_counter() - started
        self._last_step_latency_ms = elapsed * 1000
        self._tick_seq += 1
        self._frame_dirty = True

    def _next_market_order_id(self) -> int:
        oid = self._market_order_id
        self._market_order_id += 1
        if self._market_order_id >= OUR_ORDER_FLOOR - 1:
            self._market_order_id = 1
        return oid

    def _maybe_simulate_aggressive_fill(self, engine: BacktestEngine, snap: LiveBookSnapshot) -> None:
        """Simulate taker flow crossing our quotes."""
        if snap.last_price is None:
            return
        for side, order_id in list(engine._active_quotes.items()):
            order = engine.book.get_order(order_id)
            if order is None:
                continue
            crossed = (
                side is Side.ASK
                and snap.last_side == "buy"
                and snap.last_price >= order.price
            ) or (
                side is Side.BID
                and snap.last_side == "sell"
                and snap.last_price <= order.price
            )
            if crossed:
                engine.book.cancel_order(order_id)
                from mm_engine.types import Fill as FillType

                fill = FillType(
                    maker_order_id=order_id,
                    taker_order_id=self._market_order_id,
                    price=order.price,
                    quantity=min(order.quantity, max(1, int(snap.last_qty))),
                    side=side,
                    timestamp=snap.timestamp_ns,
                )
                self._market_order_id += 1
                pnl_before = engine.inventory.state.realized_pnl
                engine._record_our_fill(fill)
                self._record_fill(fill, engine, pnl_before=pnl_before)

    def _simulate_paper_taker_flow(self, engine: BacktestEngine, ts: int) -> None:
        """Synthetic market hits on our quotes — populates paper trade book for MM testing."""
        if self.config.feed_type != "paper_trading" or not self.config.auto_trade:
            return
        self._paper_sim_ticks += 1
        if not engine._active_quotes:
            return
        if self._last_paper_sim_ns and ts - self._last_paper_sim_ns < 1_000_000_000:
            return
        self._last_paper_sim_ns = ts

        side, order_id = random.choice(list(engine._active_quotes.items()))
        order = engine.book.get_order(order_id)
        if order is None:
            return

        from mm_engine.types import Fill as FillType

        qty = min(order.quantity, max(1, self.config.quote_size))
        fill = FillType(
            maker_order_id=order_id,
            taker_order_id=self._market_order_id,
            price=order.price,
            quantity=qty,
            side=side,
            timestamp=ts,
        )
        self._market_order_id += 1
        pnl_before = engine.inventory.state.realized_pnl
        engine.book.cancel_order(order_id)
        engine._record_our_fill(fill)
        self._record_fill(fill, engine, pnl_before=pnl_before)

        tick_event = MarketEvent(timestamp=ts, event_type=EventType.ADD, order_id=0)
        if engine.strategy.should_requote(tick_event, engine.book):
            for new_fill in engine._schedule_quotes(ts):
                self._record_fill(new_fill, engine)
            self._quote_updates += 1

    def _record_fill(
        self, fill: Fill, engine: BacktestEngine, *, pnl_before: float | None = None
    ) -> None:
        if pnl_before is None:
            pnl_before = engine.inventory.state.realized_pnl
        pnl_delta = engine.inventory.state.realized_pnl - pnl_before
        if pnl_delta > 0:
            self._winning_fills += 1
        self._fill_pnls.append(pnl_delta)
        self._fills.append(fill)
        self._algo.fills = len(self._fills)
        self._append_log(
            "fill",
            f"Fill {fill.side.value} {fill.quantity}@{fill.price:.4f} pnlΔ{pnl_delta:+.4f}",
            "success" if pnl_delta >= 0 else "danger",
        )

    def _record_quote_trail(self, engine: BacktestEngine, ts: int) -> None:
        mid = engine.book.mid_price
        if mid is None:
            return
        quote = engine.strategy.compute_quote(engine.book, engine.inventory.position)
        bid = quote.bid_price if quote else mid
        ask = quote.ask_price if quote else mid
        self._quote_trail.append(
            {"timestamp": float(ts), "mid": mid, "bid": bid, "ask": ask, "reservation": mid}
        )
        if len(self._quote_trail) > 120:
            self._quote_trail.pop(0)

    def _append_log(self, category: str, message: str, severity: str) -> None:
        self._log_events.append(
            {
                "timestamp": str(time.time_ns()),
                "category": category,
                "message": message,
                "severity": severity,
            }
        )
        if len(self._log_events) > 40:
            self._log_events.pop(0)

    def current_frame(self) -> ReplayFrame:
        if not self._frame_dirty and self._cached_frame is not None:
            return self._cached_frame

        if self._engine is None:
            self._engine = self._build_engine()

        engine = self._engine
        book = engine.book
        mid = book.mid_price
        position = engine.inventory.position
        self._max_abs_inventory = max(self._max_abs_inventory, abs(position))

        inv_state = engine.inventory.state
        mid_px = mid if mid is not None else 0.0
        total_pnl = engine.inventory.mark_to_market(mid_px)
        realized = inv_state.realized_pnl
        unrealized = engine.inventory.unrealized_pnl(mid_px)
        fill_count = inv_state.fill_count
        summary = summarize_performance(self._pnl_curve, inv_state) if self._pnl_curve else None

        bid_depth = [
            {"price": p, "quantity": float(lvl.total_quantity)}
            for p, lvl in sorted(book._bids.items(), reverse=True)[:12]
        ]
        ask_depth = [
            {"price": p, "quantity": float(lvl.total_quantity)}
            for p, lvl in sorted(book._asks.items())[:12]
        ]

        our_bid = our_ask = None
        for side, oid in engine._active_quotes.items():
            o = book.get_order(oid)
            if o is None:
                continue
            if side is Side.BID:
                our_bid = o.price
            else:
                our_ask = o.price

        recent_fills = [
            {
                "timestamp": f.timestamp,
                "price": f.price,
                "quantity": f.quantity,
                "side": f.side.value,
            }
            for f in self._fills[-12:]
        ]
        fill_prices = [float(f["price"]) for f in recent_fills]
        ladder = build_book_ladder(bid_depth, ask_depth, fill_prices)

        for row in ladder:
            if our_bid and abs(row["price"] - our_bid) < 1e-6:
                row["is_ours"] = True
            if our_ask and abs(row["price"] - our_ask) < 1e-6:
                row["is_ours"] = True

        ts = self._last_snapshot.timestamp_ns if self._last_snapshot else time.time_ns()
        mode = "LIVE" if self.config.live_mode else "PAPER"
        latency_ms = self._last_step_latency_ms

        self._algo.quotes_posted = self._quote_updates
        self._algo.win_rate = self._winning_fills / max(fill_count, 1)

        frame = ReplayFrame(
            timestamp=ts,
            frame_index=0,
            total_frames=0,
            playing=self.config.auto_trade and self._connected,
            playback_speed=1.0,
            mode=mode,
            exchange=self.config.exchange,
            symbol=self.config.symbol,
            strategy=self.config.strategy,
            regime="normal",
            system_status="healthy" if self._connected else "warning",
            best_bid=book.best_bid,
            best_ask=book.best_ask,
            mid_price=mid,
            spread=book.spread,
            reservation_price=mid,
            fair_value=mid,
            our_bid=our_bid,
            our_ask=our_ask,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            position=position,
            avg_abs_inventory=summary.avg_abs_inventory if summary else 0.0,
            max_abs_inventory=self._max_abs_inventory,
            exposure=abs(position) * (mid or 0),
            risk_score=min(100.0, abs(position) / max(self.config.max_inventory, 1) * 100),
            gamma=self.config.gamma,
            k=self.config.k,
            sigma=self.config.sigma,
            tau=1.0,
            toxicity=0.0,
            optimal_spread=book.spread,
            kill_switch=False,
            circuit_breaker=False,
            total_pnl=total_pnl,
            realized_pnl=realized,
            unrealized_pnl=unrealized,
            spread_capture=realized * 0.3,
            inventory_mtm=unrealized,
            transaction_fees=inv_state.transaction_costs,
            adverse_selection_cost=0.0,
            sharpe_ratio=summary.sharpe_ratio if summary else None,
            sortino_ratio=None,
            max_drawdown=summary.max_drawdown if summary else 0.0,
            fill_rate=fill_count / max(self._quote_updates, 1),
            win_rate=self._algo.win_rate,
            avg_trade_profit=total_pnl / max(fill_count, 1),
            fill_count=fill_count,
            pnl_timeline=[
                {"timestamp": float(p.timestamp), "pnl": p.mark_to_market_pnl}
                for p in self._pnl_curve[-80:]
            ],
            inventory_timeline=[
                {"timestamp": float(p.timestamp), "position": float(p.position)}
                for p in self._pnl_curve[-80:]
            ],
            quote_trail=self._quote_trail[-40:],
            recent_fills=recent_fills,
            queue_position_bid=1,
            queue_position_ask=1,
            fill_probability_bid=0.5,
            fill_probability_ask=0.5,
            execution_latency_us=latency_ms * 1000,
            quote_lifetime_ms=1000.0,
            cancel_rate=0.0,
            fill_efficiency=fill_count / max(self._quote_updates, 1),
            events_per_sec=self._events_per_sec if self._connected else 0.0,
            end_to_end_latency_ms=latency_ms,
            cpu_percent=10.0,
            memory_mb=200.0,
            order_flow_imbalance=0.0,
            events=self._log_events[-30:],
            feed_type=self.config.feed_type,
            dataset_name=self.config.dataset_name or f"{self.config.symbol}_PAPER",
            total_events=0,
            replay_time_display=format_replay_timestamp(ts),
            progress_pct=100.0 if self._connected else 0.0,
            live_mode=self.config.live_mode,
            live_connected=self._connected,
            live_ping_ms=self._ping_ms,
            connection_quality=self._connection_quality,
            packet_loss_pct=self._packet_loss_pct,
            book_ladder=ladder,
            quote_decision=build_quote_decision(
                mid=mid,
                reservation=mid,
                fair_value=mid,
                position=position,
                sigma=self.config.sigma,
                gamma=self.config.gamma,
                k=self.config.k,
                optimal_spread=book.spread,
                our_bid=our_bid,
                our_ask=our_ask,
                regime="normal",
                toxicity=0.0,
                fill_prob_bid=0.5,
                fill_prob_ask=0.5,
            ),
            pnl_decomposition=build_pnl_decomposition(
                realized=realized,
                unrealized=unrealized,
                spread_capture=realized * 0.3,
                inventory_mtm=unrealized,
                fees=inv_state.transaction_costs,
                adverse_cost=0.0,
                total_pnl=total_pnl,
            ),
            strategy_comparison=[],
            latency_breakdown=build_latency_breakdown(latency_ms),
            inventory_distribution=[],
            inventory_heatmap=[],
            queue_analytics=build_queue_analytics(1, 1, 0.5, 0.5),
            replay_complete=False,
        )
        self._cached_frame = frame
        self._frame_dirty = False
        return frame

    def trade_history(self) -> List[Dict[str, object]]:
        rows: List[Dict[str, object]] = []
        fee_rate = 0.0001
        for i, fill in enumerate(self._fills):
            notional = fill.price * fill.quantity
            pnl = self._fill_pnls[i] if i < len(self._fill_pnls) else 0.0
            rows.append(
                {
                    "id": i + 1,
                    "time": fill.timestamp,
                    "time_display": format_replay_timestamp(fill.timestamp),
                    "exchange": self.config.exchange,
                    "symbol": self.config.symbol,
                    "side": fill.side.value.upper(),
                    "quantity": fill.quantity,
                    "entry": fill.price,
                    "exit": fill.price,
                    "price": fill.price,
                    "pnl": round(pnl, 4),
                    "fees": round(notional * fee_rate, 4),
                    "strategy": self.config.strategy,
                    "latency_us": self._last_step_latency_ms * 1000,
                    "status": "filled",
                    "was_profitable": pnl > 0,
                }
            )
        return rows

    def open_orders(self) -> List[Dict[str, object]]:
        if self._engine is None:
            return []
        engine = self._engine
        orders: List[Dict[str, object]] = []
        for side, order_id in engine._active_quotes.items():
            order = engine.book.get_order(order_id)
            if order is None:
                continue
            orders.append(
                {
                    "order_id": order_id,
                    "side": side.value.upper(),
                    "price": order.price,
                    "quantity": order.quantity,
                    "timestamp": order.timestamp,
                    "status": "open",
                }
            )
        return orders

    def algo_state(self) -> Dict[str, object]:
        return {
            "active": self._algo.active,
            "strategy": self._algo.strategy,
            "quotes_posted": self._algo.quotes_posted,
            "fills": self._algo.fills,
            "win_rate": self._algo.win_rate,
        }


def list_instruments(asset_class: str) -> List[Dict[str, str]]:
    if asset_class == "stock":
        symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMZN", "META", "SPY"]
        return [
            {"symbol": s, "exchange": "Alpaca", "asset_class": "stock", "label": s}
            for s in symbols
        ]
    crypto = [
        ("BTCUSDT", "Binance"),
        ("ETHUSDT", "Binance"),
        ("SOLUSDT", "Binance"),
        ("BNBUSDT", "Binance"),
        ("BTCUSDT", "Bybit"),
        ("ETHUSDT", "Bybit"),
    ]
    return [
        {"symbol": sym, "exchange": ex, "asset_class": "crypto", "label": f"{sym} ({ex})"}
        for sym, ex in crypto
    ]