import "server-only";

import {
  clearAdminSession,
  logAdminAction,
} from "../../../../../lib/adminAuth";
import { getAdminSecurityHeaders } from "../../../../../lib/securityHeaders";
import { rateLimitAdmin } from "../../../../../lib/rateLimit";

/**
 * POST /api/admin/auth/logout
 * Clear admin session cookies
 */
export async function POST(req: Request) {
  // Rate limit first
  const { result: rlResult, headers: rlHeaders } = await rateLimitAdmin(req);
  if (!rlResult.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  logAdminAction({
    request: req,
    action: "admin_logout",
    success: true,
  });

  // Clear session cookies
  const clearCookieHeader = clearAdminSession();

  return Response.json(
    { success: true, message: "Logged out" },
    {
      status: 200,
      headers: {
        ...getAdminSecurityHeaders(),
        ...(rlHeaders as unknown as HeadersInit),
        "Set-Cookie": clearCookieHeader,
      },
    },
  );
}
