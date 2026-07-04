from __future__ import annotations

from mm_engine.simulation.config import TransactionCostConfig


def compute_transaction_cost(
    price: float,
    quantity: int,
    *,
    is_maker: bool,
    config: TransactionCostConfig,
) -> float:
    notional = price * quantity
    bps = config.maker_fee_bps if is_maker else config.taker_fee_bps
    return notional * bps / 10_000.0