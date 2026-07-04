from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol

from mm_engine.feed.events import MarketEvent
from mm_engine.order_book import OrderBook


@dataclass(frozen=True)
class Quote:
    bid_price: float
    ask_price: float
    quote_size: int


class QuotingStrategy(Protocol):
    def should_requote(self, event: MarketEvent, book: OrderBook) -> bool:
        ...

    def compute_quote(self, book: OrderBook, position: int) -> Optional[Quote]:
        ...

    def bid_allowed(self, position: int) -> bool:
        ...

    def ask_allowed(self, position: int) -> bool:
        ...