#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed, load_lobster_messages
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    SymmetricQuoter,
    SymmetricQuoterConfig,
)


def _load_events(feed: Path, feed_format: str):
    if feed_format == "csv":
        return list(load_csv_feed(feed))
    return list(load_lobster_messages(feed))


def _print_row(name: str, summary) -> None:
    print(
        f"{name:12} | return={summary.total_return:8.4f} | "
        f"sharpe={summary.sharpe_ratio!s:>8} | "
        f"max_dd={summary.max_drawdown:8.4f} | "
        f"avg_inv={summary.avg_abs_inventory:6.2f} | "
        f"max_inv={summary.max_abs_inventory:3d} | "
        f"fills={summary.fill_count:3d}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare symmetric baseline vs Avellaneda-Stoikov")
    parser.add_argument("feed", type=Path)
    parser.add_argument("--half-spread", type=float, default=0.05)
    parser.add_argument("--gamma", type=float, default=0.1)
    parser.add_argument("--k", type=float, default=1.5)
    parser.add_argument("--sigma", type=float, default=0.02)
    parser.add_argument("--quote-size", type=int, default=10)
    parser.add_argument("--max-inventory", type=int, default=100)
    parser.add_argument("--format", choices=("auto", "csv", "lobster"), default="auto")
    args = parser.parse_args()

    feed_format = args.format
    if feed_format == "auto":
        feed_format = "csv" if args.feed.suffix.lower() == ".csv" else "lobster"

    events = _load_events(args.feed, feed_format)
    if not events:
        raise SystemExit("feed contained no events")

    session_start = events[0].timestamp
    session_end = events[-1].timestamp

    baseline = SymmetricQuoter(
        SymmetricQuoterConfig(
            half_spread=args.half_spread,
            quote_size=args.quote_size,
            max_inventory=args.max_inventory,
        )
    )
    as_quoter = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(
            gamma=args.gamma,
            k=args.k,
            sigma=args.sigma,
            quote_size=args.quote_size,
            max_inventory=args.max_inventory,
            session_start=session_start,
            session_end=session_end,
        )
    )

    baseline_result = BacktestEngine(strategy=baseline).run(events)
    as_result = BacktestEngine(strategy=as_quoter).run(events)

    print("Strategy comparison on", args.feed)
    print("-" * 88)
    _print_row("symmetric", baseline_result.summary)
    _print_row("a-s", as_result.summary)


if __name__ == "__main__":
    main()