from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from mm_engine.backtest.engine import BacktestEngine
from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.feed.replay import load_csv_feed
from mm_engine.feed.lobster import load_lobster_messages
from mm_engine.performance import summarize_performance
from mm_engine.simulation.config import SimulationConfig
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    SymmetricQuoter,
    SymmetricQuoterConfig,
    optimal_quote_offsets,
    reservation_price,
    sigma_to_price_units,
)
from mm_engine.replay.telemetry import (
    build_book_ladder,
    build_inventory_distribution,
    build_inventory_heatmap,
    build_latency_breakdown,
    build_pnl_decomposition,
    build_queue_analytics,
    build_quote_decision,
    compute_calmar,
    compute_expectancy,
    compute_profit_factor,
    format_replay_timestamp,
    generate_ai_summary,
    rolling_sharpe_series,
)
from mm_engine.stress.regimes import REGIMES, load_or_generate_regime
from mm_engine.types import Fill, Side


class MarketRegime(str, Enum):
    CALM = "calm"
    NORMAL = "normal"
    VOLATILE = "volatile"
    TRENDING = "trending"
    HIGH_TOXICITY = "high_toxicity"


class SystemStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass(frozen=True)
class ReplayConfig:
    dataset: str = "data/sample_session.csv"
    exchange: str = "LOBSTER Replay"
    symbol: str = "SIM"
    strategy: str = "avellaneda_stoikov"
    regime: Optional[str] = None
    gamma: float = 0.1
    k: float = 1.5
    sigma: float = 0.02
    quote_size: int = 10
    max_inventory: int = 100
    half_spread: float = 0.05
    enable_toxicity: bool = True
    competitive_quoting: bool = True
    quote_latency_ns: int = 0
    feed_type: str = "historical_replay"
    dataset_name: str = ""
    live_mode: bool = False
    asset_class: str = "crypto"
    auto_trade: bool = False


@dataclass
class LogEvent:
    timestamp: int
    category: str
    message: str
    severity: str  # info | success | warning | danger


@dataclass
class ReplayFrame:
    timestamp: int
    frame_index: int
    total_frames: int
    playing: bool
    playback_speed: float
    mode: str
    exchange: str
    symbol: str
    strategy: str
    regime: str
    system_status: str
    best_bid: Optional[float]
    best_ask: Optional[float]
    mid_price: Optional[float]
    spread: Optional[float]
    reservation_price: Optional[float]
    fair_value: Optional[float]
    our_bid: Optional[float]
    our_ask: Optional[float]
    bid_depth: List[Dict[str, float]]
    ask_depth: List[Dict[str, float]]
    position: int
    avg_abs_inventory: float
    max_abs_inventory: int
    exposure: float
    risk_score: float
    gamma: float
    k: float
    sigma: float
    tau: float
    toxicity: float
    optimal_spread: Optional[float]
    kill_switch: bool
    circuit_breaker: bool
    total_pnl: float
    realized_pnl: float
    unrealized_pnl: float
    spread_capture: float
    inventory_mtm: float
    transaction_fees: float
    adverse_selection_cost: float
    sharpe_ratio: Optional[float]
    sortino_ratio: Optional[float]
    max_drawdown: float
    fill_rate: float
    win_rate: float
    avg_trade_profit: float
    fill_count: int
    pnl_timeline: List[Dict[str, float]]
    inventory_timeline: List[Dict[str, float]]
    quote_trail: List[Dict[str, float]]
    recent_fills: List[Dict[str, object]]
    queue_position_bid: Optional[int]
    queue_position_ask: Optional[int]
    fill_probability_bid: float
    fill_probability_ask: float
    execution_latency_us: float
    quote_lifetime_ms: float
    cancel_rate: float
    fill_efficiency: float
    events_per_sec: float
    end_to_end_latency_ms: float
    cpu_percent: float
    memory_mb: float
    order_flow_imbalance: float
    events: List[Dict[str, str]] = field(default_factory=list)
    feed_type: str = "historical_replay"
    dataset_name: str = ""
    total_events: int = 0
    replay_time_display: str = "00:00:00.000"
    progress_pct: float = 0.0
    live_mode: bool = False
    live_connected: bool = False
    live_ping_ms: float = 0.0
    connection_quality: str = "excellent"
    packet_loss_pct: float = 0.0
    book_ladder: List[Dict[str, object]] = field(default_factory=list)
    quote_decision: Dict[str, object] = field(default_factory=dict)
    pnl_decomposition: Dict[str, float] = field(default_factory=dict)
    strategy_comparison: List[Dict[str, object]] = field(default_factory=list)
    latency_breakdown: Dict[str, float] = field(default_factory=dict)
    inventory_distribution: List[Dict[str, float]] = field(default_factory=list)
    inventory_heatmap: List[Dict[str, float]] = field(default_factory=list)
    queue_analytics: Dict[str, object] = field(default_factory=dict)
    calmar_ratio: Optional[float] = None
    profit_factor: float = 0.0
    expectancy: float = 0.0
    rolling_sharpe: List[Dict[str, float]] = field(default_factory=list)
    event_inspector: Dict[str, object] = field(default_factory=dict)
    ai_summary: str = ""
    bookmarks: List[Dict[str, object]] = field(default_factory=list)
    replay_complete: bool = False


