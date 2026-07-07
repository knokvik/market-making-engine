from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.order_book import OrderBook
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    cap_deltas_to_book,
)
from mm_engine.types import Side

DATA = Path(__file__).resolve().parents[1] / "data" / "sample_session.csv"


def test_cap_deltas_limits_average_spread_to_book():
    bid, ask = cap_deltas_to_book(0.85, 0.85, book_spread=0.05, competitive=True, max_multiple=1.0)
    assert (bid + ask) / 2.0 <= 0.025 + 1e-9


def test_cap_deltas_preserves_inventory_asymmetry():
    bid, ask = cap_deltas_to_book(4.0, -2.0, book_spread=0.2, competitive=True, max_multiple=1.0)
    assert bid > ask
    assert bid > 0 and ask > 0


def test_as_gets_fills_on_tight_sample_with_competitive_quoting():
    events = list(load_csv_feed(DATA))
    result = BacktestEngine(
        strategy=AvellanedaStoikovQuoter(
            AvellanedaStoikovConfig(
                gamma=0.1,
                k=1.5,
                sigma=0.02,
                quote_size=5,
                use_volatility_estimator=False,
                competitive_quoting=True,
            )
        )
    ).run(events)
    assert result.summary is not None
    assert result.summary.fill_count > 0


def test_competitive_quoting_disabled_preserves_wide_spread():
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.05, 10, order_id=2)
    wide = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(use_volatility_estimator=False, competitive_quoting=False)
    )
    tight = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(use_volatility_estimator=False, competitive_quoting=True)
    )
    q_wide = wide.compute_quote(book, 0)
    q_tight = tight.compute_quote(book, 0)
    assert q_wide and q_tight
    spread_wide = q_wide.ask_price - q_wide.bid_price
    spread_tight = q_tight.ask_price - q_tight.bid_price
    assert spread_tight < spread_wide