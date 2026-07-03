from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from mm_engine.types import Side


class EventType(Enum):
    ADD = "add"
    CANCEL = "cancel"
    PARTIAL_CANCEL = "partial_cancel"
    EXECUTION = "execution"


@dataclass(frozen=True)
class MarketEvent:
    """Normalized tick event for replay through the matching engine."""

    timestamp: int
    event_type: EventType
    order_id: int
    side: Optional[Side] = None
    price: Optional[float] = None
    quantity: Optional[int] = None