from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from mm_engine.backtest import BacktestEngine
from mm_engine.performance import PerformanceSummary
from mm_engine.simulation.config import SimulationConfig
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    SymmetricQuoter,
    SymmetricQuoterConfig,
)
from mm_engine.stress.regimes import REGIMES, load_or_generate_regime


@dataclass(frozen=True)
class StrategyRegimeResult:
    regime: str
    strategy: str
    summary: PerformanceSummary


@dataclass
class RegimeComparison:
    results: List[StrategyRegimeResult] = field(default_factory=list)

    def by_regime(self, regime: str) -> List[StrategyRegimeResult]:
        return [result for result in self.results if result.regime == regime]


class StressTestRunner:
    """Run baseline and A-S strategies across volatility regimes."""

    def __init__(
        self,
        *,
        data_dir: Path,
        simulation: Optional[SimulationConfig] = None,
        half_spread: float = 0.02,
        quote_size: int = 5,
        max_inventory: int = 50,
        gamma: float = 0.15,
        k: float = 1.5,
        sigma: float = 0.02,
    ) -> None:
        self.data_dir = data_dir
        self.simulation = simulation or SimulationConfig()
        self.half_spread = half_spread
        self.quote_size = quote_size
        self.max_inventory = max_inventory
        self.gamma = gamma
        self.k = k
        self.sigma = sigma

    def run(self, regimes: Optional[Iterable[str]] = None) -> RegimeComparison:
        regime_names = list(regimes or REGIMES.keys())
        comparison = RegimeComparison()

        for regime in regime_names:
            events = list(load_or_generate_regime(regime, self.data_dir))
            if not events:
                continue

            for strategy_name, engine in self._engines(events).items():
                result = engine.run(events)
                assert result.summary is not None
                comparison.results.append(
                    StrategyRegimeResult(
                        regime=regime,
                        strategy=strategy_name,
                        summary=result.summary,
                    )
                )
        return comparison

    def _engines(self, events) -> Dict[str, BacktestEngine]:
        session_start = events[0].timestamp
        session_end = events[-1].timestamp
        return {
            "symmetric": BacktestEngine(
                strategy=SymmetricQuoter(
                    SymmetricQuoterConfig(
                        half_spread=self.half_spread,
                        quote_size=self.quote_size,
                        max_inventory=self.max_inventory,
                    )
                ),
                simulation=self.simulation,
            ),
            "avellaneda_stoikov": BacktestEngine(
                strategy=AvellanedaStoikovQuoter(
                    AvellanedaStoikovConfig(
                        gamma=self.gamma,
                        k=self.k,
                        sigma=self.sigma,
                        quote_size=self.quote_size,
                        max_inventory=self.max_inventory,
                        session_start=session_start,
                        session_end=session_end,
                        use_volatility_estimator=True,
                    )
                ),
                simulation=self.simulation,
            ),
        }


def format_comparison_table(comparison: RegimeComparison) -> str:
    header = (
        f"{'regime':<10} {'strategy':<18} {'return':>8} {'sharpe':>8} "
        f"{'max_dd':>8} {'avg_inv':>8} {'max_inv':>8} {'fills':>6} {'fees':>8}"
    )
    lines = [header, "-" * len(header)]
    for item in comparison.results:
        sharpe = item.summary.sharpe_ratio
        sharpe_text = f"{sharpe:8.3f}" if sharpe is not None else "     n/a"
        lines.append(
            f"{item.regime:<10} {item.strategy:<18} "
            f"{item.summary.total_return:8.4f} {sharpe_text} "
            f"{item.summary.max_drawdown:8.4f} "
            f"{item.summary.avg_abs_inventory:8.2f} "
            f"{item.summary.max_abs_inventory:8d} "
            f"{item.summary.fill_count:6d} "
            f"{item.summary.total_transaction_costs:8.4f}"
        )
    return "\n".join(lines)