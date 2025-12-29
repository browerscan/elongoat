import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "../lib/db";

async function main() {
  const sqlPath = path.join(process.cwd(), "backend", "supabase", "schema.sql");
  const sql = await readFile(sqlPath, "utf-8");

  const db = getDb();
  console.log(`[schema] Applying ${sqlPath}`);
  await db.query(sql);
  console.log("[schema] Done");
  await db.end();
}

main().catch((err) => {
  console.error("[schema] Failed:", err);
  process.exitCode = 1;
});
