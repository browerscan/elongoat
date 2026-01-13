import "server-only";

import { createHash } from "node:crypto";

import { getDbPool } from "./db";
import { getEnv } from "./env";

const env = getEnv();

export function analyticsEnabled(): boolean {
  return env.CHAT_ANALYTICS_ENABLED;
}

export function normalizeQuestion(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
}

export function formatDisplayQuestion(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim()
    .slice(0, 240);
}

export function shouldStoreQuestion(input: string): boolean {
  const q = normalizeQuestion(formatDisplayQuestion(input));
  if (q.length < 6) return false;
  if (q.length > 200) return false;
  if (q.includes("http://") || q.includes("https://")) return false;
  if (/\S+@\S+\.\S+/.test(q)) return false;
  if (/\b\d{10,}\b/.test(q)) return false;
  // Avoid obvious prompt-injection-ish payloads being stored as "SEO seeds".
  if (/(ignore|forget).{0,40}(instructions|system|developer)/i.test(q))
    return false;
  return true;
}

export function hashQuestion(normalizedQuestion: string): string {
  return createHash("sha256").update(normalizedQuestion, "utf8").digest("hex");
}

export type ChatQuestionStat = {
  questionHash: string;
  question: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  samplePage: string | null;
  promotedSlug: string | null;
  promotedAt: string | null;
};

export async function recordChatQuestionStat(params: {
  message: string;
  currentPage?: string;
  analyticsEnabled?: boolean;
}): Promise<void> {
  const enabled =
    typeof params.analyticsEnabled === "boolean"
      ? params.analyticsEnabled
      : analyticsEnabled();
  if (!enabled) return;
  if (!shouldStoreQuestion(params.message)) return;

  const db = getDbPool();
  if (!db) return;

  try {
    const display = formatDisplayQuestion(params.message);
    const questionHash = hashQuestion(normalizeQuestion(display));
    const samplePage = params.currentPage?.slice(0, 255) ?? null;

    await db.query(
      `
      insert into elongoat.chat_question_stats (question_hash, question, count, first_seen_at, last_seen_at, sample_page)
      values ($1, $2, 1, now(), now(), $3)
      on conflict (question_hash) do update set
        count = elongoat.chat_question_stats.count + 1,
        last_seen_at = now(),
        sample_page = excluded.sample_page;
      `,
      [questionHash, display, samplePage],
    );
  } catch {
    // never take down chat for analytics
  }
}

export async function listTopChatQuestions(params: {
  limit: number;
  minCount?: number;
}): Promise<ChatQuestionStat[]> {
  const db = getDbPool();
  if (!db) return [];

  const limit = Math.max(1, Math.min(500, params.limit));
  const minCount = Math.max(1, params.minCount ?? 1);

  try {
    const res = await db.query<{
      question_hash: string;
      question: string;
      count: number;
      first_seen_at: string;
      last_seen_at: string;
      sample_page: string | null;
      promoted_slug: string | null;
      promoted_at: string | null;
    }>(
      `
      select question_hash, question, count, first_seen_at, last_seen_at, sample_page, promoted_slug, promoted_at
      from elongoat.chat_question_stats
      where count >= $1
      order by count desc, last_seen_at desc
      limit $2
      `,
      [minCount, limit],
    );

    return res.rows.map((r) => ({
      questionHash: r.question_hash,
      question: r.question,
      count: r.count,
      firstSeenAt: new Date(r.first_seen_at).toISOString(),
      lastSeenAt: new Date(r.last_seen_at).toISOString(),
      samplePage: r.sample_page,
      promotedSlug: r.promoted_slug,
      promotedAt: r.promoted_at ? new Date(r.promoted_at).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

export async function getChatQuestionByHash(
  questionHash: string,
): Promise<ChatQuestionStat | null> {
  const db = getDbPool();
  if (!db) return null;

  try {
    const res = await db.query<{
      question_hash: string;
      question: string;
      count: number;
      first_seen_at: string;
      last_seen_at: string;
      sample_page: string | null;
      promoted_slug: string | null;
      promoted_at: string | null;
    }>(
      `
      select question_hash, question, count, first_seen_at, last_seen_at, sample_page, promoted_slug, promoted_at
      from elongoat.chat_question_stats
      where question_hash = $1
      limit 1
      `,
      [questionHash],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      questionHash: r.question_hash,
      question: r.question,
      count: r.count,
      firstSeenAt: new Date(r.first_seen_at).toISOString(),
      lastSeenAt: new Date(r.last_seen_at).toISOString(),
      samplePage: r.sample_page,
      promotedSlug: r.promoted_slug,
      promotedAt: r.promoted_at ? new Date(r.promoted_at).toISOString() : null,
    };
  } catch {
    return null;
  }
}

export async function markQuestionPromoted(params: {
  questionHash: string;
  promotedSlug: string;
}): Promise<void> {
  const db = getDbPool();
  if (!db) return;

  try {
    await db.query(
      `
      update elongoat.chat_question_stats
      set promoted_slug = $2, promoted_at = now()
      where question_hash = $1
      `,
      [params.questionHash, params.promotedSlug],
    );
  } catch {
    // ignore
  }
}
