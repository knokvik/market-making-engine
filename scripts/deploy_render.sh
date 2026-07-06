#!/usr/bin/env bash
# One-click deploy helper for Render (after connecting the GitHub repo in the dashboard).
set -euo pipefail

echo "Dashboard pushed to GitHub — deploy on Render:"
echo ""
echo "  1. Open https://dashboard.render.com/select-repo?type=blueprint"
echo "  2. Connect GitHub repo: knokvik/market-making-engine"
echo "  3. Render detects render.yaml and creates mm-engine-dashboard"
echo "  4. Root Directory MUST be empty (NOT bash scripts/run_dashboard_api.sh)"
echo "  5. Click Apply — build takes ~5–8 min (npm build + Docker)"
echo ""
echo "  Full guide: docs/RENDER_DEPLOY.md"
echo ""
echo "Live URL will be: https://mm-engine-dashboard.onrender.com (or similar)"
echo ""
echo "Optional: test production image locally:"
echo "  docker build -t mm-engine-dashboard ."
echo "  docker run --rm -p 8000:8000 mm-engine-dashboard"
echo "  open http://localhost:8000"