from __future__ import annotations

import asyncio
import json
import os
import time
import urllib.request
from typing import AsyncIterator, List, Optional, Tuple

from mm_engine.feed.live.base import FeedHealth, LiveBookSnapshot, LiveFeedAdapter
from mm_engine.feed.live.yahoo import fetch_yahoo_quote


def _synthetic_book(mid: float, spread_bps: float = 5.0) -> tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    half = mid * (spread_bps / 10_000.0)
    bids = []
    asks = []
    for i in range(10):
        bp = mid - half - i * half * 0.5
        ap = mid + half + i * half * 0.5
        qty = max(1.0, 100.0 - i * 8)
        bids.append((round(bp, 4), qty))
        asks.append((round(ap, 4), qty))
    return bids, asks


class AlpacaFeedAdapter(LiveFeedAdapter):
    """US stock quotes via Alpaca REST poll (paper-safe, no order routing)."""

    def __init__(self, symbol: str, exchange: str = "Alpaca") -> None:
        super().__init__(symbol=symbol.upper(), exchange=exchange)
        self._running = False
        self._api_key = os.environ.get("ALPACA_API_KEY", "")
        self._api_secret = os.environ.get("ALPACA_API_SECRET", "")
        self._tick_count = 0
        self._tick_window_start = time.perf_counter()
        self._is_demo = False

    async def connect(self) -> None:
        self._running = True
        self._is_demo = False
        self.health = FeedHealth(connected=True, ping_ms=12.0, connection_quality="good")

    async def disconnect(self) -> None:
        self._running = False
        self.health = FeedHealth(connected=False, connection_quality="disconnected")

    def _build_snapshot(self, bid: float, ask: float, mid: float, last_mid: float | None) -> LiveBookSnapshot:
        bids, asks = _synthetic_book(mid)
        if bids:
            bids[0] = (bid, bids[0][1])
        if asks:
            asks[0] = (ask, asks[0][1])
        last_side = "buy" if last_mid is None or mid >= last_mid else "sell"
        return LiveBookSnapshot(
            timestamp_ns=time.time_ns(),
            symbol=self.symbol,
            exchange=self.exchange,
            bids=bids,
            asks=asks,
            last_price=mid,
            last_qty=1.0,
            last_side=last_side,
        )

    async def prefetch_snapshot(self) -> Optional[LiveBookSnapshot]:
        bid, ask, mid = await asyncio.to_thread(self._fetch_quote)
        return self._build_snapshot(bid, ask, mid, None)

    def _fetch_alpaca_quote(self, sym: str) -> tuple[float, float, float] | None:
        if not (self._api_key and self._api_secret):
            return None
        for endpoint in ("quotes/latest", "trades/latest"):
            url = f"https://data.alpaca.markets/v2/stocks/{sym}/{endpoint}"
            req = urllib.request.Request(url)
            req.add_header("APCA-API-KEY-ID", self._api_key)
            req.add_header("APCA-API-SECRET-KEY", self._api_secret)
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                if endpoint.startswith("quotes"):
                    q = data.get("quote", data)
                    bid = float(q.get("bp") or q.get("bid_price") or 0)
                    ask = float(q.get("ap") or q.get("ask_price") or 0)
                    if bid > 0 and ask > 0:
                        return bid, ask, (bid + ask) / 2.0
                else:
                    t = data.get("trade", data)
                    px = float(t.get("p") or t.get("price") or 0)
                    if px > 0:
                        half = px * 0.00015
                        return px - half, px + half, px
            except Exception as exc:
                self.health.last_error = str(exc)
        return None

    def _fetch_quote(self) -> tuple[float, float, float]:
        """Return bid, ask, mid — Alpaca → Yahoo → synthetic demo."""
        sym = self.symbol

        live = self._fetch_alpaca_quote(sym)
        if live:
            self._is_demo = False
            self.health.connection_quality = "good"
            return live

        yahoo = fetch_yahoo_quote(sym)
        if yahoo:
            self._is_demo = False
            self.health.connection_quality = "good"
            return yahoo.bid, yahoo.ask, yahoo.mid

        self._is_demo = True
        self.health.connection_quality = "demo"
        base = {
            "AAPL": 228.0,
            "MSFT": 420.0,
            "GOOGL": 175.0,
            "TSLA": 342.0,
            "NVDA": 195.0,
            "AMZN": 205.0,
            "META": 590.0,
            "SPY": 595.0,
        }.get(sym, 100.0)
        t = time.time()
        mid = base * (1.0 + 0.001 * (t % 10 - 5) / 5.0)
        spread = mid * 0.0002
        return mid - spread / 2, mid + spread / 2, mid

    async def snapshots(self) -> AsyncIterator[LiveBookSnapshot]:
        if not self._running:
            await self.connect()

        last_mid: float | None = None
        while self._running:
            t0 = time.perf_counter()
            bid, ask, mid = await asyncio.to_thread(self._fetch_quote)
            self.health.ping_ms = (time.perf_counter() - t0) * 1000
            self._record_tick()
            yield self._build_snapshot(bid, ask, mid, last_mid)
            last_mid = mid
            await asyncio.sleep(0.35)

    def _record_tick(self) -> None:
        self._tick_count += 1
        elapsed = time.perf_counter() - self._tick_window_start
        if elapsed >= 1.0:
            self.health.events_per_sec = self._tick_count / elapsed
            self._tick_count = 0
            self._tick_window_start = time.perf_counter()