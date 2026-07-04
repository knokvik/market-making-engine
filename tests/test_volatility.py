from mm_engine.strategy.volatility import RollingVolatility


def test_rolling_volatility_returns_default_with_insufficient_data():
    estimator = RollingVolatility(window=5, default_sigma=0.03)
    assert estimator.update(100.0) == 0.03


def test_rolling_volatility_computes_positive_sigma_with_moves():
    estimator = RollingVolatility(window=10, default_sigma=0.03)
    mids = [100.0, 100.1, 100.05, 100.2, 100.15, 100.25]
    sigma = 0.03
    for mid in mids:
        sigma = estimator.update(mid)
    assert sigma > 0.0