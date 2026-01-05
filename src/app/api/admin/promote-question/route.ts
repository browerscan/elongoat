import "server-only";

import { z } from "zod";

import { checkAdminAuth, unauthorized } from "../../../../lib/adminAuth";
import {
  getChatQuestionByHash,
  markQuestionPromoted,
} from "../../../../lib/chatAnalytics";
import {
  generateCustomQa,
  getCustomQa,
  upsertCustomQa,
} from "../../../../lib/customQa";
import { findPaaQuestion } from "../../../../lib/indexes";
import { slugify } from "../../../../lib/slugify";

const BodySchema = z
  .object({
    questionHash: z.string().min(32).max(128).optional(),
    question: z.string().min(6).max(240).optional(),
    slug: z.string().min(1).max(255).optional(),
    answerMd: z.string().min(20).max(50_000).optional(),
    overwrite: z.boolean().optional(),
  })
  .strict();

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });

  const fromBody = (parsed.data.question ?? "").trim();
  const fromHash = parsed.data.questionHash
    ? ((await getChatQuestionByHash(parsed.data.questionHash))?.question ?? "")
    : "";
  const question = (fromBody || fromHash).trim();

  if (!question) {
    return Response.json({ error: "missing_question" }, { status: 400 });
  }

  const slug = slugify(parsed.data.slug ?? question);

  // Prevent collisions with existing PAA pages (those should remain canonical).
  const existingPaa = await findPaaQuestion(slug);
  if (existingPaa) {
    return Response.json(
      { error: "slug_conflict_paa", slug, existing: `/q/${existingPaa.slug}` },
      { status: 409 },
    );
  }

  const existingCustom = await getCustomQa(slug);
  if (existingCustom && !parsed.data.overwrite) {
    return Response.json({ error: "slug_exists", slug }, { status: 409 });
  }

  if (parsed.data.answerMd) {
    await upsertCustomQa({
      slug,
      question,
      answerMd: parsed.data.answerMd,
      model: "manual",
      sources: { kind: "manual", updatedAt: new Date().toISOString() },
    });
  } else {
    await generateCustomQa({ question, slug });
  }

  if (parsed.data.questionHash) {
    await markQuestionPromoted({
      questionHash: parsed.data.questionHash,
      promotedSlug: slug,
    });
  }

  return Response.json(
    { ok: true, slug, url: `/q/${slug}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
