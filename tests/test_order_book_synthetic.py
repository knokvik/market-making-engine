"""End-to-end synthetic replay scenarios for Week 1 milestone."""

import pytest

from mm_engine import OrderBook, Side


def run_synthetic_session() -> dict:
    """Replay a scripted sequence and return summary stats."""
    book = OrderBook()
    events = [
        ("add", Side.BID, 99.8, 100, 1),
        ("add", Side.BID, 99.9, 50, 2),
        ("add", Side.ASK, 100.1, 80, 3),
        ("add", Side.ASK, 100.2, 40, 4),
        ("add", Side.BID, 100.1, 30, 5),  # crosses 10 @ 100.1
        ("cancel", 2, None, None, None),
        ("add", Side.ASK, 99.8, 25, 6),  # crosses 25 @ 99.8 bid after cancel
        ("market", Side.BID, 15, 7),
    ]

    fill_count = 0
    traded_volume = 0

    for event in events:
        kind = event[0]
        if kind == "add":
            _, side, price, qty, oid = event
            _, fills = book.add_limit_order(side, price, qty, order_id=oid)
        elif kind == "cancel":
            _, oid, *_ = event
            book.cancel_order(oid)
            continue
        elif kind == "market":
            _, side, qty, oid = event[0], event[1], event[2], event[3]
            _, fills = book.add_market_order(side, qty, order_id=oid)
        else:
            raise ValueError(kind)

        fill_count += len(fills)
        traded_volume += sum(f.quantity for f in fills)

    return {
        "best_bid": book.best_bid,
        "best_ask": book.best_ask,
        "spread": book.spread,
        "fill_count": fill_count,
        "traded_volume": traded_volume,
        "remaining_orders": book.order_count(),
        "bid_depth": book.depth(Side.BID, levels=3),
        "ask_depth": book.depth(Side.ASK, levels=3),
    }


def test_synthetic_replay_produces_expected_book_state():
    summary = run_synthetic_session()

    assert summary["best_bid"] == 99.8
    assert summary["best_ask"] == 100.1
    assert summary["spread"] == pytest.approx(0.3)
    assert summary["fill_count"] == 3
    assert summary["traded_volume"] == 70
    assert summary["remaining_orders"] == 3
    assert summary["bid_depth"] == [(99.8, 75)]
    assert summary["ask_depth"] == [(100.1, 35), (100.2, 40)]