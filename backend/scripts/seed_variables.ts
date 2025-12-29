import { getDb, withTransaction } from "../lib/db";

function env(name: string, fallback: string): string {
  return (process.env[name] ?? fallback).trim();
}

async function main() {
  const dob = env("ELON_DOB", "1971-06-28");
  const children = env("ELON_CHILDREN_COUNT", "14");
  const netWorth = env(
    "ELON_NET_WORTH",
    "Varies with markets (estimate; may be outdated).",
  );
  const chatMood = env("CHAT_MOOD", "confident");
  const chatTyping = env("CHAT_TYPING_QUIRK", "1");

  await withTransaction(async (client) => {
    await client.query(
      `
      insert into elongoat.variables (key, value, type) values
        ('dob', $1, 'date'),
        ('children_count', $2, 'number'),
        ('net_worth', $3, 'string'),
        ('chat_mood', $4, 'string'),
        ('chat_typing_quirk', $5, 'boolean')
      on conflict (key) do update set
        value = excluded.value,
        type = excluded.type,
        updated_at = now();
      `,
      [dob, children, netWorth, chatMood, chatTyping],
    );
  });

  console.log(
    "[vars] Seeded dob/children_count/net_worth/chat_mood/chat_typing_quirk into elongoat.variables",
  );
  await getDb().end();
}

main().catch((err) => {
  console.error("[vars] Failed:", err);
  process.exitCode = 1;
});
