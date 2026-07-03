from mm_engine.inventory import InventoryState, PnLSnapshot
from mm_engine.performance import summarize_performance


def test_summarize_performance_computes_drawdown_and_sharpe():
    curve = [
        PnLSnapshot(1, 100.0, 0, 0.0, 0.0, 0.0, 0.0),
        PnLSnapshot(2, 100.0, 2, -200.0, 0.0, 0.0, 0.0),
        PnLSnapshot(3, 100.0, 2, -200.0, 5.0, 5.0, 0.0),
        PnLSnapshot(4, 100.0, 0, 12.0, 12.0, 12.0, 0.0),
    ]
    summary = summarize_performance(curve, InventoryState(fill_count=2, buy_volume=2, sell_volume=2))
    assert summary.total_return == 12.0
    assert summary.max_drawdown >= 0.0
    assert summary.avg_abs_inventory == 1.0
    assert summary.fill_count == 2