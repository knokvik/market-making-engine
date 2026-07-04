from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from mm_engine.feed.events import MarketEvent
from mm_engine.order_book import OrderBook
from mm_engine.strategy.base import Quote
from mm_engine.strategy.volatility import RollingVolatility


@dataclass(frozen=True)
class AvellanedaStoikovConfig:
    gamma: float = 0.1
    k: float = 1.5
    sigma: float = 0.02
    time_horizon: float = 1.0
    quote_size: int = 10
    max_inventory: int = 100
    requote_on_mid_change: bool = True
    use_volatility_estimator: bool = True
    vol_window: int = 20
    session_start: Optional[int] = None
    session_end: Optional[int] = None


class AvellanedaStoikovQuoter:
    """Inventory-risk optimal quoting from Avellaneda & Stoikov (2008)."""

    def __init__(self, config: Optional[AvellanedaStoikovConfig] = None) -> None:
        self.config = config or AvellanedaStoikovConfig()
        self._last_mid: Optional[float] = None
        self._last_timestamp: Optional[int] = None
        self._session_start: Optional[int] = self.config.session_start
        self._session_end: Optional[int] = self.config.session_end
        self._volatility = RollingVolatility(
            window=self.config.vol_window,
            default_sigma=self.config.sigma,
        )

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

        sigma = self._volatility.update(mid) if self.config.use_volatility_estimator else self.config.sigma
        tau = self._time_remaining()
        reservation = reservation_price(mid, position, self.config.gamma, sigma, tau)
        half_spread = optimal_half_spread(self.config.gamma, self.config.k, sigma, tau)

        self._last_mid = mid
        return Quote(
            bid_price=reservation - half_spread,
            ask_price=reservation + half_spread,
            quote_size=self.config.quote_size,
        )

    def bid_allowed(self, position: int) -> bool:
        return position < self.config.max_inventory

    def ask_allowed(self, position: int) -> bool:
        return position > -self.config.max_inventory

    def _time_remaining(self) -> float:
        if self._last_timestamp is None or self._session_start is None or self._session_end is None:
            return self.config.time_horizon
        span = max(self._session_end - self._session_start, 1)
        remaining = max(self._session_end - self._last_timestamp, 0)
        return self.config.time_horizon * (remaining / span)

    def configure_session(self, session_start: int, session_end: int) -> None:
        self._session_start = session_start
        self._session_end = session_end

    def note_timestamp(self, timestamp: int) -> None:
        self._last_timestamp = timestamp


def reservation_price(
    mid_price: float,
    inventory: int,
    gamma: float,
    sigma: float,
    time_remaining: float,
) -> float:
    """Skew quotes away from inventory: long -> lower reservation price."""
    return mid_price - inventory * gamma * (sigma ** 2) * time_remaining


def optimal_half_spread(
    gamma: float,
    k: float,
    sigma: float,
    time_remaining: float,
) -> float:
    """Optimal half-spread from order-arrival intensity k and risk aversion."""
    intensity_term = (1.0 / (2.0 * gamma)) * math.log(1.0 + gamma / k)
    inventory_risk_term = 0.5 * gamma * (sigma ** 2) * time_remaining
    return intensity_term + inventory_risk_term