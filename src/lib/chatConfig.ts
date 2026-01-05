import "server-only";

import { z } from "zod";

import type { ChatConfig, ChatMood } from "./buildSystemPrompt";
import { getDbPool } from "./db";
import { getRedis } from "./redis";
import { getEnv } from "./env";

const env = getEnv();
const MoodSchema = z.enum(["confident", "neutral", "defensive"]);

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return fallback;
}

function parseMood(value: string | undefined, fallback: ChatMood): ChatMood {
  const v = (value ?? "").trim().toLowerCase();
  const parsed = MoodSchema.safeParse(v);
  return parsed.success ? parsed.data : fallback;
}

type ChatConfigResult = { config: ChatConfig; updatedAt: string };

export async function getChatConfig(): Promise<ChatConfigResult> {
  const envConfig: ChatConfig = {
    mood: parseMood(env.CHAT_MOOD, "confident"),
    typingQuirk: env.CHAT_TYPING_QUIRK,
  };

  const redis = getRedis();
  if (redis) {
    try {
      await redis.connect();
      const cached = await redis.get("vars:chat-config");
      if (cached) return JSON.parse(cached) as ChatConfigResult;
    } catch {
      // ignore cache errors
    }
  }

  const db = getDbPool();
  if (!db) return { config: envConfig, updatedAt: new Date().toISOString() };

  let mood = envConfig.mood;
  let typingQuirk = envConfig.typingQuirk;
  let updatedAt = new Date().toISOString();

  try {
    const res = await db.query<{
      key: string;
      value: string;
      updated_at: string;
    }>(
      `
      select key, value, updated_at
      from elongoat.variables
      where key = any($1::text[])
      `,
      [["chat_mood", "chat_typing_quirk"]],
    );

    for (const row of res.rows) {
      if (row.key === "chat_mood") mood = parseMood(row.value, mood);
      if (row.key === "chat_typing_quirk")
        typingQuirk = parseBool(row.value, typingQuirk);
    }

    const maxUpdated = res.rows
      .map((r) => new Date(r.updated_at).toISOString())
      .sort()
      .at(-1);
    if (maxUpdated) updatedAt = maxUpdated;
  } catch {
    // ignore DB errors
  }

  const result: ChatConfigResult = { config: { mood, typingQuirk }, updatedAt };

  if (redis) {
    try {
      await redis.connect();
      await redis.set("vars:chat-config", JSON.stringify(result), "EX", 30);
    } catch {
      // ignore cache errors
    }
  }

  return result;
}
