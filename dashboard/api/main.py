#!/usr/bin/env python3
"""FastAPI + WebSocket server for the Market Making Engine dashboard."""
from __future__ import annotations

import asyncio
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from mm_engine.replay.session import ReplayConfig, ReplayController, list_datasets

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


class ControlRequest(BaseModel):
    action: str = Field(..., description="play|pause|step_forward|step_backward|reset|seek|set_speed")
    index: Optional[int] = None
    speed: Optional[float] = None


app = FastAPI(title="Market Making Engine Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_controller: Optional[ReplayController] = None


def _get_controller() -> ReplayController:
    global _controller
    if _controller is None:
        _controller = ReplayController(ReplayConfig(), root=ROOT)
        _controller.reset()
    return _controller


def _frame_to_dict(frame) -> Dict[str, Any]:
    return asdict(frame)


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "mm-engine-dashboard"}


@app.get("/api/datasets")
def datasets() -> Dict[str, Any]:
    return {"datasets": list_datasets(ROOT)}


@app.get("/api/config")
def get_config() -> Dict[str, Any]:
    controller = _get_controller()
    return {"config": asdict(controller.config)}


@app.post("/api/session")
def create_session(request: SessionConfigRequest) -> Dict[str, Any]:
    global _controller
    regime = request.regime
    dataset = request.dataset
    if dataset.startswith("regime:"):
        regime = dataset.split(":", 1)[1]
        dataset = f"data/regimes/{regime}.csv"

    config = ReplayConfig(
        dataset=dataset,
        exchange=request.exchange,
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
    )
    _controller = ReplayController(config, root=ROOT)
    frame = _controller.reset()
    return {"config": asdict(config), "frame": _frame_to_dict(frame)}


@app.post("/api/control")
def control(request: ControlRequest) -> Dict[str, Any]:
    controller = _get_controller()
    action = request.action

    if action == "play":
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
    else:
        return {"error": f"unknown action: {action}"}

    return {"frame": _frame_to_dict(controller.current_frame())}


@app.get("/api/frame")
def current_frame() -> Dict[str, Any]:
    controller = _get_controller()
    return {"frame": _frame_to_dict(controller.current_frame())}


@app.websocket("/ws/replay")
async def replay_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    controller = _get_controller()
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
                message = json.loads(raw)
                action = message.get("action")
                if action == "play":
                    controller.set_playing(True)
                elif action == "pause":
                    controller.set_playing(False)
                elif action == "step_forward":
                    controller.step_forward()
                elif action == "step_backward":
                    controller.step_backward()
                elif action == "reset":
                    controller.reset()
                elif action == "seek":
                    controller.seek(int(message.get("index", 0)))
                elif action == "set_speed":
                    controller.set_speed(float(message.get("speed", 1.0)))
                elif action == "configure":
                    req = SessionConfigRequest(**message.get("config", {}))
                    create_session(req)
                    controller = _get_controller()
            except asyncio.TimeoutError:
                pass

            if controller.playing and controller.cursor < len(controller.events) - 1:
                controller.step_forward()
                delay = max(0.01, 0.2 / controller.playback_speed)
                await asyncio.sleep(delay)

            frame = controller.current_frame()
            await websocket.send_json({"type": "frame", "frame": _frame_to_dict(frame)})
            await asyncio.sleep(0.05 if controller.playing else 0.15)
    except WebSocketDisconnect:
        controller.set_playing(False)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)