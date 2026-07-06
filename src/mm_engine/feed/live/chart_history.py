from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

_USER_AGENT = "Mozilla/5.0 (compatible; mm-engine/1.0)"

VALID_RANGES = ("1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX")

# Yahoo: (range, interval)
_YAHOO_RANGE: Dict[str, Tuple[str, str]] = {
    "1D": ("1d", "5m"),
    "5D": ("5d", "15m"),
    "1M": ("1mo", "1h"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
    "MAX": ("max", "1mo"),
}

# Binance kline interval + approximate bar count
_BINANCE_RANGE: Dict[str, Tuple[str, int]] = {
    "1D": ("5m", 288),
    "5D": ("15m", 480),
    "1M": ("1h", 720),
    "3M": ("4h", 540),
    "6M": ("1d", 180),
    "1Y": ("1d", 365),
    "5Y": ("1wk", 260),
    "MAX": ("1mo", 120),
}


def _http_get(url: str) -> Any:
    req = urllib.request.Request(url)
    req.add_header("User-Agent", _USER_AGENT)
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode())


def _yahoo_bars(symbol: str, range_key: str) -> List[Dict[str, float]]:
    yahoo_range, interval = _YAHOO_RANGE[range_key]
    params = urllib.parse.urlencode({"interval": interval, "range": yahoo_range})
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol.upper()}?{params}"
    try:
        data = _http_get(url)
        result = (data.get("chart") or {}).get("result") or []
        if not result:
            return []
        block = result[0]
        timestamps = block.get("timestamp") or []
        quote = (block.get("indicators") or {}).get("quote") or [{}]
        q = quote[0] if quote else {}
        opens = q.get("open") or []
        highs = q.get("high") or []
        lows = q.get("low") or []
        closes = q.get("close") or []
        volumes = q.get("volume") or []
        bars: List[Dict[str, float]] = []
        for i, ts in enumerate(timestamps):
            if ts is None:
                continue
            close = closes[i] if i < len(closes) else None
            if close is None:
                continue
            o = opens[i] if i < len(opens) and opens[i] is not None else close
            h = highs[i] if i < len(highs) and highs[i] is not None else close
            lo = lows[i] if i < len(lows) and lows[i] is not None else close
            vol = volumes[i] if i < len(volumes) and volumes[i] is not None else 0
            bars.append(
                {
                    "timestamp": int(ts) * 1000,
                    "open": float(o),
                    "high": float(h),
                    "low": float(lo),
                    "close": float(close),
                    "volume": float(vol),
                }
            )
        return bars
    except Exception:
        return []


def _binance_bars(symbol: str, range_key: str) -> List[Dict[str, float]]:
    interval, limit = _BINANCE_RANGE[range_key]
    sym = symbol.upper()
    params = urllib.parse.urlencode({"symbol": sym, "interval": interval, "limit": min(limit, 1000)})
    url = f"https://api.binance.com/api/v3/klines?{params}"
    try:
        rows = _http_get(url)
        if not isinstance(rows, list):
            return []
        bars: List[Dict[str, float]] = []
        for row in rows:
            if not isinstance(row, list) or len(row) < 6:
                continue
            bars.append(
                {
                    "timestamp": int(row[0]),
                    "open": float(row[1]),
                    "high": float(row[2]),
                    "low": float(row[3]),
                    "close": float(row[4]),
                    "volume": float(row[5]),
                }
            )
        return bars
    except Exception:
        return []


def fetch_chart_history(
    *,
    symbol: str,
    asset_class: str = "stock",
    range_key: str = "1D",
) -> Dict[str, Any]:
    rk = range_key.upper() if range_key.upper() in VALID_RANGES else "1D"
    sym = symbol.upper().strip()
    if not sym:
        return {"bars": [], "range": rk, "symbol": sym, "asset_class": asset_class}

    if asset_class == "crypto":
        bars = _binance_bars(sym, rk)
    else:
        bars = _yahoo_bars(sym, rk)

    return {
        "symbol": sym,
        "asset_class": asset_class,
        "range": rk,
        "bars": bars,
        "fetched_at": int(time.time() * 1000),
    }