import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb, withTransaction } from "../lib/db";
import { slugify } from "../lib/slugify";

type PaaJson = {
  questions: {
    slug: string;
    question: string;
    parent?: string | null;
    answer?: string | null;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
    volume?: number;
  }[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const jsonPath = path.join(
    process.cwd(),
    "data",
    "generated",
    "paa-index.json",
  );
  const raw = await readFile(jsonPath, "utf-8");
  const data = JSON.parse(raw) as PaaJson;

  console.log(
    `[paa] Loaded questions=${data.questions.length} from ${jsonPath}`,
  );

  await withTransaction(async (client) => {
    const questions = data.questions.map((q) => ({
      slug: q.slug,
      question: q.question,
      answer: q.answer ?? null,
      parentSlug: q.parent ? slugify(q.parent) : null,
      volume: Number.isFinite(q.volume)
        ? Math.max(0, Math.trunc(q.volume ?? 0))
        : 0,
      sourceUrl: q.sourceUrl ?? null,
      sourceTitle: q.sourceTitle ?? null,
    }));

    for (const batch of chunk(questions, 250)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      let i = 0;
      for (const q of batch) {
        const base = i * 6;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`,
        );
        values.push(
          q.slug,
          q.question,
          q.answer,
          q.volume,
          q.sourceUrl,
          q.sourceTitle,
        );
        i += 1;
      }

      const sql = `
        insert into elongoat.paa_tree (slug, question, answer, volume, source_url, source_title)
        values ${tuples.join(",\n")}
        on conflict (slug) do update set
          question = excluded.question,
          answer = excluded.answer,
          volume = excluded.volume,
          source_url = excluded.source_url,
          source_title = excluded.source_title,
          updated_at = now()
        returning id, slug;
      `;
      await client.query(sql, values);
    }

    const slugs = questions.map((q) => q.slug);
    const idRes = await client.query<{ id: string; slug: string }>(
      `select id, slug from elongoat.paa_tree where slug = any($1::text[])`,
      [slugs],
    );
    const idBySlug = new Map(idRes.rows.map((r) => [r.slug, r.id]));

    const relationships = questions
      .filter(
        (q) =>
          q.parentSlug && idBySlug.has(q.slug) && idBySlug.has(q.parentSlug),
      )
      .map((q) => [q.slug, q.parentSlug!] as const);

    if (relationships.length) {
      console.log(`[paa] Linking parent relationships=${relationships.length}`);
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let i = 0; i < relationships.length; i++) {
        const base = i * 2;
        tuples.push(`($${base + 1},$${base + 2})`);
        values.push(relationships[i][0], relationships[i][1]);
      }

      const sql = `
        with rel(child_slug, parent_slug) as (
          values ${tuples.join(",\n")}
        )
        update elongoat.paa_tree as child
        set parent_id = parent.id
        from rel
        join elongoat.paa_tree as parent on parent.slug = rel.parent_slug
        where child.slug = rel.child_slug;
      `;
      await client.query(sql, values);
    } else {
      console.log("[paa] No parent relationships found to link");
    }
  });

  console.log("[paa] Done");
  await getDb().end();
}

main().catch((err) => {
  console.error("[paa] Failed:", err);
  process.exitCode = 1;
});
