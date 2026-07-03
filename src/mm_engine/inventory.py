from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from mm_engine.types import Fill, Side


@dataclass
class InventoryState:
    position: int = 0
    cash: float = 0.0
    realized_pnl: float = 0.0
    buy_volume: int = 0
    sell_volume: int = 0
    fill_count: int = 0


@dataclass
class InventoryManager:
    """Track position, cash, and realized PnL from strategy fills."""

    state: InventoryState = field(default_factory=InventoryState)
    _avg_entry_price: float = 0.0

    @property
    def position(self) -> int:
        return self.state.position

    def on_fill(self, fill: Fill, our_order_id: int) -> None:
        if fill.maker_order_id == our_order_id:
            qty = fill.quantity
            price = fill.price
            # fill.side is the aggressor; a sell aggressor hits our bid.
            if fill.side is Side.ASK:
                self._apply_buy(qty, price)
            else:
                self._apply_sell(qty, price)
            self.state.fill_count += 1
            return

        if fill.taker_order_id == our_order_id:
            qty = fill.quantity
            price = fill.price
            if fill.side is Side.BID:
                self._apply_buy(qty, price)
            else:
                self._apply_sell(qty, price)
            self.state.fill_count += 1

    def _apply_buy(self, quantity: int, price: float) -> None:
        self.state.cash -= price * quantity
        self.state.buy_volume += quantity
        self._update_position(self.state.position + quantity, price, quantity, is_buy=True)

    def _apply_sell(self, quantity: int, price: float) -> None:
        self.state.cash += price * quantity
        self.state.sell_volume += quantity
        self._update_position(self.state.position - quantity, price, quantity, is_buy=False)

    def _update_position(self, new_position: int, price: float, quantity: int, *, is_buy: bool) -> None:
        old_position = self.state.position

        if old_position == 0:
            self._avg_entry_price = price
        elif (old_position > 0 and not is_buy) or (old_position < 0 and is_buy):
            closed_qty = min(abs(old_position), quantity)
            if old_position > 0:
                self.state.realized_pnl += (price - self._avg_entry_price) * closed_qty
            else:
                self.state.realized_pnl += (self._avg_entry_price - price) * closed_qty

        self.state.position = new_position

        if new_position == 0:
            self._avg_entry_price = 0.0
        elif (old_position >= 0 and new_position > old_position) or (old_position <= 0 and new_position < old_position):
            total_qty = abs(new_position)
            prev_qty = abs(old_position)
            if total_qty > 0:
                self._avg_entry_price = (
                    (self._avg_entry_price * prev_qty) + (price * quantity)
                ) / total_qty

    def mark_to_market(self, mid_price: float) -> float:
        return self.state.cash + self.state.position * mid_price

    def unrealized_pnl(self, mid_price: float) -> float:
        if self.state.position == 0:
            return 0.0
        return (mid_price - self._avg_entry_price) * self.state.position


@dataclass(frozen=True)
class PnLSnapshot:
    timestamp: int
    mid_price: float
    position: int
    cash: float
    realized_pnl: float
    mark_to_market_pnl: float
    unrealized_pnl: float