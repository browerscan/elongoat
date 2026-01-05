import { getDb, withTransaction } from "../lib/db";
import { getEnv } from "../lib/env";

const env = getEnv();

async function main() {
  const dob = env.ELON_DOB;
  const children = String(env.ELON_CHILDREN_COUNT);
  const netWorth = env.ELON_NET_WORTH;
  const chatMood = env.CHAT_MOOD;
  const chatTyping = env.CHAT_TYPING_QUIRK ? "true" : "false";

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
