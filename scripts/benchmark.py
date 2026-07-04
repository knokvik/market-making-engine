#!/usr/bin/env python3
"""Quick benchmark suite to sanity-check simulator progress before shipping."""
from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.order_book import OrderBook
from mm_engine.simulation.config import SimulationConfig, TransactionCostConfig
from mm_engine.stress import StressTestRunner
from mm_engine.stress.runner import format_comparison_table
from mm_engine.strategy import AvellanedaStoikovConfig, AvellanedaStoikovQuoter, SymmetricQuoter, SymmetricQuoterConfig
from mm_engine.types import Side

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sample_session.csv"


@dataclass
class BenchmarkResult:
    name: str
    passed: bool
    detail: str


def bench_pytest() -> BenchmarkResult:
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ok = proc.returncode == 0
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-1] if proc.stdout or proc.stderr else ""
    return BenchmarkResult("pytest suite", ok, tail or f"exit={proc.returncode}")


def bench_queue_position_fifo() -> BenchmarkResult:
    book = OrderBook()
    book.add_limit_order(Side.ASK, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.0, 5, order_id=2)
    _, fills = book.add_limit_order(Side.BID, 100.0, 12, order_id=3)
    maker_ids = [fill.maker_order_id for fill in fills]
    ok = maker_ids == [1, 2] and fills[0].quantity == 10 and fills[1].quantity == 2
    return BenchmarkResult(
        "queue position FIFO",
        ok,
        f"maker order sequence={maker_ids}",
    )


def bench_fees_reduce_pnl() -> BenchmarkResult:
    events = list(load_csv_feed(DATA))
    zero_fees = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5)),
        simulation=SimulationConfig(costs=TransactionCostConfig(maker_fee_bps=0.0, taker_fee_bps=0.0)),
    ).run(events)
    with_fees = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5)),
        simulation=SimulationConfig(costs=TransactionCostConfig(maker_fee_bps=1.0, taker_fee_bps=2.0)),
    ).run(events)
    assert zero_fees.summary is not None and with_fees.summary is not None

    ok = True
    detail_parts = []
    if with_fees.summary.fill_count > 0:
        ok = with_fees.summary.total_transaction_costs > 0.0
        detail_parts.append(f"fees={with_fees.summary.total_transaction_costs:.4f}")
    if zero_fees.summary.fill_count > 0 and with_fees.summary.fill_count > 0:
        ok = ok and with_fees.summary.total_return <= zero_fees.summary.total_return
        detail_parts.append(
            f"return zero_fees={zero_fees.summary.total_return:.4f} "
            f"with_fees={with_fees.summary.total_return:.4f}"
        )
    if zero_fees.summary.fill_count == 0:
        detail_parts.append("no fills in fixture; fee model only smoke-checked")
        ok = with_fees.summary.total_transaction_costs >= 0.0
    return BenchmarkResult("transaction costs", ok, "; ".join(detail_parts))


def bench_latency_delays_or_reduces_fills() -> BenchmarkResult:
    events = list(load_csv_feed(DATA))
    immediate = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5)),
        simulation=SimulationConfig(quote_latency_ns=0),
    ).run(events)
    delayed = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5)),
        simulation=SimulationConfig(quote_latency_ns=5_000),
    ).run(events)
    assert immediate.summary is not None and delayed.summary is not None

    ok = delayed.summary.fill_count <= immediate.summary.fill_count
    detail = (
        f"fills immediate={immediate.summary.fill_count} "
        f"delayed={delayed.summary.fill_count}"
    )
    return BenchmarkResult("quote latency", ok, detail)


def bench_as_inventory_risk() -> BenchmarkResult:
    events = list(load_csv_feed(DATA))
    baseline = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5, max_inventory=50)),
    ).run(events)
    as_strategy = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(
            AvellanedaStoikovConfig(
                gamma=0.2,
                k=1.5,
                sigma=0.02,
                quote_size=5,
                max_inventory=50,
                use_volatility_estimator=False,
            )
        ),
    ).run(events)
    assert baseline.summary is not None and as_strategy.summary is not None

    ok = as_strategy.summary.max_abs_inventory <= baseline.summary.max_abs_inventory
    detail = (
        f"max_inv baseline={baseline.summary.max_abs_inventory} "
        f"a-s={as_strategy.summary.max_abs_inventory}"
    )
    return BenchmarkResult("A-S inventory control", ok, detail)


def bench_backtest_produces_curve() -> BenchmarkResult:
    events = list(load_csv_feed(DATA))
    result = BacktestEngine().run(events)
    ok = result.summary is not None and result.summary.observations > 0 and len(result.pnl_curve) > 0
    detail = f"observations={result.summary.observations if result.summary else 0}"
    return BenchmarkResult("backtest pnl curve", ok, detail)


def bench_stress_test_three_regimes() -> BenchmarkResult:
    runner = StressTestRunner(data_dir=ROOT / "data" / "regimes")
    comparison = runner.run()
    regimes = {item.regime for item in comparison.results}
    strategies = {item.strategy for item in comparison.results}
    ok = regimes == {"calm", "normal", "volatile"} and strategies == {
        "symmetric",
        "avellaneda_stoikov",
    }
    return BenchmarkResult(
        "stress test 3 regimes",
        ok,
        f"rows={len(comparison.results)} regimes={sorted(regimes)}",
    )


BENCHMARKS: List[Callable[[], BenchmarkResult]] = [
    bench_pytest,
    bench_queue_position_fifo,
    bench_backtest_produces_curve,
    bench_fees_reduce_pnl,
    bench_latency_delays_or_reduces_fills,
    bench_as_inventory_risk,
    bench_stress_test_three_regimes,
]


def main() -> int:
    results = [check() for check in BENCHMARKS]
    passed = sum(1 for result in results if result.passed)
    total = len(results)

    print("Market-Making Engine Benchmark")
    print("=" * 60)
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.name}: {result.detail}")
    print("=" * 60)
    print(f"{passed}/{total} benchmarks passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())