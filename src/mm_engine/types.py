from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Side(Enum):
    BID = "bid"
    ASK = "ask"

    @property
    def opposite(self) -> Side:
        return Side.ASK if self is Side.BID else Side.BID


@dataclass(frozen=True)
class Order:
    order_id: int
    side: Side
    price: float
    quantity: int
    timestamp: int = 0


@dataclass(frozen=True)
class Fill:
    """A single match against one resting order."""

    maker_order_id: int
    taker_order_id: int
    price: float
    quantity: int
    side: Side
    timestamp: int = 0


@dataclass(frozen=True)
class Trade:
    """Convenience view of a completed match."""

    price: float
    quantity: int
    aggressor_side: Side
    timestamp: int = 0