from __future__ import annotations

import csv
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, List

from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.types import Side


@dataclass(frozen=True)
class RegimeSpec:
    name: str
    tick_volatility: float
    event_count: int = 60
    mid_start: float = 100.0
    spread: float = 0.10
    trade_probability: float = 0.20


REGIMES: Dict[str, RegimeSpec] = {
    "calm": RegimeSpec(name="calm", tick_volatility=0.01, trade_probability=0.10),
    "normal": RegimeSpec(name="normal", tick_volatility=0.05, trade_probability=0.20),
    "volatile": RegimeSpec(name="volatile", tick_volatility=0.15, trade_probability=0.35),
}


def generate_regime_feed(spec: RegimeSpec, *, seed: int = 7) -> List[MarketEvent]:
    """Build a synthetic event stream with regime-specific price dynamics."""
    rng = random.Random(seed)
    events: List[MarketEvent] = []
    mid = spec.mid_start
    order_id = 1
    timestamp = 1_000

    for _ in range(spec.event_count):
        shock = rng.gauss(0.0, spec.tick_volatility)
        mid = max(50.0, mid * (1.0 + shock))
        bid = round(mid - spec.spread / 2.0, 4)
        ask = round(mid + spec.spread / 2.0, 4)

        events.append(
            MarketEvent(
                timestamp=timestamp,
                event_type=EventType.ADD,
                order_id=order_id,
                side=Side.BID,
                price=bid,
                quantity=rng.randint(5, 20),
            )
        )
        order_id += 1
        timestamp += 100

        events.append(
            MarketEvent(
                timestamp=timestamp,
                event_type=EventType.ADD,
                order_id=order_id,
                side=Side.ASK,
                price=ask,
                quantity=rng.randint(5, 20),
            )
        )
        order_id += 1
        timestamp += 100

        if rng.random() < spec.trade_probability:
            aggressor = Side.BID if rng.random() < 0.5 else Side.ASK
            price = ask if aggressor is Side.BID else bid
            events.append(
                MarketEvent(
                    timestamp=timestamp,
                    event_type=EventType.ADD,
                    order_id=order_id,
                    side=aggressor,
                    price=price,
                    quantity=rng.randint(1, 8),
                )
            )
            order_id += 1
            timestamp += 100

    return events


def write_regime_csv(spec: RegimeSpec, path: Path, *, seed: int = 7) -> None:
    events = generate_regime_feed(spec, seed=seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["timestamp", "event_type", "order_id", "side", "price", "quantity"])
        for event in events:
            writer.writerow(
                [
                    event.timestamp,
                    event.event_type.value,
                    event.order_id,
                    event.side.value if event.side else "",
                    event.price if event.price is not None else "",
                    event.quantity if event.quantity is not None else "",
                ]
            )


def load_or_generate_regime(name: str, data_dir: Path) -> Iterator[MarketEvent]:
    spec = REGIMES[name]
    csv_path = data_dir / f"{name}.csv"
    if not csv_path.exists():
        write_regime_csv(spec, csv_path)
    from mm_engine.feed.replay import load_csv_feed

    return load_csv_feed(csv_path)