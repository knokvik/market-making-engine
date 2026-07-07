#!/usr/bin/env python3
"""Detailed benchmark suite — stress, audit, replay perf, strategy comparison."""
from __future__ import annotations

import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional

from mm_engine.audit import run_implementation_audit
from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.replay import ReplayConfig, ReplayController
from mm_engine.stress import StressTestRunner
from mm_engine.stress.runner import format_comparison_table
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    SymmetricQuoter,
    SymmetricQuoterConfig,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sample_session.csv"
REGIMES_DIR = ROOT / "data" / "regimes"


@dataclass
class BenchRow:
    category: str
    name: str
    passed: bool
    value: str
    threshold: str
    note: str = ""


def run_pytest() -> BenchRow:
    proc = subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=ROOT, capture_output=True, text=True)
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-1] if proc.stdout or proc.stderr else ""
    return BenchRow("tests", "pytest suite", proc.returncode == 0, tail, "0 failures")


def run_audit_all_regimes() -> List[BenchRow]:
    rows: List[BenchRow] = []
    for regime in ("calm", "normal", "volatile"):
        from mm_engine.stress.regimes import load_or_generate_regime

        events = list(load_or_generate_regime(regime, REGIMES_DIR))
        result = BacktestEngine(
            strategy=AvellanedaStoikovQuoter(AvellanedaStoikovConfig(quote_size=5))
        ).run(events)
        checks = run_implementation_audit(result.pnl_curve)
        passed = all(c.passed for c in checks)
        failed = [c.name for c in checks if not c.passed]
        rows.append(
            BenchRow(
                "audit",
                f"audit {regime}",
                passed,
                f"{sum(1 for c in checks if c.passed)}/{len(checks)}",
                "5/5",
                "" if passed else f"failed: {failed}",
            )
        )
    return rows


def run_stress_inventory_comparison() -> List[BenchRow]:
    runner = StressTestRunner(data_dir=REGIMES_DIR)
    comparison = runner.run()
    rows: List[BenchRow] = []
    for regime in ("calm", "normal", "volatile"):
        items = comparison.by_regime(regime)
        sym = next((i for i in items if i.strategy == "symmetric"), None)
        as_ = next((i for i in items if i.strategy == "avellaneda_stoikov"), None)
        if sym is None or as_ is None:
            continue
        ok = as_.summary.avg_abs_inventory <= sym.summary.avg_abs_inventory
        rows.append(
            BenchRow(
                "stress",
                f"A-S inv <= sym ({regime})",
                ok,
                f"sym={sym.summary.avg_abs_inventory:.2f} as={as_.summary.avg_abs_inventory:.2f}",
                "as <= sym",
            )
        )
        rows.append(
            BenchRow(
                "stress",
                f"fills > 0 ({regime})",
                sym.summary.fill_count > 0 and as_.summary.fill_count > 0,
                f"sym={sym.summary.fill_count} as={as_.summary.fill_count}",
                "> 0 both",
            )
        )
    return rows


def run_replay_performance() -> List[BenchRow]:
    rows: List[BenchRow] = []
    controller = ReplayController(ReplayConfig(regime="normal"), root=ROOT)
    controller.reset()

    t0 = time.perf_counter()
    steps = min(50, len(controller.events))
    for _ in range(steps):
        controller.step_forward()
    forward_ms = (time.perf_counter() - t0) * 1000 / max(steps, 1)

    t0 = time.perf_counter()
    controller.step_backward()
    backward_ms = (time.perf_counter() - t0) * 1000

    rows.append(
        BenchRow(
            "replay",
            "forward step latency",
            forward_ms < 50.0,
            f"{forward_ms:.2f}ms",
            "< 50ms",
        )
    )
    rows.append(
        BenchRow(
            "replay",
            "backward step latency",
            backward_ms < 100.0,
            f"{backward_ms:.2f}ms",
            "< 100ms",
            "seek uses cached checkpoints when available",
        )
    )

    t0 = time.perf_counter()
    controller.seek(len(controller.events) - 1)
    seek_ms = (time.perf_counter() - t0) * 1000
    rows.append(
        BenchRow(
            "replay",
            "seek to end",
            seek_ms < 500.0,
            f"{seek_ms:.0f}ms",
            "< 500ms",
        )
    )
    return rows


