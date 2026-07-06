#!/usr/bin/env python3
"""Verify the four implementation checks from the A-S debugging checklist."""
from __future__ import annotations

import sys
from pathlib import Path

from mm_engine.audit import run_implementation_audit
from mm_engine.backtest import BacktestEngine
from mm_engine.stress.regimes import load_or_generate_regime
from mm_engine.strategy import AvellanedaStoikovConfig, AvellanedaStoikovQuoter

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    events = list(load_or_generate_regime("normal", ROOT / "data" / "regimes"))
    result = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(AvellanedaStoikovConfig(gamma=0.15, quote_size=5))
    ).run(events)
    assert result.summary is not None

    checks = run_implementation_audit(result.pnl_curve)
    print("A-S Implementation Audit Checklist")
    print("=" * 60)
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"[{status}] {check.name}: {check.detail}")

    s = result.summary
    print("-" * 60)
    print(f"fills={s.fill_count} fees={s.total_transaction_costs:.4f} fee/fill={s.total_transaction_costs/max(s.fill_count,1):.4f}")
    print(f"total_return={s.total_return:.2f} max_dd={s.max_drawdown:.2f}")
    print(f"spread_capture(realized)={s.spread_capture_pnl:.2f} inventory_risk(unrealized)={s.inventory_risk_pnl:.2f}")
    print(f"pnl_steps +{s.pnl_positive_steps} -{s.pnl_negative_steps} loss/fill={s.loss_per_fill:.2f}")
    print("=" * 60)

    passed = sum(1 for check in checks if check.passed)
    print(f"{passed}/{len(checks)} checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())