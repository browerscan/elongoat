import "server-only";

import { z } from "zod";

import {
  checkAdminAuthEither,
  getAuditLogs,
  logAdminAction,
} from "@/lib/adminAuth";
import { unauthorized } from "@/lib/adminAuth";
import { getAdminSecurityHeaders } from "@/lib/securityHeaders";
import { rateLimitAdmin } from "@/lib/rateLimit";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * GET /api/admin/auth/audit
 * Get recent admin audit logs
 */
export async function GET(req: Request) {
  // Rate limit first
  const { result: rlResult, headers: rlHeaders } = await rateLimitAdmin(req);
  if (!rlResult.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rlHeaders["X-RateLimit-Limit"],
          "X-RateLimit-Remaining": rlHeaders["X-RateLimit-Remaining"],
          "X-RateLimit-Reset": rlHeaders["X-RateLimit-Reset"],
          ...(rlHeaders["Retry-After"]
            ? { "Retry-After": rlHeaders["Retry-After"] }
            : {}),
        },
      },
    );
  }

  // Check authentication
  const isAuth = await checkAdminAuthEither(req);
  if (!isAuth) {
    logAdminAction({
      request: req,
      action: "audit_logs_access",
      success: false,
      reason: "unauthorized",
    });
    return unauthorized("Unauthorized");
  }

  // Parse query params
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
  });

  const limit = parsed.success ? (parsed.data.limit ?? 100) : 100;

  const logs = getAuditLogs(limit);

  logAdminAction({
    request: req,
    action: "audit_logs_access",
    success: true,
  });

  return Response.json(
    {
      logs,
      count: logs.length,
      limit,
    },
    {
      headers: {
        ...getAdminSecurityHeaders(),
        "X-RateLimit-Limit": rlHeaders["X-RateLimit-Limit"],
        "X-RateLimit-Remaining": rlHeaders["X-RateLimit-Remaining"],
        "X-RateLimit-Reset": rlHeaders["X-RateLimit-Reset"],
        "Cache-Control": "no-store",
      },
    },
  );
}
