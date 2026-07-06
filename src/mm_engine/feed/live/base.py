from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, List, Optional, Tuple


@dataclass
class FeedHealth:
    connected: bool = False
    ping_ms: float = 0.0
    events_per_sec: float = 0.0
    connection_quality: str = "disconnected"
    packet_loss_pct: float = 0.0
    last_error: str = ""


@dataclass
class LiveBookSnapshot:
    timestamp_ns: int
    symbol: str
    exchange: str
    bids: List[Tuple[float, float]] = field(default_factory=list)
    asks: List[Tuple[float, float]] = field(default_factory=list)
    last_price: Optional[float] = None
    last_qty: float = 0.0
    last_side: Optional[str] = None


class LiveFeedAdapter(ABC):
    def __init__(self, symbol: str, exchange: str) -> None:
        self.symbol = symbol
        self.exchange = exchange
        self.health = FeedHealth()

    @abstractmethod
    async def connect(self) -> None:
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        ...

    @abstractmethod
    async def snapshots(self) -> AsyncIterator[LiveBookSnapshot]:
        ...


def create_live_adapter(
    *,
    asset_class: str,
    symbol: str,
    exchange: str,
) -> LiveFeedAdapter:
    ex = exchange.lower()
    if asset_class == "stock":
        from mm_engine.feed.live.alpaca import AlpacaFeedAdapter

        return AlpacaFeedAdapter(symbol=symbol, exchange=exchange or "Alpaca")
    if "bybit" in ex:
        from mm_engine.feed.live.binance import BinanceFeedAdapter

        return BinanceFeedAdapter(symbol=symbol, exchange="Bybit", stream_host="stream.bybit.com")
    if "okx" in ex:
        from mm_engine.feed.live.binance import BinanceFeedAdapter

        return BinanceFeedAdapter(symbol=symbol, exchange="OKX")
    if "coinbase" in ex:
        from mm_engine.feed.live.binance import BinanceFeedAdapter

        return BinanceFeedAdapter(symbol=symbol, exchange="Coinbase")
    from mm_engine.feed.live.binance import BinanceFeedAdapter

    return BinanceFeedAdapter(symbol=symbol, exchange=exchange or "Binance")