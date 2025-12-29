import "server-only";

import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

import {
  createAdminSession,
  logAdminAction,
  validateAdminSession,
  validateSecurityConfig,
} from "@/lib/adminAuth";
import { getAdminSecurityHeaders } from "@/lib/securityHeaders";
import { rateLimitAdmin } from "@/lib/rateLimit";

const LoginSchema = z.object({
  token: z.string().min(16, "Token too short").max(512),
});

/**
 * POST /api/admin/auth/login
 * Authenticate with admin token and create secure session
 */
export async function POST(req: Request) {
  // Rate limit first
  const { result: rlResult, headers: rlHeaders } = await rateLimitAdmin(req);
  if (!rlResult.ok) {
    return Response.json(
      {
        error: "Rate limit exceeded",
        resetAt: new Date(
          Date.now() + rlResult.resetSeconds * 1000,
        ).toISOString(),
      },
      {
        status: 429,
        headers: rlHeaders as unknown as HeadersInit,
      },
    );
  }

  // Validate security config
  const securityCheck = validateSecurityConfig();
  if (!securityCheck.valid) {
    console.error(
      "[AdminAuth] Security configuration errors:",
      securityCheck.errors,
    );
    // In production, fail securely
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500, headers: getAdminSecurityHeaders() },
      );
    }
  }

  // Parse request body
  const body = await req.json().catch(() => ({}));
  const parsed = LoginSchema.safeParse(body);

  if (!parsed.success) {
    logAdminAction({
      request: req,
      action: "admin_login",
      success: false,
      reason: "invalid_request",
    });
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400, headers: getAdminSecurityHeaders() },
    );
  }

  const { token } = parsed.data;
  const adminToken = process.env.ELONGOAT_ADMIN_TOKEN;

  if (!adminToken) {
    logAdminAction({
      request: req,
      action: "admin_login",
      success: false,
      reason: "not_configured",
    });
    return Response.json(
      { error: "Authentication not configured" },
      { status: 500, headers: getAdminSecurityHeaders() },
    );
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const provided = Buffer.from(token, "utf8");
    const expected = Buffer.from(adminToken, "utf8");

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      logAdminAction({
        request: req,
        action: "admin_login",
        success: false,
        reason: "invalid_token",
      });
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401, headers: getAdminSecurityHeaders() },
      );
    }
  } catch {
    logAdminAction({
      request: req,
      action: "admin_login",
      success: false,
      reason: "comparison_error",
    });
    return Response.json(
      { error: "Authentication error" },
      { status: 500, headers: getAdminSecurityHeaders() },
    );
  }

  // Create session
  const sessionResult = await createAdminSession();

  if (!sessionResult.success) {
    logAdminAction({
      request: req,
      action: "admin_login",
      success: false,
      reason: sessionResult.error,
    });
    return Response.json(
      { error: sessionResult.error ?? "Failed to create session" },
      { status: 500, headers: getAdminSecurityHeaders() },
    );
  }

  logAdminAction({
    request: req,
    action: "admin_login",
    success: true,
  });

  // Return success with session cookies
  return Response.json(
    {
      success: true,
      message: "Authentication successful",
      csrfToken: sessionResult.cookieHeader?.match(
        /elongoat_admin_csrf=([^;]+)/,
      )?.[1],
    },
    {
      status: 200,
      headers: {
        ...getAdminSecurityHeaders(),
        ...(rlHeaders as unknown as HeadersInit),
        "Set-Cookie": sessionResult.cookieHeader ?? "",
      },
    },
  );
}

/**
 * GET /api/admin/auth/login
 * Check if already authenticated
 */
export async function GET(req: Request) {
  const result = await validateAdminSession(req);

  return Response.json(
    {
      authenticated: result.valid,
      reason: result.reason,
    },
    {
      status: result.valid ? 200 : 401,
      headers: getAdminSecurityHeaders(),
    },
  );
}
