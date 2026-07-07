from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional, Tuple

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
    # Convert log-return sigma to price units (sigma * mid) for AS formulas.
    sigma_in_price_units: bool = True
    max_quote_distance_pct: float = 0.15
    use_toxicity_widening: bool = True
    toxicity_widen_bps: float = 25.0
    competitive_quoting: bool = False
    max_spread_multiple: float = 1.0


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
        self._toxicity_level: float = 0.0

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

        sigma_log = (
            self._volatility.update(mid)
            if self.config.use_volatility_estimator
            else self.config.sigma
        )
        sigma = sigma_to_price_units(sigma_log, mid) if self.config.sigma_in_price_units else sigma_log
        tau = self._time_remaining()
        reservation, delta_bid, delta_ask = optimal_quote_offsets(
            mid,
            position,
            self.config.gamma,
            self.config.k,
            sigma,
            tau,
        )

        delta_bid, delta_ask = cap_deltas_to_book(
            delta_bid,
            delta_ask,
            book.spread,
            competitive=self.config.competitive_quoting,
            max_multiple=self.config.max_spread_multiple,
        )

        if self.config.use_toxicity_widening and self._toxicity_level > 0.0:
            padding = toxicity_spread_padding(
                self._toxicity_level,
                mid,
                self.config.toxicity_widen_bps,
            )
            delta_bid += padding
            delta_ask += padding

        bid_price = _clamp_to_mid(reservation - delta_bid, mid, self.config.max_quote_distance_pct)
        ask_price = _clamp_to_mid(reservation + delta_ask, mid, self.config.max_quote_distance_pct)
        if bid_price <= 0 or ask_price <= 0 or bid_price >= ask_price:
            return None

        self._last_mid = mid
        return Quote(
            bid_price=bid_price,
            ask_price=ask_price,
            quote_size=self.config.quote_size,
        )

    def bid_allowed(self, position: int) -> bool:
        # One-sided gate: stop buying while long (same discipline as baseline).
        return position <= 0 and position > -self.config.max_inventory

    def ask_allowed(self, position: int) -> bool:
        return position >= 0 and position < self.config.max_inventory

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

    def set_toxicity_level(self, level: float) -> None:
        self._toxicity_level = min(max(level, 0.0), 1.0)


def sigma_to_price_units(sigma_log: float, mid_price: float) -> float:
    """Map log-return volatility into price volatility for AS arithmetic formulas."""
    return max(sigma_log * mid_price, 1e-9)


def reservation_price(
    mid_price: float,
    inventory: int,
    gamma: float,
    sigma: float,
    time_remaining: float,
) -> float:
    """Skew reservation below mid when long, above mid when short."""
    inv_term = gamma * (sigma ** 2) * time_remaining
    return mid_price - inventory * inv_term


def optimal_quote_offsets(
    mid_price: float,
    inventory: int,
    gamma: float,
    k: float,
    sigma: float,
    time_remaining: float,
) -> Tuple[float, float, float]:
    """Full AS bid/ask offsets: widen bid and tighten ask when inventory is long."""
    inv_term = gamma * (sigma ** 2) * time_remaining
    intensity = (1.0 / gamma) * math.log(1.0 + gamma / k)
    delta_bid = intensity + ((2 * inventory + 1) / 2.0) * inv_term
    delta_ask = intensity - ((2 * inventory - 1) / 2.0) * inv_term
    reservation = reservation_price(mid_price, inventory, gamma, sigma, time_remaining)
    return reservation, delta_bid, delta_ask


def cap_deltas_to_book(
    delta_bid: float,
    delta_ask: float,
    book_spread: Optional[float],
    *,
    competitive: bool,
    max_multiple: float,
) -> Tuple[float, float]:
    """Cap average half-spread to book width while preserving inventory asymmetry."""
    if not competitive or book_spread is None or book_spread <= 0:
        return max(delta_bid, 1e-9), max(delta_ask, 1e-9)

    half_market = book_spread / 2.0
    cap = half_market * max(max_multiple, 0.05)
    avg_half = (delta_bid + delta_ask) / 2.0
    if avg_half <= cap * 3.0:
        return max(delta_bid, 1e-9), max(delta_ask, 1e-9)
    asymmetry = (delta_bid - delta_ask) / 2.0
    avg_half = min(max(avg_half, cap * 0.2), cap)
    delta_bid = max(avg_half + asymmetry, 1e-9)
    delta_ask = max(avg_half - asymmetry, 1e-9)
    return delta_bid, delta_ask


def toxicity_spread_padding(toxicity_level: float, mid_price: float, widen_bps: float) -> float:
    """Extra half-spread padding in price units when flow looks toxic."""
    clamped = min(max(toxicity_level, 0.0), 1.0)
    return mid_price * (widen_bps / 10_000.0) * clamped


def _clamp_to_mid(price: float, mid_price: float, max_distance_pct: float) -> float:
    lower = mid_price * (1.0 - max_distance_pct)
    upper = mid_price * (1.0 + max_distance_pct)
    return max(lower, min(upper, price))


def optimal_half_spread(
    gamma: float,
    k: float,
    sigma: float,
    time_remaining: float,
) -> float:
    """Symmetric half-spread at zero inventory (baseline reference only)."""
    inv_term = gamma * (sigma ** 2) * time_remaining
    intensity = (1.0 / gamma) * math.log(1.0 + gamma / k)
    return intensity + 0.5 * inv_term