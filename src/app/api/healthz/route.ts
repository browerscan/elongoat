/**
 * Simple Liveness Probe
 *
 * A lightweight health check for container orchestration.
 * Returns 200 if the Node.js process is running.
 *
 * This endpoint is designed for:
 * - Docker HEALTHCHECK directives
 * - Kubernetes liveness probes
 * - Load balancer health checks
 *
 * Unlike /api/health (which checks external services), this endpoint
 * only verifies that the server process is alive.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
