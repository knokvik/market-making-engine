from __future__ import annotations

import math
from collections import deque
from typing import Deque, Optional


class RollingVolatility:
    """Estimate volatility from rolling mid-price log returns."""

    def __init__(self, window: int = 20, default_sigma: float = 0.02) -> None:
        if window < 2:
            raise ValueError("window must be at least 2")
        self.window = window
        self.default_sigma = default_sigma
        self._mids: Deque[float] = deque(maxlen=window + 1)

    def update(self, mid_price: float) -> float:
        self._mids.append(mid_price)
        if len(self._mids) < 2:
            return self.default_sigma

        returns = [
            math.log(self._mids[idx] / self._mids[idx - 1])
            for idx in range(1, len(self._mids))
        ]
        if len(returns) < 2:
            return self.default_sigma
        return _population_std(returns)


def _population_std(values: list[float]) -> float:
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(max(variance, 0.0))