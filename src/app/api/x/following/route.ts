import "server-only";

import { z } from "zod";

import { listXFollowing } from "../../../../lib/x";
import { getEnv } from "../../../../lib/env";

const env = getEnv();
const QuerySchema = z.object({
  handle: z.string().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    handle: url.searchParams.get("handle") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  const handle = (
    parsed.data.handle ??
    env.X_HANDLES?.split(",")[0] ??
    "elonmusk"
  )
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

  const following = await listXFollowing({
    handle,
    limit: parsed.data.limit ?? 2000,
  });

  return Response.json(
    { ok: true, handle, count: following.length, following },
    { headers: { "Cache-Control": "no-store" } },
  );
}
