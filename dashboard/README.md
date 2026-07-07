# Market Making Engine — Trading Dashboard

Premium real-time operations dashboard for the quantitative market-making simulator.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion, ECharts, React Flow |
| Backend | FastAPI, WebSocket streaming, Python replay controller |
| Engine | Existing `mm_engine` order book + A-S quoting + toxicity monitor |

## Quick Start

### 1. API server (from project root)

```bash
cd Programming/market-making-engine
source .venv/bin/activate
pip install -e ".[dashboard]"
pip install -r dashboard/api/requirements.txt
PYTHONPATH=src uvicorn dashboard.api.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd dashboard/web
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Command-center dark UI** — matte black (#0B0D10), neon profit/loss/info accents, glass panels
- **Live replay streaming** — WebSocket frame updates with play/pause/step/seek (1x–100x)
- **Microstructure chart** — mid, reservation, quotes, depth heatmap, fills, volatility bands
- **Risk command center** — inventory gauge, γ/σ/k/τ, kill switch, circuit breaker
- **Performance & execution analytics** — PnL decomposition, Sharpe/Sortino, queue position, fill probability
- **Architecture view** — React Flow pipeline diagram
- **Overlay toggles** — 15 analytical layers (depth, toxicity, regime, etc.)
- **Drag & resize panels** — rearrange via panel headers, resize corners, layout persists in localStorage

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/datasets` | Available replay datasets |
| POST | `/api/session` | Configure strategy + dataset |
| POST | `/api/control` | play, pause, step, seek, reset |
| GET | `/api/frame` | Current telemetry frame |
| WS | `/ws/replay` | Streaming frame updates |