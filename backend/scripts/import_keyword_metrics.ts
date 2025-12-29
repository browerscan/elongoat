import { createReadStream } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse";

import { getDb, withTransaction } from "../lib/db";

type Row = Record<string, string | undefined>;

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

async function loadCsv(csvPath: string): Promise<
  {
    keyword: string;
    intent: string | null;
    volume: number;
    difficulty: number;
    cpc: number | null;
    serp_features: string | null;
  }[]
> {
  const rows: {
    keyword: string;
    intent: string | null;
    volume: number;
    difficulty: number;
    cpc: number | null;
    serp_features: string | null;
  }[] = [];

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
    const r = row as Row;
    const keyword = (r["Keyword"] ?? "").trim();
    if (!keyword) continue;
    rows.push({
      keyword,
      intent: (r["Intent"] ?? "").trim() || null,
      volume: toInt(r["Volume"]),
      difficulty: toInt(r["Keyword Difficulty"]),
      cpc: toNum(r["CPC (USD)"]),
      serp_features: (r["SERP Features"] ?? "").trim() || null,
    });
  }

  return rows;
}

async function importFile(fileName: string, source: string) {
  const csvPath = path.join(process.cwd(), "data", fileName);
  console.log(`[metrics] Reading ${csvPath}`);
  const rows = await loadCsv(csvPath);
  console.log(`[metrics] Parsed rows=${rows.length} source=${source}`);

  await withTransaction(async (client) => {
    for (const batch of chunk(rows, 1000)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      let i = 0;
      for (const r of batch) {
        const base = i * 6;
        tuples.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`,
        );
        values.push(r.keyword, source, r.intent, r.volume, r.difficulty, r.cpc);
        i += 1;
      }

      const sql = `
        insert into elongoat.keyword_metrics (keyword, source, intent, volume, difficulty, cpc)
        values ${tuples.join(",\n")}
        on conflict (keyword, source) do update set
          intent = excluded.intent,
          volume = excluded.volume,
          difficulty = excluded.difficulty,
          cpc = excluded.cpc,
          updated_at = now();
      `;
      await client.query(sql, values);
    }

    // serp_features update (optional) in smaller chunks to keep param sizes safe
    const withSerp = rows.filter((r) => r.serp_features);
    for (const batch of chunk(withSerp, 800)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        const base = i * 3;
        tuples.push(`($${base + 1},$${base + 2},$${base + 3})`);
        values.push(batch[i].keyword, source, batch[i].serp_features);
      }
      const sql = `
        with v(keyword, source, serp_features) as (values ${tuples.join(",\n")})
        update elongoat.keyword_metrics m
        set serp_features = v.serp_features, updated_at = now()
        from v
        where m.keyword = v.keyword and m.source = v.source;
      `;
      await client.query(sql, values);
    }
  });
}

async function main() {
  await importFile(
    "elon-musk_broad-match_us_keywords.csv",
    "broad_match_keywords",
  );
  await importFile(
    "elon-musk_broad-match_us_question.csv",
    "broad_match_questions",
  );
  console.log("[metrics] Done");
  await getDb().end();
}

main().catch((err) => {
  console.error("[metrics] Failed:", err);
  process.exitCode = 1;
});
