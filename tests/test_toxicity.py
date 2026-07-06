from pathlib import Path

from mm_engine.backtest import BacktestEngine
from mm_engine.feed import load_csv_feed
from mm_engine.feed.events import EventType, MarketEvent
from mm_engine.order_book import OrderBook
from mm_engine.reporting import export_backtest_csv
from mm_engine.simulation.config import SimulationConfig
from mm_engine.simulation.toxicity import ToxicityMonitor
from mm_engine.strategy import (
    AvellanedaStoikovConfig,
    AvellanedaStoikovQuoter,
    toxicity_spread_padding,
)
from mm_engine.types import Side

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _imbalanced_buy_events(count: int = 25) -> list:
    events = []
    ts = 1_000
    for idx in range(count):
        events.append(
            MarketEvent(
                timestamp=ts,
                event_type=EventType.ADD,
                order_id=idx + 1,
                side=Side.BID,
                price=100.0,
                quantity=10,
            )
        )
        ts += 100
    return events


def test_toxicity_monitor_rises_on_buy_imbalance():
    monitor = ToxicityMonitor(window=20)
    for event in _imbalanced_buy_events():
        monitor.on_market_event(event)
    assert monitor.level() > 0.9


def test_toxicity_monitor_stays_zero_without_flow():
    monitor = ToxicityMonitor(window=20)
    assert monitor.level() == 0.0


def test_toxicity_widens_as_spreads():
    book = OrderBook()
    book.add_limit_order(Side.BID, 100.0, 10, order_id=1)
    book.add_limit_order(Side.ASK, 100.2, 10, order_id=2)

    flat = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(use_volatility_estimator=False, use_toxicity_widening=True)
    )
    toxic = AvellanedaStoikovQuoter(
        AvellanedaStoikovConfig(use_volatility_estimator=False, use_toxicity_widening=True)
    )
    toxic.set_toxicity_level(1.0)

    quote_flat = flat.compute_quote(book, position=0)
    quote_toxic = toxic.compute_quote(book, position=0)
    assert quote_flat is not None and quote_toxic is not None
    assert quote_toxic.bid_price < quote_flat.bid_price
    assert quote_toxic.ask_price > quote_flat.ask_price


def test_toxicity_spread_padding_scales_with_level():
    low = toxicity_spread_padding(0.5, 100.0, 25.0)
    high = toxicity_spread_padding(1.0, 100.0, 25.0)
    assert high == 2 * low


def test_backtest_records_toxicity_curve_when_enabled():
    events = list(load_csv_feed(DATA_DIR / "sample_session.csv"))
    result = BacktestEngine(
        simulation=SimulationConfig(enable_toxicity_monitor=True, toxicity_window=10),
    ).run(events)
    assert len(result.toxicity_curve) == len(events)
    assert all(0.0 <= point.level <= 1.0 for point in result.toxicity_curve)


def test_export_backtest_csv_writes_curve(tmp_path):
    events = list(load_csv_feed(DATA_DIR / "sample_session.csv"))
    result = BacktestEngine(
        simulation=SimulationConfig(enable_toxicity_monitor=True),
    ).run(events)
    out = tmp_path / "curve.csv"
    export_backtest_csv(result, out)
    text = out.read_text()
    assert "timestamp,mid_price,position" in text
    assert "toxicity" in text
    assert out.with_suffix(".summary.txt").exists()