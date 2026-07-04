import math

import pytest

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.order_book import OrderBook
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    SymmetricQuoter,
    SymmetricQuoterConfig,
    optimal_half_spread,
    optimal_quote_offsets,
    reservation_price,
    sigma_to_price_units,
)
from mm_engine.types import Side

DATA_DIR = __import__("pathlib").Path(__file__).resolve().parents[1] / "data"


def _seed_book() -> OrderBook:
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.2, 10, order_id=2)
    return book


def test_reservation_price_skews_down_when_long():
    sigma = sigma_to_price_units(0.02, 100.0)
    assert reservation_price(100.0, inventory=10, gamma=0.1, sigma=sigma, time_remaining=1.0) < 100.0


def test_reservation_price_skews_up_when_short():
    sigma = sigma_to_price_units(0.02, 100.0)
    assert reservation_price(100.0, inventory=-10, gamma=0.1, sigma=sigma, time_remaining=1.0) > 100.0


def test_optimal_half_spread_is_positive():
    sigma = sigma_to_price_units(0.02, 100.0)
    spread = optimal_half_spread(gamma=0.1, k=1.5, sigma=sigma, time_remaining=1.0)
    assert spread > 0.0


def test_long_inventory_widens_bid_and_tightens_ask_offsets():
    sigma = sigma_to_price_units(0.02, 100.0)
    _, delta_b_flat, delta_a_flat = optimal_quote_offsets(100.0, 0, 0.1, 1.5, sigma, 1.0)
    _, delta_b_long, delta_a_long = optimal_quote_offsets(100.0, 20, 0.1, 1.5, sigma, 1.0)
    assert delta_b_long > delta_b_flat
    assert delta_a_long < delta_a_flat


def test_as_quote_skews_sell_when_long():
    sigma = sigma_to_price_units(0.02, 100.0)
    strategy = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(use_volatility_estimator=False, sigma=0.02)
    )
    strategy.configure_session(1_000, 10_000)
    strategy.note_timestamp(5_000)
    quote_flat = strategy.compute_quote(_seed_book(), position=0)
    quote_long = strategy.compute_quote(_seed_book(), position=20)
    assert quote_flat is not None
    assert quote_long is not None
    assert quote_long.bid_price < quote_flat.bid_price
    assert quote_long.ask_price < quote_flat.ask_price
    # When long, ask should be more aggressive (closer to / below flat ask).
    assert quote_long.ask_price < quote_flat.ask_price


def test_as_inventory_lower_than_symmetric_on_normal_regime():
    from pathlib import Path
    from mm_engine.stress.regimes import load_or_generate_regime

    events = list(load_or_generate_regime("normal", Path(DATA_DIR) / "regimes"))
    baseline = BacktestEngine(
        strategy=SymmetricQuoter(
            SymmetricQuoterConfig(half_spread=0.02, quote_size=5, max_inventory=50)
        )
    ).run(events)
    as_result = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(
            AvellanedaStoikovConfig(
                gamma=0.1,
                k=1.5,
                sigma=0.02,
                quote_size=5,
                max_inventory=50,
                use_volatility_estimator=True,
            )
        )
    ).run(events)

    assert baseline.summary is not None
    assert as_result.summary is not None
    assert as_result.summary.avg_abs_inventory <= baseline.summary.avg_abs_inventory


def test_compare_as_and_symmetric_on_sample_feed():
    events = list(load_csv_feed(DATA_DIR / "sample_session.csv"))
    baseline = BacktestEngine(
        strategy=SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.02, quote_size=5))
    ).run(events)
    as_result = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(
            AvellanedaStoikovConfig(
                gamma=0.1,
                k=1.5,
                sigma=0.02,
                quote_size=5,
                use_volatility_estimator=False,
            )
        )
    ).run(events)

    assert baseline.summary is not None
    assert as_result.summary is not None
    assert baseline.summary.observations > 0
    assert as_result.summary.observations > 0