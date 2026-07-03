import pytest

from mm_engine import OrderBook, Side


class TestOrderBookBasics:
    def test_empty_book_has_no_top_of_book(self):
        book = OrderBook()
        assert book.best_bid is None
        assert book.best_ask is None
        assert book.mid_price is None
        assert book.spread is None

    def test_add_bid_updates_best_bid(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 10)
        assert book.best_bid == 100.0
        assert book.best_ask is None

    def test_add_ask_updates_best_ask(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 101.0, 5)
        assert book.best_ask == 101.0
        assert book.best_bid is None

    def test_higher_bid_becomes_best(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 10)
        book.add_limit_order(Side.BID, 100.5, 10)
        assert book.best_bid == 100.5

    def test_lower_ask_becomes_best(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 101.0, 5)
        book.add_limit_order(Side.ASK, 100.8, 5)
        assert book.best_ask == 100.8

    def test_mid_and_spread(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 10)
        book.add_limit_order(Side.ASK, 100.2, 10)
        assert book.mid_price == pytest.approx(100.1)
        assert book.spread == pytest.approx(0.2)


class TestCancel:
    def test_cancel_existing_order(self):
        book = OrderBook()
        oid, _ = book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
        cancelled = book.cancel_order(oid)
        assert cancelled is not None
        assert cancelled.quantity == 10
        assert book.best_bid is None
        assert book.order_count() == 0

    def test_cancel_unknown_order_returns_none(self):
        book = OrderBook()
        assert book.cancel_order(999) is None

    def test_cancel_best_refreshes_to_next_level(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.5, 10, order_id=1)
        book.add_limit_order(Side.BID, 100.0, 10, order_id=2)
        book.cancel_order(1)
        assert book.best_bid == 100.0
        assert book.depth(Side.BID, levels=2) == [(100.0, 10)]

    def test_partial_level_cancel_keeps_price_level(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
        book.add_limit_order(Side.BID, 100.0, 5, order_id=2)
        book.cancel_order(1)
        assert book.best_bid == 100.0
        assert book.depth(Side.BID) == [(100.0, 5)]


class TestMatching:
    def test_aggressive_bid_crosses_resting_ask(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 100.0, 10, order_id=1)
        _, fills = book.add_limit_order(Side.BID, 100.0, 6, order_id=2)
        assert len(fills) == 1
        assert fills[0].price == 100.0
        assert fills[0].quantity == 6
        assert fills[0].maker_order_id == 1
        assert fills[0].taker_order_id == 2
        assert book.best_ask == 100.0
        assert book.depth(Side.ASK) == [(100.0, 4)]

    def test_aggressive_ask_crosses_resting_bid(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 99.5, 8, order_id=1)
        _, fills = book.add_limit_order(Side.ASK, 99.5, 3, order_id=2)
        assert len(fills) == 1
        assert fills[0].quantity == 3
        assert book.depth(Side.BID) == [(99.5, 5)]

    def test_price_time_priority_fifo(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 100.0, 5, order_id=1, timestamp=1)
        book.add_limit_order(Side.ASK, 100.0, 5, order_id=2, timestamp=2)
        _, fills = book.add_limit_order(Side.BID, 100.0, 7, order_id=3)
        assert [f.maker_order_id for f in fills] == [1, 2]
        assert [f.quantity for f in fills] == [5, 2]
        assert book.depth(Side.ASK) == [(100.0, 3)]

    def test_multi_level_sweep(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 100.0, 5, order_id=1)
        book.add_limit_order(Side.ASK, 100.5, 5, order_id=2)
        _, fills = book.add_limit_order(Side.BID, 101.0, 8, order_id=3)
        assert len(fills) == 2
        assert fills[0].price == 100.0
        assert fills[1].price == 100.5
        assert sum(f.quantity for f in fills) == 8
        assert book.best_ask == 100.5
        assert book.depth(Side.ASK) == [(100.5, 2)]

    def test_non_marketable_limit_rest_on_book(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 101.0, 5, order_id=1)
        _, fills = book.add_limit_order(Side.BID, 100.5, 4, order_id=2)
        assert fills == []
        assert book.best_bid == 100.5
        assert book.best_ask == 101.0

    def test_market_order_walks_the_book(self):
        book = OrderBook()
        book.add_limit_order(Side.ASK, 100.0, 3, order_id=1)
        book.add_limit_order(Side.ASK, 100.5, 4, order_id=2)
        _, fills = book.add_market_order(Side.BID, 5, order_id=3)
        assert len(fills) == 2
        assert sum(f.quantity for f in fills) == 5
        assert book.best_ask == 100.5
        assert book.depth(Side.ASK) == [(100.5, 2)]

    def test_full_fill_removes_resting_order(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 5, order_id=1)
        book.add_limit_order(Side.ASK, 100.0, 5, order_id=2)
        assert book.order_count() == 0
        assert book.best_bid is None
        assert book.best_ask is None


class TestValidation:
    def test_rejects_non_positive_quantity(self):
        book = OrderBook()
        with pytest.raises(ValueError):
            book.add_limit_order(Side.BID, 100.0, 0)

    def test_rejects_duplicate_order_id(self):
        book = OrderBook()
        book.add_limit_order(Side.BID, 100.0, 1, order_id=42)
        with pytest.raises(ValueError):
            book.add_limit_order(Side.ASK, 101.0, 1, order_id=42)