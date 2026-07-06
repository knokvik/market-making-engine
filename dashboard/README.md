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

## Deploy online (Render)

The repo includes a `Dockerfile` and `render.yaml` for one-service hosting (API + WebSocket + built UI).

1. Push is on `main` at https://github.com/knokvik/market-making-engine
2. Open https://dashboard.render.com/select-repo?type=blueprint
3. Connect the repo — Render applies `render.yaml` automatically
4. Wait for the Docker build (~5–8 min)
5. Open the generated URL (e.g. `https://mm-engine-dashboard.onrender.com`)

**Local production test:**

```bash
docker build -t mm-engine-dashboard .
docker run --rm -p 8000:8000 mm-engine-dashboard
# open http://localhost:8000
```

Or run `bash scripts/deploy_render.sh` for the checklist.

## Deploy frontend on Vercel

The Python API + WebSocket **cannot** run on Vercel serverless (stateful replay + WS).
Use **Vercel for the UI** and **Render for the API** (see above).

1. Deploy API first on Render → note the URL (e.g. `https://mm-engine-dashboard.onrender.com`)
2. In `vercel.json`, set the rewrite `destination` to your Render API URL
3. [vercel.com/new](https://vercel.com/new) → Import `knokvik/market-making-engine`
4. **Root Directory:** `dashboard/web` (or use repo-root `vercel.json`)
5. **Environment Variables:**
   - `VITE_WS_URL` = `wss://YOUR-RENDER-URL.onrender.com/ws/replay`
6. Deploy

| File | Purpose |
|---|---|
| `vercel.json` (repo root) | Monorepo deploy from GitHub root |
| `dashboard/web/vercel.json` | Deploy with Root Directory = `dashboard/web` |
| `dashboard/web/.env.example` | Required env vars |