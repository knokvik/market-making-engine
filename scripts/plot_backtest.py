#!/usr/bin/env python3
"""Plot PnL, inventory, and toxicity curves from a backtest run."""
from __future__ import annotations

import argparse
from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed, load_lobster_messages
from mm_engine.reporting import export_backtest_csv
from mm_engine.simulation.config import SimulationConfig
from mm_engine.strategy import AvellanedaStoikovConfig, AvellanedaStoikovQuoter


def _load_events(feed: Path, feed_format: str):
    if feed_format == "csv":
        return list(load_csv_feed(feed))
    return list(load_lobster_messages(feed))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run backtest and plot PnL/inventory curves")
    parser.add_argument("feed", type=Path)
    parser.add_argument("--output", type=Path, default=None, help="PNG output path")
    parser.add_argument("--export-csv", type=Path, default=None, help="Optional CSV export path")
    parser.add_argument("--gamma", type=float, default=0.1)
    parser.add_argument("--k", type=float, default=1.5)
    parser.add_argument("--sigma", type=float, default=0.02)
    parser.add_argument("--quote-size", type=int, default=10)
    parser.add_argument("--max-inventory", type=int, default=100)
    parser.add_argument("--toxicity", action="store_true", help="Enable toxicity monitor + spread widening")
    parser.add_argument("--format", choices=("auto", "csv", "lobster"), default="auto")
    args = parser.parse_args()

    feed_format = args.format
    if feed_format == "auto":
        feed_format = "csv" if args.feed.suffix.lower() == ".csv" else "lobster"

    events = _load_events(args.feed, feed_format)
    if not events:
        raise SystemExit("feed contained no events")

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
    simulation = SimulationConfig(enable_toxicity_monitor=args.toxicity)
    result = BacktestEngine(strategy=strategy, simulation=simulation).run(events)

    if args.export_csv is not None:
        export_backtest_csv(result, args.export_csv)
        print(f"exported CSV to {args.export_csv}")

    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed; install with: pip install -e '.[viz]'")
        return 1

    timestamps = [point.timestamp for point in result.pnl_curve]
    pnl = [point.mark_to_market_pnl for point in result.pnl_curve]
    inventory = [point.position for point in result.pnl_curve]

    fig, axes = plt.subplots(2 if result.toxicity_curve else 1, 1, figsize=(10, 6), sharex=True)
    if not isinstance(axes, list) and not hasattr(axes, "__len__"):
        axes = [axes]
    elif hasattr(axes, "flatten"):
        axes = list(axes.flatten())

    axes[0].plot(timestamps, pnl, label="mark-to-market PnL", color="tab:blue")
    ax_inv = axes[0].twinx()
    ax_inv.plot(timestamps, inventory, label="inventory", color="tab:orange", alpha=0.7)
    axes[0].set_ylabel("PnL")
    ax_inv.set_ylabel("position")
    axes[0].set_title("Backtest performance")
    axes[0].legend(loc="upper left")
    ax_inv.legend(loc="upper right")

    if result.toxicity_curve and len(axes) > 1:
        tox_ts = [point.timestamp for point in result.toxicity_curve]
        tox_levels = [point.level for point in result.toxicity_curve]
        axes[1].plot(tox_ts, tox_levels, color="tab:red")
        axes[1].set_ylabel("toxicity")
        axes[1].set_xlabel("timestamp")
        axes[1].set_ylim(0.0, 1.0)
    else:
        axes[0].set_xlabel("timestamp")

    output = args.output or args.feed.with_suffix(".backtest.png")
    fig.tight_layout()
    fig.savefig(output, dpi=120)
    print(f"saved plot to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())