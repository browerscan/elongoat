import "server-only";

import { z } from "zod";

import { checkAdminAuthEither } from "../../../../lib/adminAuth";
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
import { getAdminSecurityHeaders } from "../../../../lib/securityHeaders";
import { rateLimitAdmin } from "../../../../lib/rateLimit";

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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request" },
      {
        status: 400,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const fromBody = (parsed.data.question ?? "").trim();
  const fromHash = parsed.data.questionHash
    ? ((await getChatQuestionByHash(parsed.data.questionHash))?.question ?? "")
    : "";
  const question = (fromBody || fromHash).trim();

  if (!question) {
    return Response.json(
      { error: "missing_question" },
      {
        status: 400,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const slug = slugify(parsed.data.slug ?? question);

  // Prevent collisions with existing PAA pages (those should remain canonical).
  const existingPaa = await findPaaQuestion(slug);
  if (existingPaa) {
    return Response.json(
      { error: "slug_conflict_paa", slug, existing: `/q/${existingPaa.slug}` },
      {
        status: 409,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
  }

  const existingCustom = await getCustomQa(slug);
  if (existingCustom && !parsed.data.overwrite) {
    return Response.json(
      { error: "slug_exists", slug },
      {
        status: 409,
        headers: {
          ...getAdminSecurityHeaders(),
          ...(rlHeaders as unknown as HeadersInit),
        },
      },
    );
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
    {
      headers: {
        ...getAdminSecurityHeaders(),
        ...(rlHeaders as unknown as HeadersInit),
      },
    },
  );
}
