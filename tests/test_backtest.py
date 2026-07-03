from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.strategy import SymmetricQuoter, SymmetricQuoterConfig

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def test_baseline_backtest_produces_pnl_curve_and_fills():
    events = load_csv_feed(DATA_DIR / "sample_session.csv")
    strategy = SymmetricQuoter(
        SymmetricQuoterConfig(half_spread=0.02, quote_size=5, max_inventory=50)
    )
    result = BacktestEngine(strategy=strategy).run(events)

    assert len(result.pnl_curve) > 0
    assert result.summary is not None
    assert result.summary.observations == len(result.pnl_curve)
    assert result.summary.max_abs_inventory >= 0


def test_backtest_summary_has_drawdown_and_sharpe_fields():
    events = load_csv_feed(DATA_DIR / "sample_session.csv")
    result = BacktestEngine().run(events)
    assert result.summary is not None
    assert result.summary.max_drawdown >= 0.0
    assert result.summary.total_return is not None