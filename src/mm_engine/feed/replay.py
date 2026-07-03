from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, Iterator, TextIO, Union

from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.types import Side

PathLike = Union[str, Path]


def load_csv_feed(source: Union[PathLike, TextIO]) -> Iterator[MarketEvent]:
    """Load a simple CSV feed with header:
    timestamp,event_type,order_id,side,price,quantity
    """
    if isinstance(source, (str, Path)):
        with open(source, newline="") as handle:
            yield from _parse_csv_rows(csv.DictReader(handle))
    else:
        yield from _parse_csv_rows(csv.DictReader(source))


def _parse_csv_rows(rows: Iterable[dict[str, str]]) -> Iterator[MarketEvent]:
    for row in rows:
        event_type = EventType(row["event_type"].strip().lower())
        side_value = row.get("side", "").strip().lower()
        side = None
        if side_value:
            side = Side.BID if side_value in {"bid", "buy", "b"} else Side.ASK

        price = row.get("price", "").strip()
        quantity = row.get("quantity", "").strip()

        yield MarketEvent(
            timestamp=int(row["timestamp"]),
            event_type=event_type,
            order_id=int(row["order_id"]),
            side=side,
            price=float(price) if price else None,
            quantity=int(quantity) if quantity else None,
        )