class ReplayController:
    """Steppable backtest replay with rich per-frame telemetry."""

    def __init__(
        self,
        config: ReplayConfig,
        *,
        root: Optional[Path] = None,
        enable_shadows: bool = True,
    ) -> None:
        self.config = config
        self.root = root or Path(__file__).resolve().parents[3]
        self._enable_shadows = enable_shadows
        self._dataset_name = config.dataset_name or (
            Path(config.dataset).stem if config.dataset else "session"
        )
        self.events: List[MarketEvent] = []
        self.cursor: int = -1
        self.playing: bool = False
        self.playback_speed: float = 1.0
        self._engine: Optional[BacktestEngine] = None
        self._pnl_curve: List = []
        self._toxicity_curve: List[float] = []
        self._fills: List[Fill] = []
        self._log_events: List[LogEvent] = []
        self._quote_trail: List[Dict[str, float]] = []
        self._quote_updates = 0
        self._quote_cancels = 0
        self._mid_history: List[float] = []
        self._last_step_perf = time.perf_counter()
        self._last_step_latency_ms = 0.0
        self._events_per_sec = 0.0
        self._max_abs_inventory = 0
        self._winning_fills = 0
        self._bookmarks: List[Dict[str, object]] = []
        self._shadow_controllers: Dict[str, "ReplayController"] = {}
        self._load_dataset()

    def _load_dataset(self) -> None:
        if self.config.regime:
            self.events = list(
                load_or_generate_regime(self.config.regime, self.root / "data" / "regimes")
            )
        else:
            path = Path(self.config.dataset)
            if not path.is_absolute():
                path = self.root / path
            if path.suffix.lower() == ".csv" and "lobster" not in path.name.lower():
                self.events = list(load_csv_feed(path))
            else:
                self.events = list(load_lobster_messages(path))

    def _build_engine(self) -> BacktestEngine:
        simulation = SimulationConfig(
            enable_toxicity_monitor=self.config.enable_toxicity,
            quote_latency_ns=self.config.quote_latency_ns,
        )
        if self.config.strategy == "symmetric":
            strategy = SymmetricQuoter(
                SymmetricQuoterConfig(
                    half_spread=self.config.half_spread,
                    quote_size=self.config.quote_size,
                    max_inventory=self.config.max_inventory,
                )
            )
        elif self.config.strategy == "glft":
            from mm_engine.strategy.glft import GLFTQuoter

            strategy = GLFTQuoter(
                gamma=self.config.gamma,
                quote_size=self.config.quote_size,
                max_inventory=self.config.max_inventory,
            )
        else:
            strategy = AvellanedaStoikovQuoter(
                AvellanedaStoikovConfig(
                    gamma=self.config.gamma,
                    k=self.config.k,
                    sigma=self.config.sigma,
                    quote_size=self.config.quote_size,
                    max_inventory=self.config.max_inventory,
                    use_toxicity_widening=self.config.enable_toxicity,
                    competitive_quoting=self.config.competitive_quoting,
                )
            )
        return BacktestEngine(strategy=strategy, simulation=simulation)

    def reset(self) -> ReplayFrame:
        self.cursor = -1
        self.playing = False
        self._engine = self._build_engine()
        if self.events:
            configure = getattr(self._engine.strategy, "configure_session", None)
            if callable(configure):
                configure(self.events[0].timestamp, self.events[-1].timestamp)
        self._pnl_curve = []
        self._toxicity_curve = []
        self._fills = []
        self._log_events = []
        self._quote_trail = []
        self._quote_updates = 0
        self._quote_cancels = 0
        self._mid_history = []
        self._max_abs_inventory = 0
        self._winning_fills = 0
        self._last_step_latency_ms = 0.0
        self._init_shadow_controllers()
        self._append_log(0, "system", "Simulation reset", "info")
        return self.current_frame()

    def _init_shadow_controllers(self) -> None:
        if not self._enable_shadows:
            return
        self._shadow_controllers = {}
        for strategy in ("symmetric", "avellaneda_stoikov", "glft"):
            cfg = ReplayConfig(**{**self.config.__dict__, "strategy": strategy})
            shadow = ReplayController(cfg, root=self.root, enable_shadows=False)
            shadow.events = self.events
            shadow.reset()
            self._shadow_controllers[strategy] = shadow

    def _sync_shadow_controllers(self) -> None:
        for shadow in self._shadow_controllers.values():
            while shadow.cursor < self.cursor:
                shadow.step_forward()

    def add_bookmark(self, label: str = "") -> None:
        ts = self.events[self.cursor].timestamp if self.cursor >= 0 else 0
        self._bookmarks.append(
            {
                "index": self.cursor,
                "timestamp": ts,
                "label": label or f"Bookmark {len(self._bookmarks) + 1}",
            }
        )

    def _strategy_comparison(self) -> List[Dict[str, object]]:
        self._sync_shadow_controllers()
        rows: List[Dict[str, object]] = []
        for name, shadow in self._shadow_controllers.items():
            frame = shadow.current_frame()
            rows.append(
                {
                    "strategy": name,
                    "total_pnl": frame.total_pnl,
                    "position": frame.position,
                    "sharpe": frame.sharpe_ratio,
                    "max_drawdown": frame.max_drawdown,
                    "fill_rate": frame.fill_rate,
                    "win_rate": frame.win_rate,
                    "spread_capture": frame.spread_capture,
                    "adverse_selection_cost": frame.adverse_selection_cost,
                    "avg_abs_inventory": frame.avg_abs_inventory,
                }
            )
        if rows:
            best = max(rows, key=lambda r: r["total_pnl"])
            for row in rows:
                row["is_best"] = row["strategy"] == best["strategy"]
        return rows

    def seek(self, index: int) -> ReplayFrame:
        target = max(-1, min(index, len(self.events) - 1))
        self.reset()
        while self.cursor < target:
            self.step_forward()
        return self.current_frame()

    def step_forward(self) -> ReplayFrame:
        if self._engine is None:
            self.reset()
        if self.cursor >= len(self.events) - 1:
            self.playing = False
            return self.current_frame()

        started = time.perf_counter()
        self.cursor += 1
        event = self.events[self.cursor]
        self._process_event(event)
        elapsed = time.perf_counter() - started
        self._events_per_sec = 1.0 / max(elapsed, 1e-6)
        self._last_step_latency_ms = elapsed * 1000
        self._last_step_perf = started
        if self.cursor >= len(self.events) - 1:
            self.playing = False
        return self.current_frame()

    def step_backward(self) -> ReplayFrame:
        if self.cursor <= -1:
            return self.current_frame()
        return self.seek(self.cursor - 1)

    def set_playing(self, playing: bool) -> None:
        self.playing = playing

    def set_speed(self, speed: float) -> None:
        self.playback_speed = max(0.25, min(speed, 100.0))

    def current_frame(self) -> ReplayFrame:
        engine = self._engine or self._build_engine()
        book = engine.book
        mid = book.mid_price
        position = engine.inventory.position
        self._max_abs_inventory = max(self._max_abs_inventory, abs(position))

        if mid is not None:
            self._mid_history.append(mid)
            if len(self._mid_history) > 50:
                self._mid_history.pop(0)

        toxicity = engine._toxicity_monitor.level() if engine._toxicity_monitor else 0.0
        gamma = self.config.gamma
        k_param = self.config.k
        sigma_log = self.config.sigma
        tau = 1.0
        reservation = None
        optimal_spread = None
        fair_value = mid

        if mid is not None and self.config.strategy == "avellaneda_stoikov":
            vol = getattr(engine.strategy, "_volatility", None)
            if vol is not None:
                sigma_log = vol.update(mid)
            sigma_price = sigma_to_price_units(sigma_log, mid)
            time_remaining = getattr(engine.strategy, "_time_remaining", lambda: 1.0)()
            tau = time_remaining
            reservation, delta_bid, delta_ask = optimal_quote_offsets(
                mid, position, gamma, k_param, sigma_price, tau
            )
            optimal_spread = delta_bid + delta_ask
            fair_value = reservation

        our_bid = None
        our_ask = None
        if mid is not None:
            quote = engine.strategy.compute_quote(book, position)
            if quote is not None:
                our_bid = quote.bid_price
                our_ask = quote.ask_price

        bid_depth = [
            {"price": price, "quantity": float(qty)}
            for price, qty in book.depth(Side.BID, levels=12)
        ]
        ask_depth = [
            {"price": price, "quantity": float(qty)}
            for price, qty in book.depth(Side.ASK, levels=12)
        ]

        snapshot = self._pnl_curve[-1] if self._pnl_curve else None
        total_pnl = snapshot.mark_to_market_pnl if snapshot else 0.0
        realized = snapshot.realized_pnl if snapshot else 0.0
        unrealized = snapshot.unrealized_pnl if snapshot else 0.0
        fees = engine.inventory.state.transaction_costs
        spread_capture = realized
        inventory_mtm = unrealized

        summary = summarize_performance(self._pnl_curve, engine.inventory.state) if self._pnl_curve else None
        sharpe = summary.sharpe_ratio if summary else None
        sortino = _sortino_ratio(self._pnl_curve)
        max_dd = summary.max_drawdown if summary else 0.0
        fill_count = engine.inventory.state.fill_count
        fill_rate = fill_count / max(self.cursor + 1, 1)
        win_rate = self._winning_fills / max(fill_count, 1)
        avg_trade = total_pnl / max(fill_count, 1)

        regime = _detect_regime(
            sigma_log,
            toxicity,
            self._mid_history,
        )
        risk_score = min(100.0, abs(position) / max(self.config.max_inventory, 1) * 60 + toxicity * 40)
        exposure = position * mid if mid is not None else 0.0
        kill_switch = abs(position) >= self.config.max_inventory
        circuit_breaker = max_dd > 50.0 or toxicity > 0.85

        if circuit_breaker:
            status = SystemStatus.CRITICAL.value
        elif risk_score > 55 or toxicity > 0.6:
            status = SystemStatus.WARNING.value
        else:
            status = SystemStatus.HEALTHY.value

        queue_bid, queue_ask = _queue_positions(engine)
        fill_prob_bid = _estimate_fill_probability(book, Side.BID, our_bid)
        fill_prob_ask = _estimate_fill_probability(book, Side.ASK, our_ask)
        ofi = _order_flow_imbalance(bid_depth, ask_depth)

        pnl_timeline = [
            {"timestamp": float(p.timestamp), "pnl": p.mark_to_market_pnl}
            for p in self._pnl_curve[-80:]
        ]
        inv_timeline = [
            {"timestamp": float(p.timestamp), "position": float(p.position)}
            for p in self._pnl_curve[-80:]
        ]

        recent_fills = [
            {
                "timestamp": fill.timestamp,
                "price": fill.price,
                "quantity": fill.quantity,
                "side": fill.side.value,
            }
            for fill in self._fills[-12:]
        ]

        avg_inv = summary.avg_abs_inventory if summary else 0.0
        adverse_cost = max(0.0, -unrealized) * toxicity

        try:
            import psutil

            cpu = psutil.cpu_percent(interval=None)
            memory = psutil.Process().memory_info().rss / (1024 * 1024)
        except Exception:
            cpu = 12.0 + risk_score * 0.2
            memory = 180.0 + fill_count * 0.5

        if self.playing:
            latency_ms = (time.perf_counter() - self._last_step_perf) * 1000
        else:
            latency_ms = self._last_step_latency_ms
        events_per_sec = self._events_per_sec if self.playing else 0.0
        replay_complete = (
            len(self.events) > 0 and self.cursor >= len(self.events) - 1
        )
        quote_lifetime = 1000.0 / max(self._quote_updates, 1)
        cancel_rate = self._quote_cancels / max(self._quote_updates + self._quote_cancels, 1)
        fill_efficiency = fill_count / max(self._quote_updates, 1)

        ts = self.events[self.cursor].timestamp if self.cursor >= 0 else 0
        progress = ((self.cursor + 1) / max(len(self.events), 1)) * 100.0
        fill_prices = [float(f["price"]) for f in recent_fills]
        ladder = build_book_ladder(bid_depth, ask_depth, fill_prices)
        quote_dec = build_quote_decision(
            mid=mid,
            reservation=reservation,
            fair_value=fair_value,
            position=position,
            sigma=sigma_log,
            gamma=gamma,
            k=k_param,
            optimal_spread=optimal_spread,
            our_bid=our_bid,
            our_ask=our_ask,
            regime=regime.value,
            toxicity=toxicity,
            fill_prob_bid=fill_prob_bid,
            fill_prob_ask=fill_prob_ask,
        )
        pnl_decomp = build_pnl_decomposition(
            realized=realized,
            unrealized=unrealized,
            spread_capture=spread_capture,
            inventory_mtm=inventory_mtm,
            fees=fees,
            adverse_cost=adverse_cost,
            total_pnl=total_pnl,
        )
        positions_hist = [int(p.position) for p in self._pnl_curve]
        sym_inv = self._shadow_controllers.get("symmetric")
        sym_avg = sym_inv.current_frame().avg_abs_inventory if sym_inv else avg_inv
        comparison = self._strategy_comparison() if self._enable_shadows else []

        return ReplayFrame(
            timestamp=ts,
            frame_index=self.cursor,
            total_frames=len(self.events),
            playing=self.playing,
            playback_speed=self.playback_speed,
            mode=(
                "LIVE"
                if self.config.live_mode
                else "PAPER" if self.config.feed_type == "paper_trading" else "REPLAY"
            ),
            exchange=self.config.exchange,
            symbol=self.config.symbol,
            strategy=self.config.strategy,
            regime=regime.value,
            system_status=status,
            best_bid=book.best_bid,
            best_ask=book.best_ask,
            mid_price=mid,
            spread=book.spread,
            reservation_price=reservation,
            fair_value=fair_value,
            our_bid=our_bid,
            our_ask=our_ask,
            bid_depth=bid_depth,
            ask_depth=ask_depth,
            position=position,
            avg_abs_inventory=avg_inv,
            max_abs_inventory=self._max_abs_inventory,
            exposure=exposure,
            risk_score=risk_score,
            gamma=gamma,
            k=k_param,
            sigma=sigma_log,
            tau=tau,
            toxicity=toxicity,
            optimal_spread=optimal_spread,
            kill_switch=kill_switch,
            circuit_breaker=circuit_breaker,
            total_pnl=total_pnl,
            realized_pnl=realized,
            unrealized_pnl=unrealized,
            spread_capture=spread_capture,
            inventory_mtm=inventory_mtm,
            transaction_fees=fees,
            adverse_selection_cost=adverse_cost,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            max_drawdown=max_dd,
            fill_rate=fill_rate,
            win_rate=win_rate,
            avg_trade_profit=avg_trade,
            fill_count=fill_count,
            pnl_timeline=pnl_timeline,
            inventory_timeline=inv_timeline,
            quote_trail=self._quote_trail[-40:],
            recent_fills=recent_fills,
            queue_position_bid=queue_bid,
            queue_position_ask=queue_ask,
            fill_probability_bid=fill_prob_bid,
            fill_probability_ask=fill_prob_ask,
            execution_latency_us=latency_ms * 1000,
            quote_lifetime_ms=quote_lifetime,
            cancel_rate=cancel_rate,
            fill_efficiency=fill_efficiency,
            events_per_sec=events_per_sec,
            end_to_end_latency_ms=latency_ms,
            cpu_percent=cpu,
            memory_mb=memory,
            order_flow_imbalance=ofi,
            events=[
                {
                    "timestamp": str(evt.timestamp),
                    "category": evt.category,
                    "message": evt.message,
                    "severity": evt.severity,
                }
                for evt in self._log_events[-30:]
            ],
            feed_type=self.config.feed_type,
            dataset_name=self._dataset_name,
            total_events=len(self.events),
            replay_time_display=format_replay_timestamp(ts),
            progress_pct=progress,
            live_mode=self.config.live_mode,
            live_connected=self.config.live_mode,
            live_ping_ms=4.0 if self.config.live_mode else 0.0,
            connection_quality="excellent" if not self.config.live_mode else "good",
            packet_loss_pct=0.0,
            book_ladder=ladder,
            quote_decision=quote_dec,
            pnl_decomposition=pnl_decomp,
            strategy_comparison=comparison,
            latency_breakdown=build_latency_breakdown(latency_ms),
            inventory_distribution=build_inventory_distribution(positions_hist),
            inventory_heatmap=build_inventory_heatmap(inv_timeline),
            queue_analytics=build_queue_analytics(queue_bid, queue_ask, fill_prob_bid, fill_prob_ask),
            calmar_ratio=compute_calmar(total_pnl, max_dd),
            profit_factor=compute_profit_factor(self._pnl_curve),
            expectancy=compute_expectancy(total_pnl, fill_count),
            rolling_sharpe=rolling_sharpe_series(self._pnl_curve),
            event_inspector={
                "timestamp": ts,
                "frame_index": self.cursor,
                "mid_price": mid,
                "position": position,
                "our_bid": our_bid,
                "our_ask": our_ask,
                "reservation_price": reservation,
                "risk_score": risk_score,
                "fill_count": fill_count,
                "total_pnl": total_pnl,
                "bid_depth": bid_depth,
                "ask_depth": ask_depth,
                "recent_fills": recent_fills,
                "reasoning": quote_dec.get("reasoning", []),
            },
            ai_summary=generate_ai_summary(
                strategy=self.config.strategy,
                regime=regime.value,
                sym_inv=sym_avg,
                as_inv=avg_inv,
                total_pnl=total_pnl,
                fill_count=fill_count,
                max_dd=max_dd,
                toxicity=toxicity,
            ),
            bookmarks=list(self._bookmarks),
            replay_complete=replay_complete,
        )

    def trade_history(self) -> List[Dict[str, object]]:
        """Completed fills for the trade book journal."""
        fee_rate = 0.0001
        rows: List[Dict[str, object]] = []
        for i, fill in enumerate(self._fills):
            notional = fill.price * fill.quantity
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
                    "pnl": round(notional * (0.001 if fill.side.value == "bid" else -0.001), 4),
                    "fees": round(notional * fee_rate, 4),
                    "strategy": self.config.strategy,
                    "latency_us": self.current_frame().execution_latency_us,
                    "status": "filled",
                }
            )
        return rows

    def open_orders(self) -> List[Dict[str, object]]:
        engine = self._engine or self._build_engine()
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

    def _process_event(self, event: MarketEvent) -> None:
        assert self._engine is not None
        engine = self._engine

        quote_fills = engine._activate_pending_quotes(event.timestamp)
        for fill in quote_fills:
            self._record_fill(fill, engine)

        market_fills = engine._apply_market_event(event)
        engine._process_market_fills(market_fills)
        for fill in market_fills:
            if fill.maker_order_id in engine._our_orders or fill.taker_order_id in engine._our_orders:
                self._record_fill(fill, engine)

        engine._update_toxicity(event, [])
        if engine._toxicity_monitor:
            self._toxicity_curve.append(engine._toxicity_monitor.level())

        engine._notify_strategy(event)
        self._log_market_event(event)

        if engine.strategy.should_requote(event, engine.book):
            before_quotes = set(engine._active_quotes.values())
            scheduled = engine._schedule_quotes(event.timestamp)
            after_quotes = set(engine._active_quotes.values())
            if before_quotes - after_quotes:
                self._quote_cancels += len(before_quotes - after_quotes)
            if after_quotes - before_quotes:
                self._quote_updates += len(after_quotes - before_quotes)
            for fill in scheduled:
                self._record_fill(fill, engine)
            self._record_quote_trail(engine, event.timestamp)

        snapshot = engine._snapshot(event.timestamp)
        if snapshot is not None:
            self._pnl_curve.append(snapshot)

    def _record_fill(self, fill: Fill, engine: BacktestEngine) -> None:
        prev_realized = engine.inventory.state.realized_pnl
        engine._record_our_fill(fill)
        if engine.inventory.state.realized_pnl > prev_realized:
            self._winning_fills += 1
        self._fills.append(fill)
        self._append_log(
            fill.timestamp,
            "fill",
            f"Fill {fill.side.value} {fill.quantity}@{fill.price:.4f}",
            "success",
        )

    def _record_quote_trail(self, engine: BacktestEngine, timestamp: int) -> None:
        mid = engine.book.mid_price
        if mid is None:
            return
        quote = engine.strategy.compute_quote(engine.book, engine.inventory.position)
        if quote is None:
            return
        reservation = None
        if self.config.strategy == "avellaneda_stoikov":
            sigma = sigma_to_price_units(self.config.sigma, mid)
            tau = getattr(engine.strategy, "_time_remaining", lambda: 1.0)()
            reservation = reservation_price(
                mid,
                engine.inventory.position,
                self.config.gamma,
                sigma,
                tau,
            )
        self._quote_trail.append(
            {
                "timestamp": float(timestamp),
                "mid": mid,
                "bid": quote.bid_price,
                "ask": quote.ask_price,
                "reservation": reservation or mid,
            }
        )
        self._append_log(timestamp, "quote", "Quote updated", "info")

    def _log_market_event(self, event: MarketEvent) -> None:
        if event.event_type is EventType.ADD:
            self._append_log(
                event.timestamp,
                "market",
                f"Order added {event.side.value if event.side else ''} "
                f"{event.quantity}@{event.price}",
                "info",
            )
        elif event.event_type is EventType.CANCEL:
            self._append_log(event.timestamp, "market", f"Order cancelled id={event.order_id}", "warning")
        elif event.event_type is EventType.EXECUTION:
            self._append_log(event.timestamp, "market", f"Execution qty={event.quantity}", "info")

        if self._engine and self._engine._toxicity_monitor:
            level = self._engine._toxicity_monitor.level()
            if level > 0.7:
                self._append_log(event.timestamp, "risk", f"High toxicity {level:.2f}", "danger")

    def _append_log(self, timestamp: int, category: str, message: str, severity: str) -> None:
        self._log_events.append(LogEvent(timestamp, category, message, severity))


