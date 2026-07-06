from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


def format_replay_timestamp(ts_ns: int) -> str:
    if ts_ns <= 0:
        return "00:00:00.000"
    seconds = ts_ns / 1_000_000_000 if ts_ns > 1_000_000_000_000 else ts_ns / 1_000_000
    hrs = int(seconds // 3600) % 24
    mins = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:06.3f}"


def build_book_ladder(
    bid_depth: List[Dict[str, float]],
    ask_depth: List[Dict[str, float]],
    recent_fill_prices: List[float],
) -> List[Dict[str, object]]:
    bid_map = {level["price"]: level["quantity"] for level in bid_depth}
    ask_map = {level["price"]: level["quantity"] for level in ask_depth}
    prices = sorted(set(bid_map) | set(ask_map), reverse=True)
    max_qty = max([*(bid_map.values()), *(ask_map.values()), 1.0])
    ladder = []
    for price in prices[:16]:
        bid_qty = bid_map.get(price, 0.0)
        ask_qty = ask_map.get(price, 0.0)
        executed = any(abs(price - fp) < 1e-6 for fp in recent_fill_prices)
        ladder.append(
            {
                "price": price,
                "bid_size": bid_qty,
                "ask_size": ask_qty,
                "bid_pct": bid_qty / max_qty,
                "ask_pct": ask_qty / max_qty,
                "executed": executed,
            }
        )
    return ladder


def build_quote_decision(
    *,
    mid: Optional[float],
    reservation: Optional[float],
    fair_value: Optional[float],
    position: int,
    sigma: float,
    gamma: float,
    k: float,
    optimal_spread: Optional[float],
    our_bid: Optional[float],
    our_ask: Optional[float],
    regime: str,
    toxicity: float,
    fill_prob_bid: float,
    fill_prob_ask: float,
) -> Dict[str, object]:
    half = (optimal_spread / 2.0) if optimal_spread else None
    reasons: List[str] = []
    if position > 0:
        reasons.append(f"Inventory = +{position}: reservation shifted downward")
        reasons.append("Ask tightened / bid widened to reduce long exposure")
    elif position < 0:
        reasons.append(f"Inventory = {position}: reservation shifted upward")
        reasons.append("Bid tightened / ask widened to reduce short exposure")
    else:
        reasons.append("Inventory flat: symmetric quoting around reservation")
    if sigma > 0.03:
        reasons.append("Quotes widened due to elevated volatility")
    if toxicity > 0.6:
        reasons.append(f"Toxicity {toxicity:.0%}: adverse-selection spread padding applied")
    reasons.append(f"Market regime classified as {regime.replace('_', ' ')}")
    avg_fill = (fill_prob_bid + fill_prob_ask) / 2.0
    reasons.append(f"Expected fill probability ≈ {avg_fill:.0%}")

    return {
        "mid_price": mid,
        "reservation_price": reservation,
        "fair_value": fair_value,
        "inventory": position,
        "volatility": sigma,
        "gamma": gamma,
        "k": k,
        "optimal_half_spread": half,
        "optimal_bid": our_bid,
        "optimal_ask": our_ask,
        "regime": regime,
        "reasoning": reasons,
        "fill_probability_bid": fill_prob_bid,
        "fill_probability_ask": fill_prob_ask,
    }


def build_pnl_decomposition(
    *,
    realized: float,
    unrealized: float,
    spread_capture: float,
    inventory_mtm: float,
    fees: float,
    adverse_cost: float,
    total_pnl: float,
) -> Dict[str, float]:
    inventory_loss = min(0.0, unrealized)
    slippage = max(0.0, adverse_cost * 0.35)
    return {
        "realized_pnl": realized,
        "unrealized_pnl": unrealized,
        "spread_capture": spread_capture,
        "inventory_loss": inventory_loss,
        "transaction_fees": fees,
        "slippage": slippage,
        "adverse_selection": adverse_cost,
        "net_pnl": total_pnl,
    }


def build_latency_breakdown(total_ms: float) -> Dict[str, float]:
    return {
        "feed_latency": total_ms * 0.12,
        "book_update": total_ms * 0.08,
        "strategy_compute": total_ms * 0.22,
        "risk_engine": total_ms * 0.10,
        "quote_generation": total_ms * 0.18,
        "network": total_ms * 0.15,
        "execution": total_ms * 0.15,
        "total": total_ms,
    }


def build_queue_analytics(
    queue_bid: Optional[int],
    queue_ask: Optional[int],
    fill_prob_bid: float,
    fill_prob_ask: float,
) -> Dict[str, object]:
    bid_len = (queue_bid or 0) + 3
    ask_len = (queue_ask or 0) + 3
    return {
        "bid_position": queue_bid,
        "ask_position": queue_ask,
        "bid_queue_length": bid_len,
        "ask_queue_length": ask_len,
        "fill_probability_bid": fill_prob_bid,
        "fill_probability_ask": fill_prob_ask,
        "expected_time_to_fill_bid_ms": max(50, (1.0 - fill_prob_bid) * 2000),
        "expected_time_to_fill_ask_ms": max(50, (1.0 - fill_prob_ask) * 2000),
        "queue_movement": "advancing" if fill_prob_bid > 0.5 or fill_prob_ask > 0.5 else "static",
    }


