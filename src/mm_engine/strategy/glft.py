from __future__ import annotations

from typing import Optional

from mm_engine.feed.events import MarketEvent
from mm_engine.order_book import OrderBook
from mm_engine.strategy.base import Quote
from mm_engine.strategy.volatility import RollingVolatility


class GLFTQuoter:
    """GLFT-inspired quoter: vol-adjusted half-spread with inventory skew."""

    def __init__(
        self,
        *,
        gamma: float = 0.12,
        base_half_spread: float = 0.03,
        quote_size: int = 10,
        max_inventory: int = 100,
        vol_window: int = 20,
    ) -> None:
        self.gamma = gamma
        self.base_half_spread = base_half_spread
        self.quote_size = quote_size
        self.max_inventory = max_inventory
        self._vol = RollingVolatility(window=vol_window, default_sigma=0.02)
        self._last_mid: Optional[float] = None

    def should_requote(self, event: MarketEvent, book: OrderBook) -> bool:
        mid = book.mid_price
        if mid is None:
            return False
        if self._last_mid is None:
            return True
        return mid != self._last_mid

    def compute_quote(self, book: OrderBook, position: int) -> Optional[Quote]:
        mid = book.mid_price
        if mid is None or abs(position) >= self.max_inventory:
            return None
        if not self.bid_allowed(position) and not self.ask_allowed(position):
            return None

        sigma = self._vol.update(mid)
        vol_spread = self.base_half_spread * (1.0 + sigma * 25.0)
        skew = position * self.gamma * (sigma ** 2) * mid * 0.01
        reservation = mid - skew
        half = vol_spread + abs(position) * 0.001

        self._last_mid = mid
        return Quote(
            bid_price=reservation - half,
            ask_price=reservation + half,
            quote_size=self.quote_size,
        )

    def bid_allowed(self, position: int) -> bool:
        return position <= 0 and position > -self.max_inventory

    def ask_allowed(self, position: int) -> bool:
        return position >= 0 and position < self.max_inventory