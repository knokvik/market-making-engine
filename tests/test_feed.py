from pathlib import Path

from mm_engine.feed import EventType, load_csv_feed, load_lobster_messages

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def test_load_csv_feed_parses_sample_session():
    events = list(load_csv_feed(DATA_DIR / "sample_session.csv"))
    assert len(events) == 20
    assert events[0].event_type is EventType.ADD
    assert events[0].order_id == 1
    assert events[-1].event_type is EventType.EXECUTION


def test_load_lobster_messages_parses_sample_file():
    events = list(load_lobster_messages(DATA_DIR / "sample_lobster.csv"))
    assert len(events) == 10
    assert events[0].event_type is EventType.ADD
    assert events[5].event_type is EventType.EXECUTION
    assert events[-2].event_type is EventType.CANCEL