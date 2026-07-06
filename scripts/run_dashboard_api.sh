#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate
export PYTHONPATH="$ROOT/src:$ROOT:${PYTHONPATH:-}"

PORT="${DASHBOARD_API_PORT:-8000}"

# Kill stale processes bound to the dashboard API port
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Stopping existing process(es) on port $PORT: $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 0.5
  fi
fi

echo "Starting dashboard API on http://0.0.0.0:$PORT (v2)"
exec uvicorn dashboard.api.main:app --reload --host 0.0.0.0 --port "$PORT"