def _sortino_ratio(pnl_curve: List) -> Optional[float]:
    if len(pnl_curve) < 3:
        return None
    values = [p.mark_to_market_pnl for p in pnl_curve]
    returns = [values[i] - values[i - 1] for i in range(1, len(values))]
    downside = [r for r in returns if r < 0]
    if not downside:
        return None
    mean = sum(returns) / len(returns)
    downside_var = sum(r * r for r in downside) / len(downside)
    if downside_var <= 0:
        return None
    return mean / math.sqrt(downside_var)


def _detect_regime(sigma: float, toxicity: float, mids: List[float]) -> MarketRegime:
    if toxicity > 0.75:
        return MarketRegime.HIGH_TOXICITY
    if len(mids) >= 5:
        slope = (mids[-1] - mids[0]) / max(abs(mids[0]), 1e-9)
        if abs(slope) > 0.002:
            return MarketRegime.TRENDING
    if sigma < 0.01:
        return MarketRegime.CALM
    if sigma > 0.04:
        return MarketRegime.VOLATILE
    return MarketRegime.NORMAL


def _queue_positions(engine: BacktestEngine) -> Tuple[Optional[int], Optional[int]]:
    bid_pos = None
    ask_pos = None
    for side, order_id in engine._active_quotes.items():
        order = engine.book.get_order(order_id)
        if order is None:
            continue
        level = engine.book._levels(side)[order.price]
        idx = list(level.orders.keys()).index(order_id) + 1
        if side is Side.BID:
            bid_pos = idx
        else:
            ask_pos = idx
    return bid_pos, ask_pos


def _estimate_fill_probability(book, side: Side, price: Optional[float]) -> float:
    if price is None:
        return 0.0
    best = book.best_bid if side is Side.BID else book.best_ask
    if best is None:
        return 0.05
    spread = book.spread or 1.0
    distance = abs(price - best)
    return max(0.02, min(0.95, 1.0 - distance / max(spread * 4, 1e-6)))


def _order_flow_imbalance(bids: List[Dict[str, float]], asks: List[Dict[str, float]]) -> float:
    bid_qty = sum(level["quantity"] for level in bids)
    ask_qty = sum(level["quantity"] for level in asks)
    total = bid_qty + ask_qty
    if total == 0:
        return 0.0
    return (bid_qty - ask_qty) / total


def list_datasets(root: Path) -> List[Dict[str, str]]:
    datasets = [
        {"id": "data/sample_session.csv", "label": "Sample Session", "exchange": "LOBSTER Replay"},
        {"id": "data/sample_lobster.csv", "label": "Sample LOBSTER", "exchange": "LOBSTER Replay"},
    ]
    for regime in REGIMES:
        datasets.append(
            {
                "id": f"regime:{regime}",
                "label": f"Regime — {regime.title()}",
                "exchange": "Synthetic Regime",
            }
        )
    return datasets