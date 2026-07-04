#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from mm_engine.simulation.config import SimulationConfig, TransactionCostConfig
from mm_engine.stress import StressTestRunner
from mm_engine.stress.runner import format_comparison_table


def main() -> None:
    parser = argparse.ArgumentParser(description="Stress test strategies across volatility regimes")
    parser.add_argument("--data-dir", type=Path, default=Path("data/regimes"))
    parser.add_argument("--half-spread", type=float, default=0.02)
    parser.add_argument("--quote-size", type=int, default=5)
    parser.add_argument("--max-inventory", type=int, default=50)
    parser.add_argument("--gamma", type=float, default=0.15)
    parser.add_argument("--maker-fee-bps", type=float, default=1.0)
    parser.add_argument("--taker-fee-bps", type=float, default=2.0)
    args = parser.parse_args()

    runner = StressTestRunner(
        data_dir=args.data_dir,
        simulation=SimulationConfig(
            costs=TransactionCostConfig(
                maker_fee_bps=args.maker_fee_bps,
                taker_fee_bps=args.taker_fee_bps,
            )
        ),
        half_spread=args.half_spread,
        quote_size=args.quote_size,
        max_inventory=args.max_inventory,
        gamma=args.gamma,
    )
    comparison = runner.run()
    print(format_comparison_table(comparison))


if __name__ == "__main__":
    main()