def run_sample_session_strategy() -> List[BenchRow]:
    events = list(load_csv_feed(DATA))
    sym = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5, max_inventory=50))
    ).run(events)
    as_ = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(
            AvellanedaStoikovConfig(
                gamma=0.1,
                k=1.5,
                sigma=0.02,
                quote_size=5,
                max_inventory=50,
                use_volatility_estimator=False,
                competitive_quoting=True,
            )
        )
    ).run(events)
    assert sym.summary and as_.summary
    return [
        BenchRow(
            "sample",
            "symmetric fills",
            sym.summary.fill_count > 0,
            str(sym.summary.fill_count),
            "> 0",
        ),
        BenchRow(
            "sample",
            "A-S fills on sample",
            as_.summary.fill_count > 0,
            str(as_.summary.fill_count),
            "> 0",
            "A-S spreads may be too wide for tiny sample" if as_.summary.fill_count == 0 else "",
        ),
        BenchRow(
            "sample",
            "A-S inv <= sym (sample)",
            as_.summary.avg_abs_inventory <= sym.summary.avg_abs_inventory,
            f"sym={sym.summary.avg_abs_inventory:.2f} as={as_.summary.avg_abs_inventory:.2f}",
            "as <= sym",
        ),
    ]


def run_toxicity_widening() -> BenchRow:
    from mm_engine.order_book import OrderBook
    from mm_engine.types import Side

    book = OrderBook()
    book.add_limit_order(Side.BID, 99.8, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.0, 10, order_id=2)
    clean = AvellanedaStoikovQuoter(AvellanedaStoikovConfig(use_volatility_estimator=False))
    toxic = AvellanedaStoikovQuoter(AvellanedaStoikovConfig(use_volatility_estimator=False))
    toxic.set_toxicity_level(1.0)
    q1 = clean.compute_quote(book, 0)
    q2 = toxic.compute_quote(book, 0)
    assert q1 and q2
    spread_clean = q1.ask_price - q1.bid_price
    spread_toxic = q2.ask_price - q2.bid_price
    return BenchRow(
        "toxicity",
        "spread widening",
        spread_toxic > spread_clean,
        f"{spread_clean:.4f} -> {spread_toxic:.4f}",
        "toxic > clean",
    )


def main() -> int:
    collectors: List[Callable[[], List[BenchRow]]] = [
        lambda: [run_pytest()],
        run_audit_all_regimes,
        run_stress_inventory_comparison,
        run_replay_performance,
        run_sample_session_strategy,
        lambda: [run_toxicity_widening()],
    ]

    rows: List[BenchRow] = []
    for collector in collectors:
        rows.extend(collector())

    print("=" * 90)
    print("MARKET-MAKING ENGINE — DETAILED BENCHMARK")
    print("=" * 90)
    print(f"{'CATEGORY':<10} {'CHECK':<28} {'RESULT':<22} {'THRESHOLD':<14} {'STATUS'}")
    print("-" * 90)

    failed: List[BenchRow] = []
    for row in rows:
        status = "PASS" if row.passed else "FAIL"
        print(f"{row.category:<10} {row.name:<28} {row.value:<22} {row.threshold:<14} {status}")
        if row.note:
            print(f"           note: {row.note}")
        if not row.passed:
            failed.append(row)

    print("-" * 90)
    passed = sum(1 for r in rows if r.passed)
    print(f"{passed}/{len(rows)} checks passed")

    if failed:
        print("\nFAILURES REQUIRING ATTENTION:")
        for row in failed:
            print(f"  - [{row.category}] {row.name}: {row.value} (expected {row.threshold})")

    print("\nSTRESS TABLE")
    print(format_comparison_table(StressTestRunner(data_dir=REGIMES_DIR).run()))

    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())