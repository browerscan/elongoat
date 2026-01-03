#!/bin/sh
set -e

# Start cache warmup in background after delay
if [ "${SKIP_WARMUP:-0}" != "1" ]; then
  (
    sleep "${WARMUP_DELAY_MS:-10}"
    echo "[entrypoint] Starting cache warmup..."
    # Hit health endpoint to warm up connections
    wget --quiet --spider --timeout=5 http://localhost:3000/api/health 2>/dev/null || true
    wget --quiet --spider --timeout=5 http://localhost:3000/api/data/cluster 2>/dev/null || true
    wget --quiet --spider --timeout=5 http://localhost:3000/api/variables 2>/dev/null || true
    echo "[entrypoint] Cache warmup complete"
  ) &
fi

# Start the Node.js server
exec node server.js
