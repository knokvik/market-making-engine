from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TransactionCostConfig:
    """Per-fill fees expressed in basis points of notional."""

    maker_fee_bps: float = 0.0
    taker_fee_bps: float = 1.0


@dataclass(frozen=True)
class SimulationConfig:
    """Realism knobs applied during backtesting."""

    costs: TransactionCostConfig = TransactionCostConfig()
    quote_latency_ns: int = 0