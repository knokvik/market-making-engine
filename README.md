# Market-Making Engine

Limit-order-book simulator for inventory-risk optimal quoting (Avellaneda-Stoikov). Built for backtesting and interview-ready explanation of market microstructure.

## Status

| Milestone | Status |
|---|---|
| Week 1: Order book / matching engine | Done |
| Week 2: Historical feed + baseline symmetric quotes | Done |
| Week 3: Avellaneda-Stoikov layer | Planned |
| Week 4: Transaction costs + realism | Planned |
| Week 5: Multi-regime stress tests | Planned |

## Architecture

```
Market Data Feed  -->  Order Book  -->  Quoting Strategy (A-S)
                              |
                              v
                    Inventory & Risk Manager  -->  Performance / Reporting
```

## Week 1: Order Book

`mm_engine.order_book.OrderBook` implements price-time priority matching:

- **Bids** sorted descending, **asks** ascending
- **FIFO** within each price level
- **O(1)** top-of-book reads and cancel-by-id
- Limit orders, market orders, partial fills, multi-level sweeps

## Setup

```bash
cd Programming/market-making-engine
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -v
```

## Week 2: Feed Replay + Baseline Quoter

- `feed/` — LOBSTER message parser and simple CSV replay format
- `strategy/symmetric.py` — fixed half-spread quoting around mid (comparison baseline)
- `inventory.py` — position, cash, realized and mark-to-market PnL
- `backtest/engine.py` — replays market events and posts/cancels strategy quotes
- `performance.py` — Sharpe, max drawdown, inventory stats
- `scripts/run_baseline_backtest.py` — CLI entry point

```bash
python scripts/run_baseline_backtest.py data/sample_session.csv --half-spread 0.02
```

## Project layout

```
src/mm_engine/
  types.py
  order_book.py
  inventory.py
  performance.py
  feed/
  strategy/
  backtest/
data/
  sample_session.csv
  sample_lobster.csv
scripts/
  run_baseline_backtest.py
tests/
```

## References

- Avellaneda & Stoikov (2008), *High-frequency trading in a limit order book*
- [hftbacktest](https://github.com/nkaz001/hftbacktest) — cross-validation target
- [LOBSTER](https://lobsterdata.com) — historical L2 data