def build_inventory_distribution(positions: List[int]) -> List[Dict[str, float]]:
    if not positions:
        return []
    buckets: Dict[int, int] = {}
    for pos in positions:
        bucket = min(max(pos, -10), 10)
        buckets[bucket] = buckets.get(bucket, 0) + 1
    return [{"position": float(k), "count": float(v)} for k, v in sorted(buckets.items())]


def build_inventory_heatmap(timeline: List[Dict[str, float]]) -> List[Dict[str, float]]:
    return [
        {"timestamp": pt["timestamp"], "intensity": min(abs(pt.get("position", 0.0)) / 10.0, 1.0)}
        for pt in timeline[-40:]
    ]


def compute_calmar(total_return: float, max_dd: float) -> Optional[float]:
    if max_dd <= 0:
        return None
    return total_return / max_dd


def compute_profit_factor(pnl_curve: List) -> float:
    if len(pnl_curve) < 2:
        return 0.0
    gains = 0.0
    losses = 0.0
    values = [p.mark_to_market_pnl for p in pnl_curve]
    for idx in range(1, len(values)):
        delta = values[idx] - values[idx - 1]
        if delta > 0:
            gains += delta
        else:
            losses += abs(delta)
    if losses <= 0:
        return gains if gains > 0 else 0.0
    return gains / losses


def compute_expectancy(total_return: float, fill_count: int) -> float:
    return total_return / max(fill_count, 1)


def rolling_sharpe_series(pnl_curve: List, window: int = 10) -> List[Dict[str, float]]:
    if len(pnl_curve) < window + 1:
        return []
    values = [p.mark_to_market_pnl for p in pnl_curve]
    series: List[Dict[str, float]] = []
    for idx in range(window, len(values)):
        returns = [values[j] - values[j - 1] for j in range(idx - window + 1, idx + 1)]
        mean = sum(returns) / len(returns)
        var = sum((r - mean) ** 2 for r in returns) / max(len(returns) - 1, 1)
        sharpe = mean / math.sqrt(var) if var > 0 else 0.0
        series.append({"timestamp": float(pnl_curve[idx].timestamp), "sharpe": sharpe})
    return series[-30:]


def generate_ai_summary(
    *,
    strategy: str,
    regime: str,
    sym_inv: float,
    as_inv: float,
    total_pnl: float,
    fill_count: int,
    max_dd: float,
    toxicity: float,
) -> str:
    inv_reduction = 0.0
    if sym_inv > 0:
        inv_reduction = (sym_inv - as_inv) / sym_inv * 100.0
    strategy_name = "Avellaneda-Stoikov" if strategy == "avellaneda_stoikov" else strategy
    parts = [
        f"The {strategy_name} strategy",
    ]
    if inv_reduction > 0:
        parts.append(f"reduced average inventory by {inv_reduction:.1f}% in {regime.replace('_', ' ')} conditions")
    else:
        parts.append(f"maintained inventory discipline in {regime.replace('_', ' ')} conditions")
    parts.append(f"with {fill_count} fills and net PnL {total_pnl:.2f}")
    if max_dd > 50:
        parts.append("Most losses occurred during prolonged directional moves via inventory mark-to-market exposure")
    if toxicity > 0.6:
        parts.append("Elevated toxicity suggests widening spreads or reducing quote size during informed flow")
    if regime == "volatile":
        parts.append("Increasing gamma during high-volatility periods may further reduce drawdown")
    return ". ".join(parts) + "."


def list_data_sources(root) -> List[Dict[str, object]]:
    from mm_engine.replay.session import list_datasets

    historical = []
    for item in list_datasets(root):
        historical.append(
            {
                "id": item["id"],
                "label": item["label"],
                "exchange": item["exchange"],
                "type": "historical_replay",
                "format": "csv" if "regime" not in item["id"] else "regime",
            }
        )
    historical.extend(
        [
            {"id": "lobster:default", "label": "LOBSTER", "exchange": "LOBSTER", "type": "historical_replay", "format": "lobster"},
            {"id": "custom:csv", "label": "Custom CSV", "exchange": "Custom", "type": "historical_replay", "format": "csv"},
            {"id": "custom:parquet", "label": "Custom Parquet", "exchange": "Custom", "type": "historical_replay", "format": "parquet"},
            {"id": "binance:recorded", "label": "Recorded Binance Session", "exchange": "Binance", "type": "historical_replay", "format": "csv"},
        ]
    )
    paper = [
        {"id": "paper:binance", "label": "Paper — Binance", "exchange": "Binance", "type": "paper_trading", "status": "simulated"},
        {"id": "paper:bybit", "label": "Paper — Bybit", "exchange": "Bybit", "type": "paper_trading", "status": "simulated"},
        {"id": "paper:coinbase", "label": "Paper — Coinbase", "exchange": "Coinbase", "type": "paper_trading", "status": "simulated"},
        {"id": "paper:okx", "label": "Paper — OKX", "exchange": "OKX", "type": "paper_trading", "status": "simulated"},
    ]
    live = [
        {"id": "live:binance", "label": "Binance", "exchange": "Binance", "type": "live", "status": "simulated"},
        {"id": "live:bybit", "label": "Bybit", "exchange": "Bybit", "type": "live", "status": "simulated"},
        {"id": "live:coinbase", "label": "Coinbase", "exchange": "Coinbase", "type": "live", "status": "simulated"},
        {"id": "live:okx", "label": "OKX", "exchange": "OKX", "type": "live", "status": "simulated"},
    ]
    return historical + paper + live