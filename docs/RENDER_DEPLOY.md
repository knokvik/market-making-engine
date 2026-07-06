# Deploy on Render

Your build failed because **Root Directory** was set to `bash scripts/run_dashboard_api.sh`.
That field must be **empty** — the start command lives inside the `Dockerfile`, not in Render settings.

## Option A — Blueprint (recommended)

1. Delete the broken service in Render (or fix settings below).
2. Open https://dashboard.render.com/select-repo?type=blueprint
3. Connect GitHub → **`knokvik/market-making-engine`**
4. Render reads `render.yaml` → creates **mm-engine-dashboard**
5. Click **Apply** → wait 5–10 min for Docker build
6. Open the URL, e.g. `https://mm-engine-dashboard.onrender.com`
7. Test: `https://YOUR-URL.onrender.com/api/health`

## Option B — Manual Web Service (Docker)

1. https://dashboard.render.com/new → **Web Service**
2. Connect repo **`knokvik/market-making-engine`**
3. Settings:

| Field | Value |
|-------|--------|
| **Name** | `mm-engine-dashboard` |
| **Region** | Oregon (or nearest) |
| **Branch** | `main` |
| **Root Directory** | *(leave completely empty)* |
| **Runtime** | **Docker** |
| **Dockerfile Path** | `./Dockerfile` |
| **Build Command** | *(leave empty)* |
| **Start Command** | *(leave empty)* |
| **Plan** | Free (or Starter for no sleep) |

4. **Environment Variables** (Render sets `PORT` automatically):

| Key | Value |
|-----|--------|
| `PYTHONPATH` | `/app/src:/app` |

5. **Health Check Path**: `/api/health`
6. Click **Create Web Service**

## After deploy

- Full app (UI + API + WebSocket): `https://YOUR-URL.onrender.com`
- Health: `https://YOUR-URL.onrender.com/api/health`
- WebSocket: `wss://YOUR-URL.onrender.com/ws/replay`

If using **Vercel** for frontend, set:
- `VITE_WS_URL` = `wss://YOUR-URL.onrender.com/ws/replay`
- `vercel.json` rewrite → `https://YOUR-URL.onrender.com/api/:path*`

## Free tier note

Render free spins down after ~15 min idle. First visit after sleep can take 1–3 minutes.
Upgrade to **Starter ($7/mo)** or use Railway/Hetzner for always-on.

## Troubleshooting

| Error | Fix |
|-------|-----|
| Root directory `bash scripts/...` does not exist | Clear **Root Directory** field entirely |
| Build fails on npm | Ensure Dockerfile path is `./Dockerfile` at repo root |
| App crashes on start | Check logs; `PORT` is injected by Render automatically |
| WebSocket won't connect | Use `wss://` on HTTPS, same host as the Render URL |