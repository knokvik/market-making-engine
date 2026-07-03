import pytest

from mm_engine.order_book import OrderBook
from mm_engine.strategy import SymmetricQuoter, SymmetricQuoterConfig
from mm_engine.types import Side


def _seed_book() -> OrderBook:
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.2, 10, order_id=2)
    return book


def test_compute_symmetric_quote_around_mid():
    strategy = SymmetricQuoter(SymmetricQuoterConfig(half_spread=0.05, quote_size=8))
    quote = strategy.compute_quote(_seed_book(), position=0)
    assert quote is not None
    assert quote.bid_price == pytest.approx(100.05)
    assert quote.ask_price == pytest.approx(100.15)
    assert quote.quote_size == 8


def test_long_position_disables_bid_side():
    strategy = SymmetricQuoter()
    assert strategy.bid_allowed(5) is False
    assert strategy.ask_allowed(5) is True


def test_short_position_disables_ask_side():
    strategy = SymmetricQuoter()
    assert strategy.bid_allowed(-3) is True
    assert strategy.ask_allowed(-3) is False