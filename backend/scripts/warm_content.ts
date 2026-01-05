import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "../lib/env";

type TopList = { slugs: string[] };

const env = getEnv();

async function loadTopList(fileName: string): Promise<string[]> {
  const filePath = path.join(process.cwd(), "data", "generated", fileName);
  const raw = await readFile(filePath, "utf-8");
  const json = JSON.parse(raw) as TopList;
  return Array.isArray(json.slugs) ? json.slugs : [];
}

async function post(
  kind: "cluster_page" | "paa_question",
  slugs: string[],
  ttlSeconds?: number,
) {
  const siteUrl = (
    env.NEXT_PUBLIC_API_URL ||
    env.API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const token = env.ELONGOAT_ADMIN_TOKEN;
  if (!token) throw new Error("Missing env: ELONGOAT_ADMIN_TOKEN");

  const res = await fetch(`${siteUrl}/api/admin/generate-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ kind, slugs, ttlSeconds }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text;
}

async function main() {
  const clusterCount = env.WARM_CLUSTER_COUNT;
  const paaCount = env.WARM_PAA_COUNT;

  const topPages = (await loadTopList("top-pages.json")).slice(
    0,
    Math.max(1, clusterCount),
  );
  const topQuestions = (await loadTopList("top-questions.json")).slice(
    0,
    Math.max(1, paaCount),
  );

  console.log(`[warm] cluster_page slugs=${topPages.length}`);
  console.log(await post("cluster_page", topPages, 60 * 60 * 24 * 7));

  console.log(`[warm] paa_question slugs=${topQuestions.length}`);
  console.log(await post("paa_question", topQuestions, 60 * 60 * 24 * 7));
}

main().catch((err) => {
  console.error("[warm] Failed:", err);
  process.exitCode = 1;
});
