import { createReadStream } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse";

import { getDb, withTransaction } from "../lib/db";
import { parseLoosePairs } from "../lib/parsePairs";
import { slugify } from "../lib/slugify";

type ClusterRow = Record<string, string | undefined>;

type PageAgg = {
  topic: string;
  topicSlug: string;
  page: string;
  pageSlug: string;
  slug: string;
  pageType: string | null;
  seedKeyword: string | null;
  tags: string | null;
  keywordCount: number;
  maxVolume: number;
  totalVolume: number;
  minKd: number | null;
  maxKd: number | null;
  keywords: KeywordRow[];
};

type KeywordRow = {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number | null;
  competitiveDensity: number | null;
  intent: string | null;
  serpFeatures: string | null;
  trend: string | null;
  clickPotential: string | null;
  contentReferences: Record<string, string> | null;
  competitors: Record<string, string> | null;
};

function toInt(value: string | undefined): number {
  if (!value) return 0;
  const s = value.trim();
  if (!s) return 0;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function toNum(value: string | undefined): number | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "elon-musk_clusters.csv");
  console.log(`[clusters] Reading ${csvPath}`);

  const pages = new Map<string, PageAgg>();

  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }),
  );

  for await (const row of parser) {
    const r = row as ClusterRow;

    const topic = (r["Topic"] ?? "").trim();
    const page = (r["Page"] ?? "").trim();
    if (!topic || !page) continue;

    const topicSlug = slugify(topic);
    const pageSlug = slugify(page);
    const slug = `${topicSlug}/${pageSlug}`;

    let agg = pages.get(slug);
    if (!agg) {
      agg = {
        topic,
        topicSlug,
        page,
        pageSlug,
        slug,
        pageType: (r["Page type"] ?? "").trim() || null,
        seedKeyword: (r["Seed keyword"] ?? "").trim() || null,
        tags: (r["Tags"] ?? "").trim() || null,
        keywordCount: 0,
        maxVolume: 0,
        totalVolume: 0,
        minKd: null,
        maxKd: null,
        keywords: [],
      };
      pages.set(slug, agg);
    }

    const keyword = (r["Keyword"] ?? "").trim();
    if (keyword) {
      const volume = toInt(r["Volume"]);
      const kd = toInt(r["Keyword Difficulty"]);
      agg.keywordCount += 1;
      agg.totalVolume += volume;
      agg.maxVolume = Math.max(agg.maxVolume, volume);
      agg.minKd = agg.minKd == null ? kd : Math.min(agg.minKd, kd);
      agg.maxKd = agg.maxKd == null ? kd : Math.max(agg.maxKd, kd);

      agg.keywords.push({
        keyword,
        volume,
        difficulty: kd,
        cpc: toNum(r["CPC (USD)"]),
        competitiveDensity: toNum(r["Competitive Density"]),
        intent: (r["Intent"] ?? "").trim() || null,
        serpFeatures: (r["SERP Features"] ?? "").trim() || null,
        trend: (r["Trend"] ?? "").trim() || null,
        clickPotential: (r["Click potential"] ?? "").trim() || null,
        contentReferences: parseLoosePairs(r["Content references"]),
        competitors: parseLoosePairs(r["Competitors"]),
      });
    }
  }

  const pageList = [...pages.values()];
  console.log(`[clusters] Parsed pages=${pageList.length}`);

  await withTransaction(async (client) => {
    for (const batch of chunk(pageList, 250)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      let i = 0;

      for (const p of batch) {
        const base = i * 13;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13})`,
        );
        values.push(
          p.topic,
          p.topicSlug,
          p.page,
          p.pageSlug,
          p.slug,
          p.pageType,
          p.seedKeyword,
          p.tags,
          p.keywordCount,
          p.maxVolume,
          p.totalVolume,
          p.minKd,
          p.maxKd,
        );
        i += 1;
      }

      const sql = `
        insert into elongoat.cluster_pages
          (topic, topic_slug, page, page_slug, slug, page_type, seed_keyword, tags,
           keyword_count, max_volume, total_volume, min_kd, max_kd)
        values
          ${tuples.join(",\n")}
        on conflict (slug) do update set
          topic = excluded.topic,
          topic_slug = excluded.topic_slug,
          page = excluded.page,
          page_slug = excluded.page_slug,
          page_type = excluded.page_type,
          seed_keyword = excluded.seed_keyword,
          tags = excluded.tags,
          keyword_count = excluded.keyword_count,
          max_volume = excluded.max_volume,
          total_volume = excluded.total_volume,
          min_kd = excluded.min_kd,
          max_kd = excluded.max_kd,
          updated_at = now()
        returning id, slug;
      `;

      const res = await client.query<{ id: string; slug: string }>(sql, values);
      // Keep TS happy and ensure query executed inside txn.
      void res;
    }

    // Map slug -> id
    const slugs = pageList.map((p) => p.slug);
    const idRes = await client.query<{ id: string; slug: string }>(
      `select id, slug from elongoat.cluster_pages where slug = any($1::text[])`,
      [slugs],
    );
    const pageIdBySlug = new Map<string, string>(
      idRes.rows.map((r) => [r.slug, r.id]),
    );

    const keywordRows: {
      page_id: string;
      keyword: string;
      volume: number;
      difficulty: number;
      cpc: number | null;
      competitive_density: number | null;
      intent: string | null;
      serp_features: string | null;
      trend: string | null;
      click_potential: string | null;
      content_references: object | null;
      competitors: object | null;
    }[] = [];

    for (const p of pageList) {
      const pageId = pageIdBySlug.get(p.slug);
      if (!pageId) continue;

      for (const k of p.keywords) {
        keywordRows.push({
          page_id: pageId,
          keyword: k.keyword,
          volume: k.volume,
          difficulty: k.difficulty,
          cpc: k.cpc,
          competitive_density: k.competitiveDensity,
          intent: k.intent,
          serp_features: k.serpFeatures,
          trend: k.trend,
          click_potential: k.clickPotential,
          content_references: k.contentReferences,
          competitors: k.competitors,
        });
      }
    }

    console.log(`[clusters] Inserting keywords=${keywordRows.length}`);

    for (const batch of chunk(keywordRows, 500)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      let i = 0;
      for (const k of batch) {
        const base = i * 12;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12})`,
        );
        values.push(
          k.page_id,
          k.keyword,
          k.volume,
          k.difficulty,
          k.cpc,
          k.competitive_density,
          k.intent,
          k.serp_features,
          k.trend,
          k.click_potential,
          k.content_references ? JSON.stringify(k.content_references) : null,
          k.competitors ? JSON.stringify(k.competitors) : null,
        );
        i += 1;
      }

      const sql = `
        insert into elongoat.cluster_keywords
          (page_id, keyword, volume, difficulty, cpc, competitive_density, intent,
           serp_features, trend, click_potential, content_references, competitors)
        values
          ${tuples.join(",\n")}
        on conflict (page_id, keyword) do update set
          volume = excluded.volume,
          difficulty = excluded.difficulty,
          cpc = excluded.cpc,
          competitive_density = excluded.competitive_density,
          intent = excluded.intent,
          serp_features = excluded.serp_features,
          trend = excluded.trend,
          click_potential = excluded.click_potential,
          content_references = excluded.content_references,
          competitors = excluded.competitors;
      `;
      await client.query(sql, values);
    }
  });

  console.log("[clusters] Done");
  await getDb().end();
}

main().catch((err) => {
  console.error("[clusters] Failed:", err);
  process.exitCode = 1;
});
