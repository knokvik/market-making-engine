from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from typing import Optional

_USER_AGENT = "Mozilla/5.0 (compatible; mm-engine/1.0)"


@dataclass
class YahooQuote:
    bid: float
    ask: float
    mid: float
    previous_close: float = 0.0


def fetch_yahoo_quote(symbol: str) -> Optional[YahooQuote]:
    """Return bid/ask/mid from Yahoo Finance chart API — no API key required."""
    sym = symbol.upper()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1m&range=1d"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", _USER_AGENT)
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        result = (data.get("chart") or {}).get("result") or []
        if not result:
            return None
        meta = result[0].get("meta") or {}
        mid = float(meta.get("regularMarketPrice") or 0)
        if mid <= 0:
            return None
        prev = float(meta.get("chartPreviousClose") or meta.get("previousClose") or 0)
        spread_bps = 3.0
        half = mid * (spread_bps / 10_000.0)
        bid = round(mid - half, 4)
        ask = round(mid + half, 4)
        return YahooQuote(bid=bid, ask=ask, mid=round(mid, 4), previous_close=prev)
    except Exception:
        return None