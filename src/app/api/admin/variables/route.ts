import "server-only";

import { checkAdminAuthEither } from "../../../../lib/adminAuth";
import {
  AdminVariablesUpdateSchema,
  getAdminVariablesSnapshot,
  updateAdminVariables,
} from "../../../../lib/adminVariables";
import { getAdminSecurityHeaders } from "../../../../lib/securityHeaders";
import { rateLimitAdmin } from "../../../../lib/rateLimit";

export async function GET(req: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitAdmin(req);
  if (!rlResult.ok) {
    return Response.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const isAuth = await checkAdminAuthEither(req);
  if (!isAuth) {
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const snapshot = await getAdminVariablesSnapshot();
  return Response.json(snapshot, {
    headers: {
      ...getAdminSecurityHeaders(),
      ...(rlHeaders as unknown as HeadersInit),
    },
  });
}

const BodySchema = AdminVariablesUpdateSchema;

function normalizeAdminVariablesInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  const input = body as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...input };

  const chat = input.chat;
  if (chat && typeof chat === "object" && !Array.isArray(chat)) {
    const chatObj = chat as Record<string, unknown>;
    if (chatObj.mood != null) normalized.chat_mood = chatObj.mood;
    if (chatObj.typingQuirk != null)
      normalized.chat_typing_quirk = chatObj.typingQuirk;
    if (chatObj.analyticsEnabled != null)
      normalized.chat_analytics_enabled = chatObj.analyticsEnabled;
  }

  delete normalized.chat;

  return normalized;
}

export async function POST(req: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitAdmin(req);
  if (!rlResult.ok) {
    return Response.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const isAuth = await checkAdminAuthEither(req);
  if (!isAuth) {
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const body = await req.json().catch(() => ({}));
  const normalized = normalizeAdminVariablesInput(body);
  const parsed = BodySchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).slice(0, 3);
    return Response.json(
      { error: "invalid_request", issues },
      {
        status: 400,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  try {
    const result = await updateAdminVariables(parsed.data);
    return Response.json(result, {
      headers: {
        ...getAdminSecurityHeaders(),
        ...(rlHeaders as unknown as HeadersInit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return Response.json(
      { error: "update_failed", message },
      {
        status: 500,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }
}
