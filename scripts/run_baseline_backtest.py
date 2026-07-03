#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed, load_lobster_messages
from mm_engine.strategy import SymmetricQuoter, SymmetricQuoterConfig


def main() -> None:
    parser = argparse.ArgumentParser(description="Run baseline symmetric market-making backtest")
    parser.add_argument("feed", type=Path, help="Path to CSV or LOBSTER message file")
    parser.add_argument("--half-spread", type=float, default=0.05)
    parser.add_argument("--quote-size", type=int, default=10)
    parser.add_argument("--max-inventory", type=int, default=100)
    parser.add_argument(
        "--format",
        choices=("auto", "csv", "lobster"),
        default="auto",
        help="Feed format; auto uses .csv suffix heuristic",
    )
    args = parser.parse_args()

    feed_format = args.format
    if feed_format == "auto":
        feed_format = "csv" if args.feed.suffix.lower() == ".csv" else "lobster"

    if feed_format == "csv":
        events = load_csv_feed(args.feed)
    else:
        events = load_lobster_messages(args.feed)

    strategy = SymmetricQuoter(
        SymmetricQuoterConfig(
            half_spread=args.half_spread,
            quote_size=args.quote_size,
            max_inventory=args.max_inventory,
        )
    )
    result = BacktestEngine(strategy=strategy).run(events)
    summary = result.summary
    assert summary is not None

    print(f"observations:      {summary.observations}")
    print(f"total_return:      {summary.total_return:.4f}")
    print(f"sharpe_ratio:      {summary.sharpe_ratio}")
    print(f"max_drawdown:      {summary.max_drawdown:.4f}")
    print(f"avg_abs_inventory: {summary.avg_abs_inventory:.2f}")
    print(f"max_abs_inventory: {summary.max_abs_inventory}")
    print(f"fill_count:        {summary.fill_count}")
    print(f"final_position:    {summary.final_position}")
    print(f"realized_pnl:      {summary.final_realized_pnl:.4f}")


if __name__ == "__main__":
    main()