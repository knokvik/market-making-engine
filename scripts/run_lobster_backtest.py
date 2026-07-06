#!/usr/bin/env python3
"""Run Avellaneda-Stoikov backtest on LOBSTER message feed."""
from __future__ import annotations

import argparse
from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_lobster_messages
from mm_engine.reporting import export_backtest_csv
from mm_engine.simulation.config import SimulationConfig, TransactionCostConfig
from mm_engine.strategy import AvellanedaStoikovConfig, AvellanedaStoikovQuoter

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="LOBSTER feed backtest with A-S quoting")
    parser.add_argument(
        "feed",
        type=Path,
        nargs="?",
        default=ROOT / "data" / "sample_lobster.csv",
        help="LOBSTER message CSV (default: data/sample_lobster.csv)",
    )
    parser.add_argument("--gamma", type=float, default=0.1)
    parser.add_argument("--k", type=float, default=1.5)
    parser.add_argument("--sigma", type=float, default=0.02)
    parser.add_argument("--quote-size", type=int, default=10)
    parser.add_argument("--max-inventory", type=int, default=100)
    parser.add_argument("--maker-fee-bps", type=float, default=0.0)
    parser.add_argument("--taker-fee-bps", type=float, default=1.0)
    parser.add_argument("--toxicity", action="store_true", help="Enable toxicity monitor + spread widening")
    parser.add_argument("--export-csv", type=Path, default=None, help="Export PnL curve to CSV")
    args = parser.parse_args()

    events = list(load_lobster_messages(args.feed))
    if not events:
        raise SystemExit(f"no events loaded from {args.feed}")

    strategy = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(
            gamma=args.gamma,
            k=args.k,
            sigma=args.sigma,
            quote_size=args.quote_size,
            max_inventory=args.max_inventory,
            session_start=events[0].timestamp,
            session_end=events[-1].timestamp,
            use_toxicity_widening=args.toxicity,
        )
    )
    simulation = SimulationConfig(
        costs=TransactionCostConfig(
            maker_fee_bps=args.maker_fee_bps,
            taker_fee_bps=args.taker_fee_bps,
        ),
        enable_toxicity_monitor=args.toxicity,
    )
    result = BacktestEngine(strategy=strategy, simulation=simulation).run(events)
    summary = result.summary
    assert summary is not None

    print(f"feed:              {args.feed}")
    print(f"observations:      {summary.observations}")
    print(f"total_return:      {summary.total_return:.4f}")
    print(f"sharpe_ratio:      {summary.sharpe_ratio}")
    print(f"max_drawdown:      {summary.max_drawdown:.4f}")
    print(f"avg_abs_inventory: {summary.avg_abs_inventory:.2f}")
    print(f"max_abs_inventory: {summary.max_abs_inventory}")
    print(f"fill_count:        {summary.fill_count}")
    print(f"realized_pnl:      {summary.spread_capture_pnl:.4f}")
    print(f"unrealized_pnl:    {summary.inventory_risk_pnl:.4f}")
    print(f"loss_per_fill:     {summary.loss_per_fill:.4f}")

    if result.toxicity_curve:
        avg_tox = sum(point.level for point in result.toxicity_curve) / len(result.toxicity_curve)
        max_tox = max(point.level for point in result.toxicity_curve)
        print(f"avg_toxicity:      {avg_tox:.4f}")
        print(f"max_toxicity:      {max_tox:.4f}")

    if args.export_csv is not None:
        export_backtest_csv(result, args.export_csv)
        print(f"exported CSV:      {args.export_csv}")


if __name__ == "__main__":
    main()