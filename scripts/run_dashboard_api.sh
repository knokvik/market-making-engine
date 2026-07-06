#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate
export PYTHONPATH="$ROOT/src:$ROOT:${PYTHONPATH:-}"
exec uvicorn dashboard.api.main:app --reload --host 0.0.0.0 --port 8000