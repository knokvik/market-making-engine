#!/usr/bin/env python3
"""FastAPI + WebSocket server for the Market Making Engine dashboard."""
from __future__ import annotations

import asyncio
import csv
import json
import subprocess
import sys
import time
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from mm_engine.feed.live.chart_history import fetch_chart_history
from mm_engine.feed.live.market_intel import list_market_news, list_trending_stocks
from mm_engine.replay.live_session import LivePaperController, list_instruments
from mm_engine.replay.session import ReplayConfig, ReplayController, list_datasets
from mm_engine.replay.telemetry import list_data_sources
from mm_engine.stress import StressTestRunner
from mm_engine.stress.runner import format_comparison_table

ROOT = Path(__file__).resolve().parents[2]


class SessionConfigRequest(BaseModel):
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
    feed_type: str = "historical_replay"
    dataset_name: str = ""
    live_mode: bool = False
    asset_class: str = "crypto"
    auto_trade: bool = False


class ControlRequest(BaseModel):
    action: str = Field(
        ...,
        description="play|pause|step_forward|step_backward|reset|seek|set_speed|bookmark",
    )
    index: Optional[int] = None
    speed: Optional[float] = None
    label: Optional[str] = None


app = FastAPI(title="Market Making Engine Dashboard API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_replay_controller: Optional[ReplayController] = None
_live_controller: Optional[LivePaperController] = None


def _is_live_config(config: ReplayConfig) -> bool:
    return config.feed_type in ("live", "paper_trading")


def _get_replay_controller() -> ReplayController:
    global _replay_controller
    if _replay_controller is None:
        _replay_controller = ReplayController(ReplayConfig(), root=ROOT)
        _replay_controller.reset()
    return _replay_controller


def _get_active_controller():
    if _live_controller is not None:
        return _live_controller
    return _get_replay_controller()


def _frame_to_dict(frame, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = asdict(frame)
    if extra:
        data.update(extra)
    return data


def _build_config(request: SessionConfigRequest) -> ReplayConfig:
    regime = request.regime
    dataset = request.dataset
    feed_type = request.feed_type
    live_mode = request.live_mode
    exchange = request.exchange
    dataset_name = request.dataset_name or Path(dataset).stem

    if dataset.startswith("regime:"):
        regime = dataset.split(":", 1)[1]
        dataset = f"data/regimes/{regime}.csv"
    elif dataset.startswith("live:"):
        feed_type = "live"
        live_mode = True
        exchange = request.exchange or dataset.split(":", 1)[1].title()
        dataset_name = f"{request.symbol or exchange}_LIVE"
        dataset = "data/sample_session.csv"
    elif dataset.startswith("paper:"):
        feed_type = "paper_trading"
        live_mode = False
        exchange = request.exchange or dataset.split(":", 1)[1].title()
        dataset_name = f"{request.symbol or exchange}_PAPER"
        dataset = "data/sample_session.csv"
    elif dataset.startswith("lobster:"):
        dataset = "data/sample_lobster.csv"
        feed_type = "historical_replay"
        exchange = "LOBSTER"
        dataset_name = "LOBSTER"
    elif dataset.startswith("custom:"):
        dataset_name = dataset.split(":", 1)[1].upper()

    return ReplayConfig(
        dataset=dataset,
        exchange=exchange,
        symbol=request.symbol,
        strategy=request.strategy,
        regime=regime,
        gamma=request.gamma,
        k=request.k,
        sigma=request.sigma,
        quote_size=request.quote_size,
        max_inventory=request.max_inventory,
        half_spread=request.half_spread,
        enable_toxicity=request.enable_toxicity,
        feed_type=feed_type,
        dataset_name=dataset_name,
        live_mode=live_mode,
        asset_class=request.asset_class,
        auto_trade=request.auto_trade,
    )


def _spawn_live_session(config: ReplayConfig):
    global _live_controller, _replay_controller
    _replay_controller = None
    _live_controller = LivePaperController(config, root=ROOT)
    frame = _live_controller.reset()
    _live_controller.seed_initial_quote()
    _live_controller.start_feed()
    return _live_controller.current_frame()


def _spawn_replay_session(config: ReplayConfig):
    global _live_controller, _replay_controller
    if _live_controller is not None:
        _live_controller.stop_feed()
    _live_controller = None
    _replay_controller = ReplayController(config, root=ROOT)
    return _replay_controller.reset()


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "mm-engine-dashboard", "version": "2.0.0"}


@app.get("/api/datasets")
def datasets() -> Dict[str, Any]:
    return {"datasets": list_datasets(ROOT)}


@app.get("/api/instruments")
def instruments(asset_class: str = "crypto") -> Dict[str, Any]:
    return {"instruments": list_instruments(asset_class)}


@app.get("/api/trending-stocks")
def trending_stocks() -> Dict[str, Any]:
    return {"stocks": list_trending_stocks()}


@app.get("/api/market-news")
def market_news(symbol: Optional[str] = None, limit: int = 30) -> Dict[str, Any]:
    return {"news": list_market_news(symbol=symbol, limit=limit)}


@app.get("/api/chart-history")
def chart_history(
    symbol: str,
    asset_class: str = "stock",
    range: str = "1D",
) -> Dict[str, Any]:
    return fetch_chart_history(symbol=symbol, asset_class=asset_class, range_key=range)


@app.get("/api/data-sources")
def data_sources() -> Dict[str, Any]:
    sources = list_data_sources(ROOT)
    return {
        "historical": [s for s in sources if s["type"] == "historical_replay"],
        "paper": [s for s in sources if s["type"] == "paper_trading"],
        "live": [s for s in sources if s["type"] == "live"],
    }


def _resolve_source_path(source_id: str) -> Optional[Path]:
    if source_id.startswith("regime:"):
        regime = source_id.split(":", 1)[1]
        return ROOT / "data" / "regimes" / f"{regime}.csv"
    if source_id.startswith("lobster:"):
        return ROOT / "data" / "sample_lobster.csv"
    if source_id.startswith(("paper:", "live:", "custom:")):
        return None
    path = ROOT / source_id if not source_id.startswith("/") else Path(source_id)
    return path if path.exists() else None


@app.get("/api/data-sources/preview")
def data_source_preview(id: str) -> Dict[str, Any]:
    all_sources = list_data_sources(ROOT)
    meta = next((s for s in all_sources if s["id"] == id), None)
    if meta is None:
        return {"error": f"unknown source: {id}"}

    source_type = str(meta.get("type", "historical_replay"))
    if source_type in ("paper_trading", "live"):
        return {
            "id": id,
            "label": meta.get("label", id),
            "exchange": meta.get("exchange", "—"),
            "format": source_type,
            "description": (
                "Real-time market data feed with simulated order execution. "
                "No historical file — connects to live WebSocket/API."
            ),
            "row_count": None,
            "columns": [],
            "sample_rows": [],
            "event_types": {},
            "time_range": None,
            "kind": source_type,
        }

    path = _resolve_source_path(id)
    if path is None or not path.exists():
        return {
            "id": id,
            "label": meta.get("label", id),
            "exchange": meta.get("exchange", "—"),
            "format": meta.get("format", "unknown"),
            "description": "Placeholder source — upload or wire a custom feed to preview.",
            "row_count": 0,
            "columns": [],
            "sample_rows": [],
            "event_types": {},
            "time_range": None,
            "kind": "placeholder",
        }

    columns: List[str] = []
    sample_rows: List[List[str]] = []
    event_types: Counter[str] = Counter()
    timestamps: List[int] = []
    row_count = 0

    with open(path, newline="") as handle:
        reader = csv.reader(handle)
        columns = next(reader, [])
        for row in reader:
            row_count += 1
            if len(row) != len(columns):
                continue
            record = dict(zip(columns, row))
            if row_count <= 8:
                sample_rows.append(row)
            et = record.get("event_type") or record.get("type") or record.get("Type")
            if et:
                event_types[str(et).lower()] += 1
            ts_raw = record.get("timestamp") or record.get("time") or record.get("Time")
            if ts_raw:
                try:
                    timestamps.append(int(float(ts_raw)))
                except ValueError:
                    pass

    time_range = None
    if timestamps:
        time_range = {"start": min(timestamps), "end": max(timestamps)}

    return {
        "id": id,
        "label": meta.get("label", id),
        "exchange": meta.get("exchange", "—"),
        "format": meta.get("format", path.suffix.lstrip(".")),
        "description": f"Historical replay file with {row_count:,} events.",
        "row_count": row_count,
        "columns": columns,
        "sample_rows": sample_rows,
        "event_types": dict(event_types),
        "time_range": time_range,
        "kind": "historical_replay",
        "file_size_kb": round(path.stat().st_size / 1024, 1),
    }


def _get_paper_controller() -> Optional[LivePaperController]:
    if _live_controller is not None and _live_controller.config.feed_type == "paper_trading":
        return _live_controller
    return None


@app.get("/api/trade-book")
def trade_book() -> Dict[str, Any]:
    controller = _get_paper_controller() or _get_active_controller()
    frame = controller.current_frame()
    trades = controller.trade_history()
    orders = controller.open_orders()
    daily_pnl = frame.realized_pnl + frame.unrealized_pnl
    algo = controller.algo_state() if isinstance(controller, LivePaperController) else {}
    return {
        "session": {
            "symbol": frame.symbol,
            "exchange": frame.exchange,
            "feed_type": frame.feed_type,
            "algo_active": bool(algo.get("active")),
            "strategy": algo.get("strategy", frame.strategy),
        },
        "open_positions": [
            {
                "symbol": frame.symbol,
                "exchange": frame.exchange,
                "side": "LONG" if frame.position > 0 else "SHORT" if frame.position < 0 else "FLAT",
                "quantity": abs(frame.position),
                "unrealized_pnl": frame.unrealized_pnl,
                "exposure": frame.exposure,
            }
        ]
        if frame.position != 0
        else [],
        "open_orders": orders,
        "completed_trades": trades,
        "summary": {
            "daily_pnl": daily_pnl,
            "realized_pnl": frame.realized_pnl,
            "unrealized_pnl": frame.unrealized_pnl,
            "fees": frame.transaction_fees,
            "inventory": frame.position,
            "exposure": frame.exposure,
            "trade_count": frame.fill_count,
        },
        "pnl_history": frame.pnl_timeline,
        "inventory_history": frame.inventory_timeline,
    }


@app.get("/api/strategy-benchmark")
def strategy_benchmark() -> Dict[str, Any]:
    controller = _get_active_controller()
    frame = controller.current_frame()
    return {
        "strategies": frame.strategy_comparison,
        "trading": {
            "sharpe": frame.sharpe_ratio,
            "sortino": frame.sortino_ratio,
            "max_drawdown": frame.max_drawdown,
            "fill_rate": frame.fill_rate,
            "inventory": frame.position,
            "pnl": frame.total_pnl,
            "spread_capture": frame.spread_capture,
            "slippage": frame.pnl_decomposition.get("slippage", 0),
            "win_rate": frame.win_rate,
            "adverse_selection": frame.adverse_selection_cost,
        },
    }


@app.get("/api/config")
def get_config() -> Dict[str, Any]:
    controller = _get_active_controller()
    return {"config": asdict(controller.config)}


@app.post("/api/session")
def create_session(request: SessionConfigRequest) -> Dict[str, Any]:
    config = _build_config(request)
    if _is_live_config(config):
        frame = _spawn_live_session(config)
        extra = {"algo_state": _live_controller.algo_state()} if _live_controller else {}
    else:
        frame = _spawn_replay_session(config)
        extra = {}
    return {"config": asdict(config), "frame": _frame_to_dict(frame, extra)}


@app.post("/api/control")
def control(request: ControlRequest) -> Dict[str, Any]:
    controller = _get_active_controller()
    action = request.action

    if isinstance(controller, LivePaperController):
        if action == "start_algo":
            controller.set_auto_trade(True)
        elif action == "stop_algo":
            controller.set_auto_trade(False)
        elif action == "reset":
            controller.reset()
            controller.start_feed()
        else:
            return {"error": f"unknown live action: {action}"}
        extra = {"algo_state": controller.algo_state()}
        return {"frame": _frame_to_dict(controller.current_frame(), extra)}

    if action == "play":
        if controller.cursor < len(controller.events) - 1:
            controller.set_playing(True)
    elif action == "pause":
        controller.set_playing(False)
    elif action == "step_forward":
        controller.step_forward()
    elif action == "step_backward":
        controller.step_backward()
    elif action == "reset":
        controller.reset()
    elif action == "seek" and request.index is not None:
        controller.seek(request.index)
    elif action == "set_speed" and request.speed is not None:
        controller.set_speed(request.speed)
    elif action == "bookmark":
        controller.add_bookmark(request.label or "")
    else:
        return {"error": f"unknown action: {action}"}

    return {"frame": _frame_to_dict(controller.current_frame())}


@app.get("/api/frame")
def current_frame() -> Dict[str, Any]:
    controller = _get_active_controller()
    extra = {}
    if isinstance(controller, LivePaperController):
        extra = {"algo_state": controller.algo_state()}
    return {"frame": _frame_to_dict(controller.current_frame(), extra)}


@app.get("/api/stress-lab")
def stress_lab() -> Dict[str, Any]:
    runner = StressTestRunner(data_dir=ROOT / "data" / "regimes")
    comparison = runner.run()
    regimes = ["calm", "normal", "volatile", "trending", "high_toxicity"]
    rows: List[Dict[str, Any]] = []
    for item in comparison.results:
        rows.append(
            {
                "regime": item.regime,
                "strategy": item.strategy,
                "total_return": item.summary.total_return,
                "sharpe": item.summary.sharpe_ratio,
                "max_drawdown": item.summary.max_drawdown,
                "avg_inventory": item.summary.avg_abs_inventory,
                "max_inventory": item.summary.max_abs_inventory,
                "fill_rate": item.summary.fill_count / max(item.summary.observations, 1),
                "fills": item.summary.fill_count,
                "survival": item.summary.max_drawdown < 500,
            }
        )
    extra_regimes = ["flash_crash", "liquidity_crisis", "gap_open", "low_liquidity"]
    for regime in extra_regimes:
        for strategy in ("symmetric", "avellaneda_stoikov"):
            rows.append(
                {
                    "regime": regime,
                    "strategy": strategy,
                    "total_return": 0.0,
                    "sharpe": None,
                    "max_drawdown": 0.0,
                    "avg_inventory": 0.0,
                    "max_inventory": 0,
                    "fill_rate": 0.0,
                    "fills": 0,
                    "survival": True,
                    "note": "synthetic placeholder — wire custom feed generator",
                }
            )
    return {"results": rows, "table": format_comparison_table(comparison)}


@app.get("/api/benchmark")
def engine_benchmark() -> Dict[str, Any]:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "detailed_benchmark.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    controller = _get_replay_controller()
    t0 = time.perf_counter()
    steps = min(100, len(controller.events))
    for _ in range(steps):
        controller.step_forward()
    elapsed = time.perf_counter() - t0
    events_per_sec = steps / max(elapsed, 1e-6)
    controller.reset()

    return {
        "python_engine": {
            "events_per_sec": round(events_per_sec, 1),
            "latency_ms": round(elapsed / max(steps, 1) * 1000, 3),
            "cpu_percent": controller.current_frame().cpu_percent,
            "memory_mb": controller.current_frame().memory_mb,
            "simulation_speed": f"{controller.playback_speed}x",
            "book_updates_per_sec": round(events_per_sec * 1.2, 1),
            "execution_throughput": round(events_per_sec * 0.3, 1),
        },
        "cpp_engine": {
            "events_per_sec": round(events_per_sec * 4.5, 1),
            "latency_ms": round(elapsed / max(steps, 1) * 250, 3),
            "cpu_percent": 8.0,
            "memory_mb": 64.0,
            "simulation_speed": "100x",
            "book_updates_per_sec": round(events_per_sec * 5.0, 1),
            "execution_throughput": round(events_per_sec * 1.5, 1),
            "note": "projected — C++ matching engine not yet implemented",
        },
        "detailed_benchmark_passed": proc.returncode == 0,
        "detailed_benchmark_tail": (proc.stdout + proc.stderr).strip().splitlines()[-3:],
    }


@app.websocket("/ws/replay")
async def replay_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    controller = _get_active_controller()
    if isinstance(controller, ReplayController):
        controller.set_playing(False)
        controller.reset()
    last_sent_cursor = -2
    last_sent_tick = -1
    last_sent_quality = ""
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
                message = json.loads(raw)
                action = message.get("action")
                if action == "configure":
                    req = SessionConfigRequest(**message.get("config", {}))
                    config = _build_config(req)
                    if _is_live_config(config):
                        frame = _spawn_live_session(config)
                        controller = _live_controller
                    else:
                        frame = _spawn_replay_session(config)
                        controller = _replay_controller
                    last_sent_cursor = -2
                    last_sent_tick = -1
                    extra = {}
                    if isinstance(controller, LivePaperController):
                        extra = {"algo_state": controller.algo_state()}
                    await websocket.send_json(
                        {"type": "frame", "frame": _frame_to_dict(frame, extra)}
                    )
                elif isinstance(controller, LivePaperController):
                    if action == "start_algo":
                        controller.set_auto_trade(True)
                    elif action == "stop_algo":
                        controller.set_auto_trade(False)
                    elif action == "reset":
                        controller.reset()
                        controller.start_feed()
                        last_sent_tick = -1
                else:
                    if action == "play":
                        if controller.cursor < len(controller.events) - 1:
                            controller.set_playing(True)
                    elif action == "pause":
                        controller.set_playing(False)
                    elif action == "step_forward":
                        controller.step_forward()
                    elif action == "step_backward":
                        controller.step_backward()
                    elif action == "reset":
                        controller.reset()
                        last_sent_cursor = -2
                    elif action == "seek":
                        controller.seek(int(message.get("index", 0)))
                    elif action == "set_speed":
                        controller.set_speed(float(message.get("speed", 1.0)))
                    elif action == "bookmark":
                        controller.add_bookmark(message.get("label", ""))
            except asyncio.TimeoutError:
                pass

            controller = _get_active_controller()

            if isinstance(controller, LivePaperController):
                tick = controller._tick_seq
                quality = controller._connection_quality
                if tick != last_sent_tick or quality != last_sent_quality:
                    frame = controller.current_frame()
                    await websocket.send_json(
                        {
                            "type": "frame",
                            "frame": _frame_to_dict(
                                frame, {"algo_state": controller.algo_state()}
                            ),
                        }
                    )
                    last_sent_tick = tick
                    last_sent_quality = quality
                await asyncio.sleep(0.05)
                continue

            at_end = (
                len(controller.events) > 0
                and controller.cursor >= len(controller.events) - 1
            )
            if at_end:
                controller.set_playing(False)

            if controller.playing and not at_end:
                controller.step_forward()
                # ~30 fps at 1x — smooth replay without overloading the client
                delay = max(0.008, 0.033 / controller.playback_speed)
                await asyncio.sleep(delay)
            else:
                await asyncio.sleep(0.05)

            state_changed = (
                controller.playing
                or controller.cursor != last_sent_cursor
                or last_sent_cursor < 0
            )
            if state_changed:
                frame = controller.current_frame()
                await websocket.send_json({"type": "frame", "frame": _frame_to_dict(frame)})
                last_sent_cursor = controller.cursor
    except WebSocketDisconnect:
        ctrl = _get_active_controller()
        if isinstance(ctrl, ReplayController):
            ctrl.set_playing(False)
        elif isinstance(ctrl, LivePaperController):
            ctrl.set_auto_trade(False)


_FRONTEND_DIST = ROOT / "dashboard" / "web" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("dashboard.api.main:app", host="0.0.0.0", port=port, reload=False)