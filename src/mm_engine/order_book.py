from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from mm_engine.types import Fill, Order, Side


@dataclass
class _PriceLevel:
    price: float
    orders: OrderedDict[int, Order] = field(default_factory=OrderedDict)
    total_quantity: int = 0

    def is_empty(self) -> bool:
        return not self.orders

    def add(self, order: Order) -> None:
        self.orders[order.order_id] = order
        self.total_quantity += order.quantity

    def remove(self, order_id: int) -> Optional[Order]:
        order = self.orders.pop(order_id, None)
        if order is None:
            return None
        self.total_quantity -= order.quantity
        return order

    def peek(self) -> Optional[Order]:
        if self.is_empty():
            return None
        return next(iter(self.orders.values()))


class OrderBook:
    """Price-time priority limit order book.

    Complexity targets (standard interview answer):
    - Top-of-book read: O(1)
    - Cancel by order id: O(1) lookup + O(1) removal from price level
    - Add limit order: O(1) append at price level + O(1) best-price update
    - Aggressive match: O(k) in number of consumed price levels and fills
    """

    def __init__(self) -> None:
        self._bids: Dict[float, _PriceLevel] = {}
        self._asks: Dict[float, _PriceLevel] = {}
        self._order_index: Dict[int, Tuple[Side, float]] = {}
        self._best_bid: Optional[float] = None
        self._best_ask: Optional[float] = None
        self._next_order_id: int = 1

    @property
    def best_bid(self) -> Optional[float]:
        return self._best_bid

    @property
    def best_ask(self) -> Optional[float]:
        return self._best_ask

    @property
    def mid_price(self) -> Optional[float]:
        if self._best_bid is None or self._best_ask is None:
            return None
        return (self._best_bid + self._best_ask) / 2.0

    @property
    def spread(self) -> Optional[float]:
        if self._best_bid is None or self._best_ask is None:
            return None
        return self._best_ask - self._best_bid

    def _levels(self, side: Side) -> Dict[float, _PriceLevel]:
        return self._bids if side is Side.BID else self._asks

    def _update_best_on_add(self, side: Side, price: float) -> None:
        if side is Side.BID:
            if self._best_bid is None or price > self._best_bid:
                self._best_bid = price
        elif self._best_ask is None or price < self._best_ask:
            self._best_ask = price

    def _refresh_best(self, side: Side) -> None:
        levels = self._levels(side)
        if side is Side.BID:
            self._best_bid = max(levels) if levels else None
        else:
            self._best_ask = min(levels) if levels else None

    def add_limit_order(
        self,
        side: Side,
        price: float,
        quantity: int,
        *,
        order_id: Optional[int] = None,
        timestamp: int = 0,
    ) -> Tuple[int, List[Fill]]:
        """Post a limit order. Marketable orders cross the book immediately."""
        if quantity <= 0:
            raise ValueError("quantity must be positive")
        if price <= 0:
            raise ValueError("price must be positive")

        oid = order_id if order_id is not None else self._next_order_id
        if order_id is None:
            self._next_order_id += 1
        elif oid in self._order_index:
            raise ValueError(f"order_id {oid} already exists")

        order = Order(order_id=oid, side=side, price=price, quantity=quantity, timestamp=timestamp)
        fills, remaining = self._match_aggressor(order)
        if remaining == 0:
            return oid, fills

        resting = Order(
            order_id=oid,
            side=side,
            price=price,
            quantity=remaining,
            timestamp=timestamp,
        )
        levels = self._levels(side)
        level = levels.get(price)
        if level is None:
            level = _PriceLevel(price=price)
            levels[price] = level
        level.add(resting)
        self._order_index[oid] = (side, price)
        self._update_best_on_add(side, price)
        return oid, fills

    def cancel_order(self, order_id: int) -> Optional[Order]:
        location = self._order_index.pop(order_id, None)
        if location is None:
            return None

        side, price = location
        levels = self._levels(side)
        level = levels[price]
        order = level.remove(order_id)
        if order is None:
            return None

        if level.is_empty():
            del levels[price]
            if side is Side.BID and price == self._best_bid:
                self._refresh_best(side)
            elif side is Side.ASK and price == self._best_ask:
                self._refresh_best(side)
        return order

    def add_market_order(
        self,
        side: Side,
        quantity: int,
        *,
        order_id: Optional[int] = None,
        timestamp: int = 0,
    ) -> Tuple[int, List[Fill]]:
        """Market order with an effectively infinite limit price."""
        if quantity <= 0:
            raise ValueError("quantity must be positive")

        oid = order_id if order_id is not None else self._next_order_id
        if order_id is None:
            self._next_order_id += 1
        elif oid in self._order_index:
            raise ValueError(f"order_id {oid} already exists")

        limit_price = float("inf") if side is Side.BID else 0.0
        order = Order(order_id=oid, side=side, price=limit_price, quantity=quantity, timestamp=timestamp)
        fills, _ = self._match_aggressor(order)
        return oid, fills

    def _match_aggressor(self, aggressor: Order) -> Tuple[List[Fill], int]:
        fills: List[Fill] = []
        book_side = aggressor.side.opposite
        levels = self._levels(book_side)

        while aggressor.quantity > 0 and levels:
            best_price = self._best_ask if book_side is Side.ASK else self._best_bid
            if best_price is None:
                break
            if not self._price_crosses(aggressor.side, aggressor.price, best_price):
                break

            level = levels[best_price]
            while aggressor.quantity > 0 and not level.is_empty():
                maker = level.peek()
                assert maker is not None

                trade_qty = min(aggressor.quantity, maker.quantity)
                fills.append(
                    Fill(
                        maker_order_id=maker.order_id,
                        taker_order_id=aggressor.order_id,
                        price=maker.price,
                        quantity=trade_qty,
                        side=aggressor.side,
                        timestamp=aggressor.timestamp,
                    )
                )

                aggressor = Order(
                    order_id=aggressor.order_id,
                    side=aggressor.side,
                    price=aggressor.price,
                    quantity=aggressor.quantity - trade_qty,
                    timestamp=aggressor.timestamp,
                )

                if maker.quantity == trade_qty:
                    self.cancel_order(maker.order_id)
                else:
                    updated = Order(
                        order_id=maker.order_id,
                        side=maker.side,
                        price=maker.price,
                        quantity=maker.quantity - trade_qty,
                        timestamp=maker.timestamp,
                    )
                    level.remove(maker.order_id)
                    level.add(updated)
                    self._order_index[maker.order_id] = (maker.side, maker.price)

            if best_price in levels and levels[best_price].is_empty():
                del levels[best_price]
                self._refresh_best(book_side)

        return fills, aggressor.quantity

    @staticmethod
    def _price_crosses(aggressor_side: Side, aggressor_price: float, resting_price: float) -> bool:
        if aggressor_side is Side.BID:
            return aggressor_price >= resting_price
        return aggressor_price <= resting_price

    def depth(self, side: Side, levels: int = 5) -> List[Tuple[float, int]]:
        """Return up to `levels` price levels as (price, total_quantity)."""
        book = self._bids if side is Side.BID else self._asks
        prices = sorted(book.keys(), reverse=(side is Side.BID))
        return [(price, book[price].total_quantity) for price in prices[:levels]]

    def order_count(self) -> int:
        return len(self._order_index)

    def get_order(self, order_id: int) -> Optional[Order]:
        location = self._order_index.get(order_id)
        if location is None:
            return None
        side, price = location
        level = self._levels(side)[price]
        return level.orders.get(order_id)

    def reduce_order(self, order_id: int, quantity: int) -> Optional[Order]:
        """Reduce resting order size; remove it when quantity reaches zero."""
        if quantity <= 0:
            raise ValueError("quantity must be positive")

        order = self.get_order(order_id)
        if order is None:
            return None
        if quantity >= order.quantity:
            return self.cancel_order(order_id)

        side, price = self._order_index[order_id]
        level = self._levels(side)[price]
        level.remove(order_id)
        updated = Order(
            order_id=order_id,
            side=order.side,
            price=order.price,
            quantity=order.quantity - quantity,
            timestamp=order.timestamp,
        )
        level.add(updated)
        return updated