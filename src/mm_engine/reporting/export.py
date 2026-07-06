from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict

from mm_engine.backtest.engine import BacktestResult


def export_backtest_csv(result: BacktestResult, path: Path) -> None:
    """Write PnL curve (and optional toxicity) to CSV."""
    toxicity_by_ts: Dict[int, float] = {
        point.timestamp: point.level for point in result.toxicity_curve
    }
    include_toxicity = bool(result.toxicity_curve)

    fieldnames = [
        "timestamp",
        "mid_price",
        "position",
        "cash",
        "realized_pnl",
        "mark_to_market_pnl",
        "unrealized_pnl",
    ]
    if include_toxicity:
        fieldnames.append("toxicity")

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for point in result.pnl_curve:
            row = {
                "timestamp": point.timestamp,
                "mid_price": f"{point.mid_price:.6f}",
                "position": point.position,
                "cash": f"{point.cash:.6f}",
                "realized_pnl": f"{point.realized_pnl:.6f}",
                "mark_to_market_pnl": f"{point.mark_to_market_pnl:.6f}",
                "unrealized_pnl": f"{point.unrealized_pnl:.6f}",
            }
            if include_toxicity:
                row["toxicity"] = f"{toxicity_by_ts.get(point.timestamp, 0.0):.6f}"
            writer.writerow(row)

    if result.summary is not None:
        _write_summary_sidecar(path, result)


def _write_summary_sidecar(csv_path: Path, result: BacktestResult) -> None:
    summary = result.summary
    assert summary is not None
    sidecar = csv_path.with_suffix(".summary.txt")
    lines = [
        f"observations={summary.observations}",
        f"total_return={summary.total_return:.6f}",
        f"sharpe_ratio={summary.sharpe_ratio}",
        f"max_drawdown={summary.max_drawdown:.6f}",
        f"avg_abs_inventory={summary.avg_abs_inventory:.4f}",
        f"max_abs_inventory={summary.max_abs_inventory}",
        f"fill_count={summary.fill_count}",
        f"spread_capture_pnl={summary.spread_capture_pnl:.6f}",
        f"inventory_risk_pnl={summary.inventory_risk_pnl:.6f}",
        f"loss_per_fill={summary.loss_per_fill:.6f}",
    ]
    if result.toxicity_curve:
        avg_toxicity = sum(point.level for point in result.toxicity_curve) / len(result.toxicity_curve)
        max_toxicity = max(point.level for point in result.toxicity_curve)
        lines.append(f"avg_toxicity={avg_toxicity:.6f}")
        lines.append(f"max_toxicity={max_toxicity:.6f}")
    sidecar.write_text("\n".join(lines) + "\n")