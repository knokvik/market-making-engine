from pathlib import Path

from mm_engine.audit import run_implementation_audit
from mm_engine.backtest import BacktestEngine
from mm_engine.stress.regimes import load_or_generate_regime
from mm_engine.strategy import AvellanedaStoikovConfig, AvellanedaStoikovQuoter, SymmetricQuoter, SymmetricQuoterConfig


def test_implementation_audit_checklist_passes():
    events = list(load_or_generate_regime("normal", Path(__file__).resolve().parents[1] / "data" / "regimes"))
    result = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(AvellanedaStoikovConfig(gamma=0.15, quote_size=5))
    ).run(events)
    checks = run_implementation_audit(result.pnl_curve)
    assert all(check.passed for check in checks)


def test_as_avg_inventory_not_worse_than_symmetric_all_regimes():
    data_dir = Path(__file__).resolve().parents[1] / "data" / "regimes"
    for regime in ("calm", "normal", "volatile"):
        events = list(load_or_generate_regime(regime, data_dir))
        sym = BacktestEngine(
            strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5, max_inventory=50))
        ).run(events)
        as_result = BacktestEngine(
            strategy=AvellanedaStoikovQuoter(
                AvellanedaStoikovConfig(gamma=0.15, quote_size=5, max_inventory=50)
            )
        ).run(events)
        assert sym.summary is not None and as_result.summary is not None
        assert as_result.summary.avg_abs_inventory <= sym.summary.avg_abs_inventory + 0.5


def test_pnl_decomposition_fields_present():
    events = list(load_or_generate_regime("calm", Path(__file__).resolve().parents[1] / "data" / "regimes"))
    result = BacktestEngine().run(events)
    assert result.summary is not None
    assert result.summary.spread_capture_pnl is not None
    assert result.summary.inventory_risk_pnl is not None
    assert result.summary.pnl_positive_steps >= 0