#!/usr/bin/env bash
# Always-on VPS deploy (Hetzner / DigitalOcean / Oracle free VM) — no cold starts.
# Usage on a fresh Ubuntu 22.04+ server:
#   curl -fsSL https://get.docker.com | sudo sh
#   git clone https://github.com/knokvik/market-making-engine.git
#   cd market-making-engine && bash scripts/deploy_vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NAME="${MM_CONTAINER_NAME:-mm-engine-dashboard}"
PORT="${MM_PORT:-8000}"

echo "Building image..."
docker build -t "$NAME" .

echo "Stopping old container (if any)..."
docker rm -f "$NAME" 2>/dev/null || true

echo "Starting $NAME on port $PORT..."
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p "${PORT}:8000" \
  -e PYTHONPATH=/app/src:/app \
  -e PORT=8000 \
  "$NAME"

echo ""
echo "Dashboard live at: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):${PORT}"
echo "Health: curl http://127.0.0.1:${PORT}/api/health"