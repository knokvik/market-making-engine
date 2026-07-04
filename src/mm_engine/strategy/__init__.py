"""Quoting strategies for market-making backtests."""

from mm_engine.strategy.avellaneda_stoikov import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    optimal_half_spread,
    reservation_price,
)
from mm_engine.strategy.base import Quote, QuotingStrategy
from mm_engine.strategy.symmetric import SymmetricQuoter, SymmetricQuoterConfig
from mm_engine.strategy.volatility import RollingVolatility

__all__ = [
    "AvellanedaStoikovConfig",
    "AvellanedaStoikovQuoter",
    "Quote",
    "QuotingStrategy",
    "RollingVolatility",
    "SymmetricQuoter",
    "SymmetricQuoterConfig",
    "optimal_half_spread",
    "reservation_price",
]