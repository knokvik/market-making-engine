from pathlib import Path

from mm_engine.simulation.config import SimulationConfig, TransactionCostConfig
from mm_engine.stress import REGIMES, StressTestRunner, generate_regime_feed
from mm_engine.stress.runner import format_comparison_table


def test_generate_regime_feeds_have_expected_event_counts():
    for name, spec in REGIMES.items():
        events = generate_regime_feed(spec, seed=11)
        assert len(events) >= spec.event_count


def test_stress_runner_covers_three_regimes_and_two_strategies(tmp_path: Path):
    runner = StressTestRunner(
        data_dir=tmp_path,
        simulation=SimulationConfig(
            costs=TransactionCostConfig(maker_fee_bps=1.0, taker_fee_bps=2.0)
        ),
        half_spread=0.02,
        quote_size=5,
    )
    comparison = runner.run()
    assert len(comparison.results) == 6
    regimes = {item.regime for item in comparison.results}
    strategies = {item.strategy for item in comparison.results}
    assert regimes == {"calm", "normal", "volatile"}
    assert strategies == {"symmetric", "avellaneda_stoikov"}


def test_format_comparison_table_renders_rows():
    runner = StressTestRunner(data_dir=Path("/tmp/mm-stress-test"))
    comparison = runner.run(["calm"])
    table = format_comparison_table(comparison)
    assert "calm" in table
    assert "symmetric" in table
    assert "avellaneda_stoikov" in table