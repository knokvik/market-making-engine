import pytest

from mm_engine.inventory import InventoryManager
from mm_engine.types import Fill, Side


def test_maker_bid_fill_increases_position():
    inventory = InventoryManager()
    fill = Fill(
        maker_order_id=10_000_001,
        taker_order_id=2,
        price=100.0,
        quantity=5,
        side=Side.ASK,
    )
    inventory.on_fill(fill, 10_000_001)
    assert inventory.position == 5
    assert inventory.state.cash == pytest.approx(-500.0)


def test_maker_ask_fill_decreases_position():
    inventory = InventoryManager()
    fill = Fill(
        maker_order_id=10_000_002,
        taker_order_id=3,
        price=101.0,
        quantity=4,
        side=Side.BID,
    )
    inventory.on_fill(fill, 10_000_002)
    assert inventory.position == -4
    assert inventory.state.cash == pytest.approx(404.0)


def test_mark_to_market_and_realized_pnl():
    inventory = InventoryManager()
    buy = Fill(10_000_001, 2, 100.0, 10, Side.ASK)
    sell = Fill(10_000_002, 3, 101.0, 10, Side.BID)
    inventory.on_fill(buy, 10_000_001)
    inventory.on_fill(sell, 10_000_002)
    assert inventory.position == 0
    assert inventory.state.realized_pnl == pytest.approx(10.0)
    assert inventory.mark_to_market(100.5) == pytest.approx(10.0)