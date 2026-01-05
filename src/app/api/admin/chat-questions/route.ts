import "server-only";

import { z } from "zod";

import { checkAdminAuth, unauthorized } from "../../../../lib/adminAuth";
import { listTopChatQuestions } from "../../../../lib/chatAnalytics";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  minCount: z.coerce.number().int().min(1).max(1000000).optional(),
});

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) return unauthorized();

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    minCount: url.searchParams.get("minCount") ?? undefined,
  });
  if (!parsed.success)
    return Response.json({ error: "invalid_query" }, { status: 400 });

  const rows = await listTopChatQuestions({
    limit: parsed.data.limit ?? 100,
    minCount: parsed.data.minCount ?? 2,
  });

  return Response.json(
    { ok: true, count: rows.length, questions: rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}
