from __future__ import annotations

from dataclasses import dataclass
from typing import List

from mm_engine.types import Side


@dataclass(frozen=True)
class PendingQuote:
    activate_at: int
    side: Side
    price: float
    size: int


class QuoteLatencyQueue:
    """Hold quote updates until they become active after a latency delay."""

    def __init__(self) -> None:
        self._pending: List[PendingQuote] = []

    def schedule(self, *, activate_at: int, side: Side, price: float, size: int) -> None:
        self._pending.append(
            PendingQuote(
                activate_at=activate_at,
                side=side,
                price=price,
                size=size,
            )
        )

    def clear(self) -> None:
        self._pending.clear()

    def pop_ready(self, timestamp: int) -> List[PendingQuote]:
        ready = [quote for quote in self._pending if quote.activate_at <= timestamp]
        self._pending = [quote for quote in self._pending if quote.activate_at > timestamp]
        return sorted(ready, key=lambda quote: quote.activate_at)