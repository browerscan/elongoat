import "server-only";

import { getDbPool } from "@/lib/db";
import { getDynamicVariables } from "@/lib/variables";
import { slugify } from "@/lib/slugify";
import { vectorEngineChatComplete } from "@/lib/vectorengine";

const DEFAULT_CONTENT_MODEL = "claude-sonnet-4-5-20250929";

function getContentModel(): string | null {
  if (!process.env.VECTORENGINE_API_KEY) return null;
  return process.env.VECTORENGINE_CONTENT_MODEL ?? DEFAULT_CONTENT_MODEL;
}

export type CustomQaRow = {
  slug: string;
  question: string;
  answerMd: string;
  model: string | null;
  sources: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function getCustomQa(slug: string): Promise<CustomQaRow | null> {
  const db = getDbPool();
  if (!db) return null;

  try {
    const res = await db.query<{
      slug: string;
      question: string;
      answer_md: string;
      model: string | null;
      sources: unknown;
      created_at: string;
      updated_at: string;
    }>(
      `
      select slug, question, answer_md, model, sources, created_at, updated_at
      from elongoat.custom_qas
      where slug = $1
      limit 1
      `,
      [slug],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      slug: r.slug,
      question: r.question,
      answerMd: r.answer_md,
      model: r.model,
      sources: r.sources,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listCustomQaSlugs(
  limit: number = 5000,
): Promise<string[]> {
  const db = getDbPool();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(5000, limit));

  try {
    const res = await db.query<{ slug: string }>(
      `
      select slug
      from elongoat.custom_qas
      order by created_at desc
      limit $1
      `,
      [safeLimit],
    );
    return res.rows.map((r) => r.slug);
  } catch {
    return [];
  }
}

export async function listLatestCustomQas(
  limit: number = 12,
): Promise<
  Array<
    Pick<CustomQaRow, "slug" | "question" | "model" | "createdAt" | "updatedAt">
  >
> {
  const db = getDbPool();
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(50, limit));

  try {
    const res = await db.query<{
      slug: string;
      question: string;
      model: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      select slug, question, model, created_at, updated_at
      from elongoat.custom_qas
      order by created_at desc
      limit $1
      `,
      [safeLimit],
    );

    return res.rows.map((r) => ({
      slug: r.slug,
      question: r.question,
      model: r.model,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function upsertCustomQa(params: {
  slug: string;
  question: string;
  answerMd: string;
  model: string | null;
  sources?: unknown;
}): Promise<void> {
  const db = getDbPool();
  if (!db) throw new Error("DATABASE_URL not configured");

  await db.query(
    `
    insert into elongoat.custom_qas (slug, question, answer_md, model, sources, created_at)
    values ($1, $2, $3, $4, $5, now())
    on conflict (slug) do update set
      question = excluded.question,
      answer_md = excluded.answer_md,
      model = excluded.model,
      sources = excluded.sources,
      updated_at = now();
    `,
    [
      params.slug,
      params.question,
      params.answerMd,
      params.model,
      params.sources ? JSON.stringify(params.sources) : null,
    ],
  );
}

export async function generateCustomQa(params: {
  question: string;
  slug?: string;
}): Promise<{ slug: string; answerMd: string; model: string }> {
  const model = getContentModel();
  if (!model) throw new Error("VectorEngine content model not configured");

  const vars = await getDynamicVariables();
  const slug = params.slug ? slugify(params.slug) : slugify(params.question);

  const system = [
    `You are "ElonSim": an AI simulation inspired by Elon Musk's public communication style.`,
    `You are NOT the real Elon Musk. Never claim private access, DMs, or insider info.`,
    `Safety: avoid defamation; avoid unverified accusations; be explicit about uncertainty.`,
    `Output Markdown only.`,
  ].join("\n");

  const user = [
    `QUESTION: ${params.question}`,
    ``,
    `KNOWN VARIABLES (may be outdated): age=${vars.age}, children_count=${vars.children_count}, net_worth="${vars.net_worth}", dob=${vars.dob}`,
    ``,
    `Write a page with this structure:`,
    `1) ## ElonSim answer (tweet-like, concise, mostly lowercase, occasional shorthand like rn/prob/tbh — but readable)`,
    `2) ## Reality check / what to verify (bullets)`,
    `3) ## Suggested sources to check (bullets; reputable outlets / primary sources)`,
    ``,
    `Important: do not pretend you are the real Elon. If unsure, say what you'd verify.`,
  ].join("\n");

  const completion = await vectorEngineChatComplete({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    maxTokens: 950,
  });

  const answerMd =
    completion.text.trim() || `## ElonSim answer\n\n(Empty response)\n`;

  await upsertCustomQa({
    slug,
    question: params.question,
    answerMd,
    model,
    sources: { kind: "custom_qa", generatedAt: new Date().toISOString() },
  });

  return { slug, answerMd, model };
}
