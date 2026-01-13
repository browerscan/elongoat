import "server-only";

import { z } from "zod";

import { checkAdminAuthEither } from "../../../../lib/adminAuth";
import { listTopChatQuestions } from "../../../../lib/chatAnalytics";
import { getAdminSecurityHeaders } from "../../../../lib/securityHeaders";
import { rateLimitAdmin } from "../../../../lib/rateLimit";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  minCount: z.coerce.number().int().min(1).max(1000000).optional(),
});

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

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    minCount: url.searchParams.get("minCount") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_query" },
      {
        status: 400,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const rows = await listTopChatQuestions({
    limit: parsed.data.limit ?? 100,
    minCount: parsed.data.minCount ?? 2,
  });

  return Response.json(
    { ok: true, count: rows.length, questions: rows },
    {
      headers: {
        ...getAdminSecurityHeaders(),
        ...(rlHeaders as unknown as HeadersInit),
      },
    },
  );
}
