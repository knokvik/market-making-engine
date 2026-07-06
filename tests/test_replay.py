from pathlib import Path

from mm_engine.replay import ReplayConfig, ReplayController

ROOT = Path(__file__).resolve().parents[1]


def test_replay_controller_steps_forward_and_emits_frame():
    controller = ReplayController(
        ReplayConfig(dataset="data/sample_session.csv", strategy="avellaneda_stoikov"),
        root=ROOT,
    )
    controller.reset()
    frame0 = controller.current_frame()
    assert frame0.frame_index == -1

    frame1 = controller.step_forward()
    assert frame1.frame_index == 0
    assert frame1.total_frames > 0


def test_replay_detects_regime_label():
    controller = ReplayController(
        ReplayConfig(regime="calm", strategy="symmetric"),
        root=ROOT,
    )
    controller.reset()
    for _ in range(5):
        controller.step_forward()
    frame = controller.current_frame()
    assert frame.regime in {"calm", "normal", "volatile", "trending", "high_toxicity"}


def test_replay_seek_backward():
    controller = ReplayController(
        ReplayConfig(dataset="data/sample_session.csv"),
        root=ROOT,
    )
    controller.reset()
    controller.step_forward()
    controller.step_forward()
    frame = controller.step_backward()
    assert frame.frame_index == 0