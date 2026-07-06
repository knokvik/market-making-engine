# Market-Making Engine

Limit-order-book simulator for inventory-risk optimal quoting (Avellaneda-Stoikov). Built for backtesting and interview-ready explanation of market microstructure.

## Status

| Milestone | Status |
|---|---|
| Week 1: Order book / matching engine | Done |
| Week 2: Historical feed + baseline symmetric quotes | Done |
| Week 3: Avellaneda-Stoikov layer | Done |
| Week 4: Transaction costs + realism | Done |
| Week 5: Multi-regime stress tests | Done |

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

## Week 3: Avellaneda-Stoikov Quoting

- `strategy/avellaneda_stoikov.py` — reservation price skew + optimal half-spread from `k`
- `strategy/volatility.py` — rolling mid-price volatility estimator
- `scripts/compare_strategies.py` — side-by-side baseline vs A-S metrics

```bash
python scripts/compare_strategies.py data/sample_session.csv --half-spread 0.02 --gamma 0.1
```

Interview anchors:
- **Reservation price** shifts below mid when long (encourages selling)
- **Asymmetric offsets** widen bid and tighten ask when long (δ_b ↑, δ_a ↓)
- **Sigma** must be in price units (`σ_log × mid`) for meaningful skew in the formulas
- **Arrival intensity `k`** controls the trade-off between fill rate and edge per fill

## Week 4: Transaction Costs + Latency

- `simulation/costs.py` — maker/taker fee model in basis points
- `simulation/latency.py` — quote updates activate after configurable delay
- FIFO queue position is enforced by the order book (no instant back-of-queue fills)
- `scripts/benchmark.py` — quick progress sanity checks before shipping changes

```bash
python scripts/audit_checklist.py   # verify skew, fees, mark-to-market
python scripts/benchmark.py
pytest -v
```

## Week 5: Multi-Regime Stress Tests

- `stress/regimes.py` — synthetic calm / normal / volatile feed generators
- `stress/runner.py` — runs symmetric vs A-S across regimes with costs
- `scripts/run_stress_test.py` — prints comparison table

```bash
python scripts/run_stress_test.py
python scripts/benchmark.py
```

## References

- Avellaneda & Stoikov (2008), *High-frequency trading in a limit order book*
- [hftbacktest](https://github.com/nkaz001/hftbacktest) — cross-validation target
- [LOBSTER](https://lobsterdata.com) — historical L2 data