from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from mm_engine.feed.events import MarketEvent
from mm_engine.order_book import OrderBook
from mm_engine.types import Side


@dataclass(frozen=True)
class SymmetricQuoterConfig:
    half_spread: float = 0.05
    quote_size: int = 10
    max_inventory: int = 100
    requote_on_mid_change: bool = True


@dataclass(frozen=True)
class Quote:
    bid_price: float
    ask_price: float
    quote_size: int


class SymmetricQuoter:
    """Baseline strategy: fixed half-spread around the mid-price."""

    def __init__(self, config: Optional[SymmetricQuoterConfig] = None) -> None:
        self.config = config or SymmetricQuoterConfig()
        self._last_mid: Optional[float] = None

    def should_requote(self, event: MarketEvent, book: OrderBook) -> bool:
        mid = book.mid_price
        if mid is None:
            return False
        if self._last_mid is None:
            return True
        if not self.config.requote_on_mid_change:
            return True
        return mid != self._last_mid

    def compute_quote(self, book: OrderBook, position: int) -> Optional[Quote]:
        mid = book.mid_price
        if mid is None:
            return None

        if abs(position) >= self.config.max_inventory:
            return None

        if not self.bid_allowed(position) and not self.ask_allowed(position):
            return None

        self._last_mid = mid
        return Quote(
            bid_price=mid - self.config.half_spread,
            ask_price=mid + self.config.half_spread,
            quote_size=self.config.quote_size,
        )

    def bid_allowed(self, position: int) -> bool:
        return position <= 0 and position < self.config.max_inventory

    def ask_allowed(self, position: int) -> bool:
        return position >= 0 and position > -self.config.max_inventory