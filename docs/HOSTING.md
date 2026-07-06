# Hosting options (avoid Render cold starts)

Render **free** tier spins down after ~15 min idle → first visit can take **1–3 minutes** to wake.

This app needs a **always-on process** (WebSocket + in-memory replay state). Best options:

## Quick comparison

| Platform | Cold start | ~Monthly cost | Setup |
|----------|-------------|---------------|--------|
| **Hetzner VPS** | None | ~€4 | `scripts/deploy_vps.sh` |
| **Railway** | Seconds | ~$5 Hobby | Connect GitHub + Dockerfile |
| **Fly.io** | None if `min_machines_running = 1` | ~$5–7 | `fly deploy` + `fly.toml` |
| **Render paid** | None | $7+ Starter | Existing `render.yaml` |
| **Render free** | 1–3 min | $0 | Slow wake-up |
| **Vercel only** | N/A | $0 | UI only — API must live elsewhere |

## Recommended: Railway (easiest upgrade from Render)

1. https://railway.com/new → **Deploy from GitHub**
2. Select `knokvik/market-making-engine`
3. Railway detects `Dockerfile` automatically (`railway.toml` included)
4. Add **Hobby plan** ($5/mo) so the service stays running
5. Generate domain → open `https://your-app.up.railway.app`

Update Vercel `vercel.json` rewrite + `VITE_WS_URL` to the Railway URL.

## Recommended: Hetzner VPS (cheapest always-on)

1. Create **CX22** (~€3.79/mo) at https://www.hetzner.com/cloud
2. SSH in, install Docker, clone repo, run:

```bash
git clone https://github.com/knokvik/market-making-engine.git
cd market-making-engine
bash scripts/deploy_vps.sh
```

3. Point a domain (optional) or use the server IP on port 8000
4. Add Caddy/nginx + TLS for HTTPS (recommended for production)

## Fly.io

```bash
fly auth login
fly launch --no-deploy   # uses fly.toml
fly deploy
fly certs add your-domain.com   # optional
```

`fly.toml` sets `auto_stop_machines = 'off'` and `min_machines_running = 1` to avoid sleep.

## Vercel + backend split

- **Vercel**: React UI (`vercel.json` in repo)
- **Railway / Fly / VPS**: API + WebSocket

Set in Vercel env:
- `VITE_WS_URL=wss://YOUR-BACKEND-URL/ws/replay`

Update `vercel.json` rewrite `destination` to the same backend host.

## Why not serverless (Lambda, Vercel Functions)?

Replay and paper trading keep state in memory and stream over WebSocket. Serverless instances are stateless and short-lived — would require a full Redis/pub-sub rewrite.