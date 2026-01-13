#!/bin/sh
set -e

# Start cache warmup in background after delay
if [ "${SKIP_WARMUP:-0}" != "1" ]; then
  (
    sleep "${WARMUP_DELAY_MS:-10}"
    echo "[entrypoint] Starting cache warmup..."
    node -e "const urls=['http://localhost:3000/api/health','http://localhost:3000/api/data/cluster','http://localhost:3000/api/variables'];(async()=>{for(const u of urls){try{const r=await fetch(u,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(r.statusText);}catch(e){}}console.log('[entrypoint] Cache warmup complete');})();"
  ) &
fi

# Start the Node.js server
exec node server.js
