from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional

from mm_engine.inventory import InventoryState, PnLSnapshot


@dataclass(frozen=True)
class PerformanceSummary:
    observations: int
    total_return: float
    sharpe_ratio: Optional[float]
    max_drawdown: float
    avg_abs_inventory: float
    max_abs_inventory: int
    fill_count: int
    buy_volume: int
    sell_volume: int
    final_position: int
    final_realized_pnl: float


def summarize_performance(
    pnl_curve: List[PnLSnapshot],
    inventory: InventoryState,
) -> PerformanceSummary:
    if not pnl_curve:
        return PerformanceSummary(
            observations=0,
            total_return=0.0,
            sharpe_ratio=None,
            max_drawdown=0.0,
            avg_abs_inventory=0.0,
            max_abs_inventory=0,
            fill_count=inventory.fill_count,
            buy_volume=inventory.buy_volume,
            sell_volume=inventory.sell_volume,
            final_position=inventory.position,
            final_realized_pnl=inventory.realized_pnl,
        )

    pnl_values = [point.mark_to_market_pnl for point in pnl_curve]
    returns = [
        (pnl_values[idx] - pnl_values[idx - 1])
        for idx in range(1, len(pnl_values))
    ]

    total_return = pnl_values[-1] - pnl_values[0]
    sharpe = _sharpe_ratio(returns)
    max_drawdown = _max_drawdown(pnl_values)
    abs_positions = [abs(point.position) for point in pnl_curve]

    return PerformanceSummary(
        observations=len(pnl_curve),
        total_return=total_return,
        sharpe_ratio=sharpe,
        max_drawdown=max_drawdown,
        avg_abs_inventory=sum(abs_positions) / len(abs_positions),
        max_abs_inventory=max(abs_positions),
        fill_count=inventory.fill_count,
        buy_volume=inventory.buy_volume,
        sell_volume=inventory.sell_volume,
        final_position=inventory.position,
        final_realized_pnl=inventory.realized_pnl,
    )


def _sharpe_ratio(returns: List[float]) -> Optional[float]:
    if len(returns) < 2:
        return None
    mean = sum(returns) / len(returns)
    variance = sum((value - mean) ** 2 for value in returns) / (len(returns) - 1)
    if variance <= 0:
        return None
    return mean / math.sqrt(variance)


def _max_drawdown(pnl_values: List[float]) -> float:
    peak = pnl_values[0]
    max_drawdown = 0.0
    for value in pnl_values:
        peak = max(peak, value)
        max_drawdown = max(max_drawdown, peak - value)
    return max_drawdown