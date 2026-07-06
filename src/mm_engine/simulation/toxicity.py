from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Deque

from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.types import Side


@dataclass
class ToxicityMonitor:
    """Simplified order-flow toxicity signal (VPIN-style volume imbalance)."""

    window: int = 20
    _buy_volume: Deque[int] = field(default_factory=deque)
    _sell_volume: Deque[int] = field(default_factory=deque)

    def on_market_event(self, event: MarketEvent) -> None:
        if event.event_type is not EventType.ADD:
            return
        if event.side is None or event.quantity is None or event.price is None:
            return
        # Treat aggressive-looking market orders at the touch as informed flow proxy.
        if event.side is Side.BID:
            self._buy_volume.append(event.quantity)
            if len(self._buy_volume) > self.window:
                self._buy_volume.popleft()
        else:
            self._sell_volume.append(event.quantity)
            if len(self._sell_volume) > self.window:
                self._sell_volume.popleft()

    def level(self) -> float:
        """Return toxicity in [0, 1] from rolling buy/sell volume imbalance."""
        buy_total = sum(self._buy_volume)
        sell_total = sum(self._sell_volume)
        total = buy_total + sell_total
        if total == 0:
            return 0.0
        imbalance = abs(buy_total - sell_total) / total
        return min(max(imbalance, 0.0), 1.0)