from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, Iterator, TextIO, Union

from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.types import Side

PathLike = Union[str, Path]


def load_lobster_messages(source: Union[PathLike, TextIO]) -> Iterator[MarketEvent]:
    """Parse a LOBSTER message file into normalized market events.

    Expected columns (no header):
    Time, Type, Order ID, Size, Price, Direction

    LOBSTER types handled:
    1 = new limit order, 2 = partial cancel, 3 = total cancel,
    4 = visible execution, 5 = hidden execution
    """
    if isinstance(source, (str, Path)):
        with open(source, newline="") as handle:
            yield from _parse_lobster_rows(csv.reader(handle))
    else:
        yield from _parse_lobster_rows(csv.reader(source))


def _parse_lobster_rows(rows: Iterable[list[str]]) -> Iterator[MarketEvent]:
    for row in rows:
        if not row or row[0].startswith("#"):
            continue
        if len(row) < 6:
            raise ValueError(f"invalid LOBSTER row: {row}")

        timestamp = _to_timestamp(row[0])
        event_type = int(row[1])
        order_id = int(row[2])
        size = int(row[3])
        price = float(row[4])
        direction = int(row[5])

        if event_type == 1:
            side = Side.BID if direction > 0 else Side.ASK
            yield MarketEvent(
                timestamp=timestamp,
                event_type=EventType.ADD,
                order_id=order_id,
                side=side,
                price=price,
                quantity=size,
            )
        elif event_type == 2:
            yield MarketEvent(
                timestamp=timestamp,
                event_type=EventType.PARTIAL_CANCEL,
                order_id=order_id,
                quantity=size,
            )
        elif event_type == 3:
            yield MarketEvent(
                timestamp=timestamp,
                event_type=EventType.CANCEL,
                order_id=order_id,
            )
        elif event_type in (4, 5):
            yield MarketEvent(
                timestamp=timestamp,
                event_type=EventType.EXECUTION,
                order_id=order_id,
                price=price,
                quantity=size,
            )
        else:
            continue


def _to_timestamp(value: str) -> int:
    """Convert LOBSTER seconds-from-midnight to integer nanoseconds."""
    seconds = float(value)
    return int(round(seconds * 1_000_000_000))