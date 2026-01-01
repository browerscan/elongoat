import { z } from "zod";

// Lazy imports for backend-only dependencies
let getDbPool: typeof import("@/lib/db").getDbPool | undefined;
let getRedis: typeof import("@/lib/redis").getRedis | undefined;

async function getBackendModules() {
  try {
    const dbModule = await import("@/lib/db");
    const redisModule = await import("@/lib/redis");
    getDbPool = dbModule.getDbPool;
    getRedis = redisModule.getRedis;
  } catch {
    // Modules not available in static export
  }
}

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date string");

export type DynamicVariables = {
  age: number;
  children_count: number;
  net_worth: string;
  dob: string;
  updatedAt: string;
};

export function calculateAge(dobIso: string, now: Date = new Date()): number {
  const [y, m, d] = dobIso.split("-").map((n) => Number(n));
  const dob = new Date(Date.UTC(y, m - 1, d));
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() >= dob.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return Math.max(0, age);
}

export async function getDynamicVariables(): Promise<DynamicVariables> {
  // Load backend modules lazily (works in static export)
  await getBackendModules();

  const redis = getRedis?.();
  if (redis) {
    try {
      await redis.connect();
      const cached = await redis.get("vars:dynamic");
      if (cached) return JSON.parse(cached) as DynamicVariables;
    } catch {
      // ignore cache errors
    }
  }

  const envDob = IsoDateSchema.parse(process.env.ELON_DOB ?? "1971-06-28");
  const envChildren = Number.parseInt(
    process.env.ELON_CHILDREN_COUNT ?? "14",
    10,
  );
  const envNetWorth =
    process.env.ELON_NET_WORTH ??
    "Varies with markets (estimate; may be outdated).";

  let dob = envDob;
  let children_count = Number.isFinite(envChildren)
    ? Math.max(0, envChildren)
    : 14;
  let net_worth = envNetWorth;
  let updatedAt = new Date().toISOString();

  const db = getDbPool?.();
  if (db) {
    try {
      const res = await db.query<{
        key: string;
        value: string;
        type: string;
        updated_at: string;
      }>(
        `select key, value, type, updated_at
         from elongoat.variables
         where key = any($1::text[])`,
        [["dob", "children_count", "net_worth"]],
      );

      for (const row of res.rows) {
        if (row.key === "dob") {
          dob = IsoDateSchema.parse(row.value);
        }
        if (row.key === "children_count") {
          const n = Number.parseInt(row.value, 10);
          if (Number.isFinite(n)) children_count = Math.max(0, n);
        }
        if (row.key === "net_worth") {
          net_worth = row.value;
        }
      }

      const maxUpdated = res.rows
        .map((r) => new Date(r.updated_at).toISOString())
        .sort()
        .at(-1);
      if (maxUpdated) updatedAt = maxUpdated;
    } catch {
      // DB errors should not take down the site; keep env fallback.
    }
  }

  const vars: DynamicVariables = {
    dob,
    age: calculateAge(dob),
    children_count,
    net_worth,
    updatedAt,
  };

  if (redis) {
    try {
      await redis.connect();
      await redis.set("vars:dynamic", JSON.stringify(vars), "EX", 60 * 60);
    } catch {
      // ignore cache errors
    }
  }

  return vars;
}
