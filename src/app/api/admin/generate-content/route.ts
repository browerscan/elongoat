import "server-only";

import { z } from "zod";

import { checkAdminAuth, unauthorized } from "../../../../lib/adminAuth";
import {
  generateClusterPageContent,
  generatePaaAnswer,
} from "../../../../lib/contentGen";

const BodySchema = z
  .object({
    kind: z.enum(["cluster_page", "paa_question"]),
    slugs: z.array(z.string().min(1)).min(1).max(100),
    ttlSeconds: z.number().int().positive().optional(),
  })
  .strict();

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });

  const { kind, slugs, ttlSeconds } = parsed.data;

  const results: Array<{
    slug: string;
    ok: boolean;
    model?: string;
    error?: string;
  }> = [];

  for (const slug of slugs) {
    try {
      if (kind === "cluster_page") {
        const [topicSlug, pageSlug] = slug.split("/");
        if (!topicSlug || !pageSlug)
          throw new Error("Expected slug format topic/page");
        const out = await generateClusterPageContent({
          topicSlug,
          pageSlug,
          ttlSeconds,
        });
        results.push({ slug, ok: true, model: out.model });
      } else {
        const out = await generatePaaAnswer({ slug, ttlSeconds });
        results.push({ slug, ok: true, model: out.model });
      }
    } catch (e) {
      results.push({
        slug,
        ok: false,
        error: e instanceof Error ? e.message : "unknown_error",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return Response.json(
    { ok: true, kind, generated: okCount, total: results.length, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
