import pytest

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.inventory import InventoryManager
from mm_engine.order_book import OrderBook
from mm_engine.simulation.config import SimulationConfig, TransactionCostConfig
from mm_engine.simulation.costs import compute_transaction_cost
from mm_engine.simulation.latency import QuoteLatencyQueue
from mm_engine.strategy import SymmetricQuoter, SymmetricQuoterConfig
from mm_engine.types import Fill, Side

DATA_DIR = __import__("pathlib").Path(__file__).resolve().parents[1] / "data"


def test_compute_transaction_cost_scales_with_notional():
    fee = compute_transaction_cost(
        100.0,
        10,
        is_maker=True,
        config=TransactionCostConfig(maker_fee_bps=1.0),
    )
    assert fee == pytest.approx(0.1)


def test_inventory_applies_maker_fee_to_cash():
    inventory = InventoryManager()
    inventory._cost_config = TransactionCostConfig(maker_fee_bps=10.0, taker_fee_bps=20.0)
    fill = Fill(10_000_001, 2, 100.0, 5, Side.ASK)
    inventory.on_fill(fill, 10_000_001)
    assert inventory.state.transaction_costs == pytest.approx(0.5)
    assert inventory.state.cash == pytest.approx(-500.5)


def test_queue_position_blocks_back_of_line_fill():
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 8, order_id=1)
    book.add_limit_order(Side.BID, 100.0, 4, order_id=2)
    _, fills = book.add_limit_order(Side.ASK, 100.0, 5, order_id=3)
    assert sum(fill.quantity for fill in fills) == 5
    assert fills[0].maker_order_id == 1
    assert book.get_order(1) is not None
    assert book.get_order(1).quantity == 3
    assert book.get_order(2) is not None
    assert book.get_order(2).quantity == 4


def test_latency_queue_activates_only_after_delay():
    queue = QuoteLatencyQueue()
    queue.schedule(activate_at=5_000, side=Side.BID, price=99.5, size=10)
    assert queue.pop_ready(4_999) == []
    ready = queue.pop_ready(5_000)
    assert len(ready) == 1
    assert ready[0].price == 99.5


def test_backtest_with_fees_and_latency_runs():
    events = list(load_csv_feed(DATA_DIR / "sample_session.csv"))
    result = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5)),
        simulation=SimulationConfig(
            costs=TransactionCostConfig(maker_fee_bps=1.0, taker_fee_bps=2.0),
            quote_latency_ns=1_000,
        ),
    ).run(events)
    assert result.summary is not None
    assert result.summary.observations > 0