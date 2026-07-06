from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator, List, Optional, Tuple

from mm_engine.feed.live.base import FeedHealth, LiveBookSnapshot, LiveFeedAdapter

OUR_ORDER_FLOOR = 10_000_000


class BinanceFeedAdapter(LiveFeedAdapter):
    """Binance (or Binance-compatible) depth + aggTrade websocket."""

    def __init__(
        self,
        symbol: str,
        exchange: str = "Binance",
        stream_host: str = "stream.binance.com:9443",
    ) -> None:
        super().__init__(symbol=symbol.upper(), exchange=exchange)
        self._stream_host = stream_host
        self._ws = None
        self._running = False
        self._tick_count = 0
        self._tick_window_start = time.perf_counter()

    async def connect(self) -> None:
        import websockets

        stream = f"{self.symbol.lower()}@depth20@100ms/{self.symbol.lower()}@aggTrade"
        url = f"wss://{self._stream_host}/stream?streams={stream}"
        self._ws = await websockets.connect(url, ping_interval=20, ping_timeout=20)
        self._running = True
        self.health = FeedHealth(connected=True, ping_ms=4.0, connection_quality="good")

    async def disconnect(self) -> None:
        self._running = False
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        self.health = FeedHealth(connected=False, connection_quality="disconnected")

    async def prefetch_snapshot(self) -> Optional[LiveBookSnapshot]:
        """Block briefly for first depth update so live chart isn't empty on connect."""
        if self._ws is None:
            await self.connect()
        assert self._ws is not None
        try:
            raw = await asyncio.wait_for(self._ws.recv(), timeout=8.0)
            msg = json.loads(raw)
            data = msg.get("data", msg)
            raw_bids = data.get("bids") or data.get("b") or []
            raw_asks = data.get("asks") or data.get("a") or []
            bids = [(float(p), float(q)) for p, q in raw_bids if float(q) > 0][:20]
            asks = [(float(p), float(q)) for p, q in raw_asks if float(q) > 0][:20]
            if bids and asks:
                return LiveBookSnapshot(
                    timestamp_ns=time.time_ns(),
                    symbol=self.symbol,
                    exchange=self.exchange,
                    bids=bids,
                    asks=asks,
                )
        except Exception:
            pass
        return None

    async def snapshots(self) -> AsyncIterator[LiveBookSnapshot]:
        if self._ws is None:
            await self.connect()

        bids: List[Tuple[float, float]] = []
        asks: List[Tuple[float, float]] = []
        last_price: float | None = None
        last_qty = 0.0
        last_side: str | None = None

        assert self._ws is not None
        while self._running:
            try:
                raw = await asyncio.wait_for(self._ws.recv(), timeout=30.0)
                msg = json.loads(raw)
                data = msg.get("data", msg)
                event = data.get("e", "")

                if "bids" in data or "b" in data:
                    raw_bids = data.get("bids") or data.get("b") or []
                    raw_asks = data.get("asks") or data.get("a") or []
                    bids = [(float(p), float(q)) for p, q in raw_bids if float(q) > 0][:20]
                    asks = [(float(p), float(q)) for p, q in raw_asks if float(q) > 0][:20]
                elif event == "aggTrade" or ("p" in data and "q" in data and "m" in data):
                    last_price = float(data.get("p", last_price or 0))
                    last_qty = float(data.get("q", 0))
                    last_side = "sell" if data.get("m") else "buy"

                if bids and asks:
                    now_ns = time.time_ns()
                    self._record_tick()
                    yield LiveBookSnapshot(
                        timestamp_ns=now_ns,
                        symbol=self.symbol,
                        exchange=self.exchange,
                        bids=bids,
                        asks=asks,
                        last_price=last_price,
                        last_qty=last_qty,
                        last_side=last_side,
                    )
            except asyncio.TimeoutError:
                self.health.last_error = "feed timeout"
                continue
            except Exception as exc:
                self.health.connected = False
                self.health.connection_quality = "critical"
                self.health.last_error = str(exc)
                break

    def _record_tick(self) -> None:
        self._tick_count += 1
        elapsed = time.perf_counter() - self._tick_window_start
        if elapsed >= 1.0:
            self.health.events_per_sec = self._tick_count / elapsed
            self._tick_count = 0
            self._tick_window_start = time.perf_counter()