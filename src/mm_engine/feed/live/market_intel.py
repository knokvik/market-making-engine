from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from mm_engine.feed.live.yahoo import fetch_yahoo_quote

US_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMZN", "META", "SPY"]

_BASE_PRICES: Dict[str, float] = {
    "AAPL": 228.0,
    "MSFT": 420.0,
    "GOOGL": 175.0,
    "TSLA": 342.0,
    "NVDA": 195.0,
    "AMZN": 205.0,
    "META": 590.0,
    "SPY": 595.0,
}

_DEMO_NEWS: List[Dict[str, Any]] = [
    {
        "id": "n1",
        "headline": "Tech stocks rally on strong earnings outlook",
        "source": "Market Wire",
        "created_at": "2026-07-05T14:30:00Z",
        "symbols": ["AAPL", "MSFT", "NVDA"],
        "summary": "Mega-cap tech leads broad market gains ahead of earnings season.",
    },
    {
        "id": "n2",
        "headline": "NVDA extends gains as AI demand stays elevated",
        "source": "Desk Intel",
        "created_at": "2026-07-05T14:15:00Z",
        "symbols": ["NVDA"],
        "summary": "Semiconductor names outperform as data-center spend remains robust.",
    },
    {
        "id": "n3",
        "headline": "TSLA volatility picks up after delivery estimates revise",
        "source": "Street Pulse",
        "created_at": "2026-07-05T13:50:00Z",
        "symbols": ["TSLA"],
        "summary": "Traders reposition as auto sector sees mixed guidance.",
    },
    {
        "id": "n4",
        "headline": "Fed speakers signal patience on rate path",
        "source": "Macro Brief",
        "created_at": "2026-07-05T13:20:00Z",
        "symbols": ["SPY"],
        "summary": "Index futures steady as policymakers emphasize data dependence.",
    },
    {
        "id": "n5",
        "headline": "AMZN cloud unit cited in analyst upgrade",
        "source": "Research Desk",
        "created_at": "2026-07-05T12:45:00Z",
        "symbols": ["AMZN"],
        "summary": "E-commerce and AWS momentum support constructive sentiment.",
    },
    {
        "id": "n6",
        "headline": "META ad revenue trends improve in Q2 checks",
        "source": "Ad Tracker",
        "created_at": "2026-07-05T12:10:00Z",
        "symbols": ["META"],
        "summary": "Digital ad spend recovery supports social media complex.",
    },
    {
        "id": "n7",
        "headline": "GOOGL search monetization holds firm in channel checks",
        "source": "Tech Monitor",
        "created_at": "2026-07-05T11:40:00Z",
        "symbols": ["GOOGL"],
        "summary": "Alphabet remains a quality compounder in large-cap growth baskets.",
    },
    {
        "id": "n8",
        "headline": "Broad market breadth improves into afternoon session",
        "source": "Flow Watch",
        "created_at": "2026-07-05T11:05:00Z",
        "symbols": ["SPY", "AAPL", "MSFT"],
        "summary": "Participation broadens beyond megacaps as risk appetite firms.",
    },
]


def _alpaca_headers() -> Optional[Dict[str, str]]:
    key = os.environ.get("ALPACA_API_KEY", "")
    secret = os.environ.get("ALPACA_API_SECRET", "")
    if not key or not secret:
        return None
    return {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}


def _http_get(url: str, headers: Optional[Dict[str, str]] = None) -> Any:
    req = urllib.request.Request(url)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return json.loads(resp.read().decode())


def _synthetic_price(symbol: str) -> tuple[float, float, float]:
    base = _BASE_PRICES.get(symbol, 100.0)
    t = time.time()
    phase = (hash(symbol) % 17) / 17.0
    wobble = 0.012 * ((t * 0.07 + phase) % 1.0 - 0.5)
    price = round(base * (1.0 + wobble), 2)
    change_pct = round(wobble * 100.0 * 3.5, 2)
    volume = int(1_200_000 + (hash(symbol) % 900_000) + abs(int(wobble * 5_000_000)))
    return price, change_pct, volume


def _alpaca_quote(symbol: str, headers: Dict[str, str]) -> Optional[tuple[float, float, float]]:
    try:
        url = f"https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest"
        data = _http_get(url, headers)
        q = data.get("quote", data)
        bid = float(q.get("bp") or q.get("bid_price") or 0)
        ask = float(q.get("ap") or q.get("ask_price") or 0)
        if bid > 0 and ask > 0:
            mid = (bid + ask) / 2.0
            base = _BASE_PRICES.get(symbol, mid)
            change_pct = round(((mid - base) / base) * 100.0, 2)
            return round(mid, 2), change_pct, int(800_000 + hash(symbol) % 500_000)
    except Exception:
        pass
    return None


def _resolve_stock_price(symbol: str, headers: Optional[Dict[str, str]]) -> tuple[float, float, float, bool]:
    """Return price, change_pct, volume, is_live."""
    if headers:
        live = _alpaca_quote(symbol, headers)
        if live:
            return live[0], live[1], live[2], True

    yahoo = fetch_yahoo_quote(symbol)
    if yahoo:
        mid = yahoo.mid
        prev = yahoo.previous_close or _BASE_PRICES.get(symbol, mid)
        change_pct = round(((mid - prev) / prev) * 100.0, 2) if prev else 0.0
        return round(mid, 2), change_pct, int(800_000 + hash(symbol) % 500_000), True

    price, change_pct, volume = _synthetic_price(symbol)
    return price, change_pct, volume, False


def list_trending_stocks() -> List[Dict[str, Any]]:
    headers = _alpaca_headers()
    rows: List[Dict[str, Any]] = []
    for symbol in US_SYMBOLS:
        price, change_pct, volume, is_live = _resolve_stock_price(symbol, headers)
        rows.append(
            {
                "symbol": symbol,
                "exchange": "Alpaca",
                "price": price,
                "change_pct": change_pct,
                "volume": volume,
                "live": is_live,
            }
        )
    rows.sort(key=lambda r: abs(r["change_pct"]), reverse=True)
    return rows


def list_market_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 50))
    headers = _alpaca_headers()
    if headers:
        try:
            params: Dict[str, str] = {"limit": str(limit), "sort": "desc"}
            if symbol:
                params["symbols"] = symbol.upper()
            url = "https://data.alpaca.markets/v1beta1/news?" + urllib.parse.urlencode(params)
            data = _http_get(url, headers)
            articles = data.get("news", data) if isinstance(data, dict) else data
            if isinstance(articles, list) and articles:
                out: List[Dict[str, Any]] = []
                for i, item in enumerate(articles[:limit]):
                    out.append(
                        {
                            "id": str(item.get("id", f"alpaca-{i}")),
                            "headline": item.get("headline", "Untitled"),
                            "source": item.get("source", "Alpaca"),
                            "created_at": item.get("created_at", ""),
                            "symbols": item.get("symbols", []),
                            "summary": item.get("summary", ""),
                        }
                    )
                return out
        except Exception:
            pass

    items = _DEMO_NEWS
    if symbol:
        sym = symbol.upper()
        items = [n for n in _DEMO_NEWS if sym in n.get("symbols", [])]
        if not items:
            items = [
                {
                    "id": f"demo-{sym}",
                    "headline": f"{sym} in focus as traders watch intraday flows",
                    "source": "Desk Intel",
                    "created_at": "2026-07-05T14:00:00Z",
                    "symbols": [sym],
                    "summary": f"No dedicated headline feed for {sym}; showing desk placeholder.",
                }
            ]
    return items[:limit]