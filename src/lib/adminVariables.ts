import "server-only";

import { z } from "zod";

import { getDbPool } from "./db";
import { getRedis } from "./redis";
import { getChatConfig } from "./chatConfig";
import { getDynamicVariables } from "./variables";

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const MoodSchema = z.enum(["confident", "neutral", "defensive"]);

export const AdminVariablesUpdateSchema = z
  .object({
    dob: IsoDateSchema.optional(),
    children_count: z.number().int().min(0).max(100).optional(),
    net_worth: z.string().min(1).max(240).optional(),
    chat_mood: MoodSchema.optional(),
    chat_typing_quirk: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No updates provided" });

export type AdminVariablesUpdate = z.infer<typeof AdminVariablesUpdateSchema>;

export type AdminVariablesSnapshot = {
  ok: true;
  variables: {
    dob: string;
    age: number;
    children_count: number;
    net_worth: string;
    chat_mood: "confident" | "neutral" | "defensive";
    chat_typing_quirk: boolean;
  };
  updatedAt: { vars: string; chat: string };
};

export async function getAdminVariablesSnapshot(): Promise<AdminVariablesSnapshot> {
  const vars = await getDynamicVariables();
  const chat = await getChatConfig();
  return {
    ok: true,
    variables: {
      dob: vars.dob,
      age: vars.age,
      children_count: vars.children_count,
      net_worth: vars.net_worth,
      chat_mood: chat.config.mood,
      chat_typing_quirk: chat.config.typingQuirk,
    },
    updatedAt: {
      vars: vars.updatedAt,
      chat: chat.updatedAt,
    },
  };
}

export async function updateAdminVariables(
  update: AdminVariablesUpdate,
): Promise<{ ok: true; updatedKeys: string[] }> {
  const db = getDbPool();
  if (!db) throw new Error("DATABASE_URL not configured");

  const rows: Array<{ key: string; value: string; type: string }> = [];
  if (update.dob != null)
    rows.push({ key: "dob", value: update.dob, type: "date" });
  if (update.children_count != null)
    rows.push({
      key: "children_count",
      value: String(update.children_count),
      type: "number",
    });
  if (update.net_worth != null)
    rows.push({ key: "net_worth", value: update.net_worth, type: "string" });
  if (update.chat_mood != null)
    rows.push({ key: "chat_mood", value: update.chat_mood, type: "string" });
  if (update.chat_typing_quirk != null)
    rows.push({
      key: "chat_typing_quirk",
      value: update.chat_typing_quirk ? "1" : "0",
      type: "boolean",
    });

  if (!rows.length) throw new Error("No updates provided");

  const values: unknown[] = [];
  const tuples: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const base = i * 3;
    tuples.push(`($${base + 1},$${base + 2},$${base + 3})`);
    values.push(rows[i].key, rows[i].value, rows[i].type);
  }

  await db.query(
    `
    insert into elongoat.variables (key, value, type)
    values ${tuples.join(",\n")}
    on conflict (key) do update set
      value = excluded.value,
      type = excluded.type,
      updated_at = now();
    `,
    values,
  );

  // Best-effort cache invalidation (avoid waiting for TTLs).
  const redis = getRedis();
  if (redis) {
    try {
      await redis.connect();
      await redis.del("vars:dynamic", "vars:chat-config");
    } catch {
      // ignore cache errors
    }
  }

  return { ok: true, updatedKeys: rows.map((r) => r.key) };
}
