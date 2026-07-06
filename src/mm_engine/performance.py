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
    total_transaction_costs: float
    final_unrealized_pnl: float
    pnl_positive_steps: int
    pnl_negative_steps: int
    loss_per_fill: float
    spread_capture_pnl: float
    inventory_risk_pnl: float


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
            total_transaction_costs=inventory.transaction_costs,
            final_unrealized_pnl=0.0,
            pnl_positive_steps=0,
            pnl_negative_steps=0,
            loss_per_fill=0.0,
            spread_capture_pnl=0.0,
            inventory_risk_pnl=0.0,
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
    last = pnl_curve[-1]
    spread_capture = last.realized_pnl
    inventory_risk = last.unrealized_pnl
    positive_steps = sum(1 for delta in returns if delta > 0)
    negative_steps = sum(1 for delta in returns if delta < 0)
    fills = max(inventory.fill_count, 1)

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
        total_transaction_costs=inventory.transaction_costs,
        final_unrealized_pnl=last.unrealized_pnl,
        pnl_positive_steps=positive_steps,
        pnl_negative_steps=negative_steps,
        loss_per_fill=total_return / fills,
        spread_capture_pnl=spread_capture,
        inventory_risk_pnl=inventory_risk,
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