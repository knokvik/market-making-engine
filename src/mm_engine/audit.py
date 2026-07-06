from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from mm_engine.inventory import InventoryManager, PnLSnapshot
from mm_engine.strategy.avellaneda_stoikov import (
    optimal_quote_offsets,
    reservation_price,
    sigma_to_price_units,
)
from mm_engine.types import Fill, Side


@dataclass(frozen=True)
class AuditCheck:
    name: str
    passed: bool
    detail: str


def audit_reservation_skew_sign(*, mid: float = 100.0, gamma: float = 0.1) -> AuditCheck:
    sigma = sigma_to_price_units(0.02, mid)
    long_r = reservation_price(mid, 10, gamma, sigma, 0.5)
    short_r = reservation_price(mid, -10, gamma, sigma, 0.5)
    ok = long_r < mid and short_r > mid
    return AuditCheck(
        "reservation skew sign",
        ok,
        f"long_r={long_r:.2f} short_r={short_r:.2f} mid={mid:.2f}",
    )


def audit_quotes_use_reservation_not_mid(*, mid: float = 100.0) -> AuditCheck:
    sigma = sigma_to_price_units(0.02, mid)
    reservation, delta_bid, delta_ask = optimal_quote_offsets(mid, 10, 0.1, 1.5, sigma, 0.5)
    bid = reservation - delta_bid
    ask = reservation + delta_ask
    mid_style_bid = mid - 0.02
    mid_style_ask = mid + 0.02
    ok = abs(bid - mid_style_bid) > 1.0 and abs(ask - mid_style_ask) > 1.0
    return AuditCheck(
        "quotes centered on reservation",
        ok,
        f"as_bid={bid:.2f} as_ask={ask:.2f} mid_style={mid_style_bid:.2f}/{mid_style_ask:.2f}",
    )


def audit_fees_only_on_fills() -> AuditCheck:
    inventory = InventoryManager()
    from mm_engine.simulation.config import TransactionCostConfig

    inventory._cost_config = TransactionCostConfig(maker_fee_bps=10.0, taker_fee_bps=20.0)
    before = inventory.state.transaction_costs
    fill = Fill(1, 2, 100.0, 5, Side.ASK)
    inventory.on_fill(fill, 1)
    ok = before == 0.0 and inventory.state.transaction_costs > 0.0 and inventory.state.fill_count == 1
    return AuditCheck(
        "fees charged only on fills",
        ok,
        f"fees_before={before:.4f} fees_after={inventory.state.transaction_costs:.4f}",
    )


def audit_mark_to_market_identity(snapshots: List[PnLSnapshot]) -> AuditCheck:
    if not snapshots:
        return AuditCheck("mark-to-market identity", False, "no snapshots")
    mismatches = [
        snap
        for snap in snapshots
        if abs(snap.mark_to_market_pnl - (snap.cash + snap.position * snap.mid_price)) > 1e-6
    ]
    ok = not mismatches
    return AuditCheck(
        "mark-to-market identity",
        ok,
        f"checked={len(snapshots)} mismatches={len(mismatches)}",
    )


def audit_pnl_curve_has_recovery_steps(snapshots: List[PnLSnapshot], *, min_positive: int = 1) -> AuditCheck:
    if len(snapshots) < 2:
        return AuditCheck("pnl mean-reversion steps", False, "insufficient snapshots")
    deltas = [
        snapshots[idx].mark_to_market_pnl - snapshots[idx - 1].mark_to_market_pnl
        for idx in range(1, len(snapshots))
    ]
    positive = sum(1 for delta in deltas if delta > 0)
    ok = positive >= min_positive
    return AuditCheck(
        "pnl mean-reversion steps",
        ok,
        f"positive_steps={positive} negative_steps={sum(1 for d in deltas if d < 0)}",
    )


def run_implementation_audit(snapshots: Optional[List[PnLSnapshot]] = None) -> List[AuditCheck]:
    checks = [
        audit_reservation_skew_sign(),
        audit_quotes_use_reservation_not_mid(),
        audit_fees_only_on_fills(),
    ]
    if snapshots:
        checks.append(audit_mark_to_market_identity(snapshots))
        checks.append(audit_pnl_curve_has_recovery_steps(snapshots))
    return checks