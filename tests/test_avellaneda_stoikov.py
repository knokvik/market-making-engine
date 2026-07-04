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
    reservation_price,
)
from mm_engine.types import Side

DATA_DIR = __import__("pathlib").Path(__file__).resolve().parents[1] / "data"


def _seed_book() -> OrderBook:
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.2, 10, order_id=2)
    return book


def test_reservation_price_skews_down_when_long():
    mid = 100.0
    assert reservation_price(mid, inventory=10, gamma=0.1, sigma=0.02, time_remaining=1.0) < mid


def test_reservation_price_skews_up_when_short():
    mid = 100.0
    assert reservation_price(mid, inventory=-10, gamma=0.1, sigma=0.02, time_remaining=1.0) > mid


def test_optimal_half_spread_is_positive():
    spread = optimal_half_spread(gamma=0.1, k=1.5, sigma=0.02, time_remaining=1.0)
    assert spread > 0.0


def test_as_quote_is_asymmetric_when_inventory_nonzero():
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
                session_start=events[0].timestamp,
                session_end=events[-1].timestamp,
                use_volatility_estimator=False,
            )
        )
    ).run(events)

    assert baseline.summary is not None
    assert as_result.summary is not None
    assert baseline.summary.observations > 0
    assert as_result.summary.observations > 0