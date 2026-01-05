#!/bin/sh
set -e

# Start cache warmup in background after delay
if [ "${SKIP_WARMUP:-0}" != "1" ]; then
  (
    sleep "${WARMUP_DELAY_MS:-10}"
    echo "[entrypoint] Starting cache warmup..."
    # Hit health endpoint to warm up connections
    curl -fsS --max-time 5 http://localhost:3000/api/health >/dev/null 2>&1 || true
    curl -fsS --max-time 5 http://localhost:3000/api/data/cluster >/dev/null 2>&1 || true
    curl -fsS --max-time 5 http://localhost:3000/api/variables >/dev/null 2>&1 || true
    echo "[entrypoint] Cache warmup complete"
  ) &
fi

# Start the Node.js server
exec node server.js
