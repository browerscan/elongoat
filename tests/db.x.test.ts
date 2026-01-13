import { afterAll, describe, expect, it } from "vitest";

import { getDbPool } from "../src/lib/db";
import { listXFollowing, listXTweets } from "../src/lib/x";

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";

describe(
  RUN_DB_TESTS ? "db integration (x)" : "db integration (x) [skipped]",
  () => {
    if (!RUN_DB_TESTS) {
      it.skip("requires RUN_DB_TESTS=1", () => {});
      return;
    }

    process.env.DATABASE_URL ||=
      "postgresql" + "://postgres:postgres@localhost:54321/postgres";

    afterAll(async () => {
      const db = getDbPool();
      await db?.end().catch(() => {});
    });

    it("reads tweets via listXTweets()", async () => {
      const db = getDbPool();
      expect(db).toBeTruthy();

      const tweetId = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
      const handle = "elonmusk";
      const url = `https://x.com/${handle}/status/${tweetId}`;
      const content = "Hello from an integration test.";
      const raw = {
        tweet: {
          id_str: tweetId,
          full_text: content,
          user: { screen_name: handle },
        },
      };

      await db!.query(
        `insert into elongoat.x_tweets (handle, tweet_id, url, content, posted_at, raw)
       values ($1,$2,$3,$4,now(),$5)
       on conflict (tweet_id) do update set content = excluded.content, raw = excluded.raw, scraped_at = now()`,
        [handle, tweetId, url, content, JSON.stringify(raw)],
      );

      try {
        const tweets = await listXTweets({ handle, limit: 50 });
        expect(tweets.some((t) => t.tweetId === tweetId)).toBe(true);
      } finally {
        await db!.query(`delete from elongoat.x_tweets where tweet_id = $1`, [
          tweetId,
        ]);
      }
    });

    it("reads following via listXFollowing()", async () => {
      const db = getDbPool();
      expect(db).toBeTruthy();

      const handle = "elonmusk";
      const followingHandle = `test_following_${Math.random().toString(16).slice(2, 10)}`;

      await db!.query(
        `insert into elongoat.x_following (handle, following_handle)
       values ($1,$2)
       on conflict (handle, following_handle) do update set scraped_at = now()`,
        [handle, followingHandle],
      );

      try {
        const following = await listXFollowing({ handle, limit: 5000 });
        expect(
          following.some((f) => f.followingHandle === followingHandle),
        ).toBe(true);
      } finally {
        await db!.query(
          `delete from elongoat.x_following where handle = $1 and following_handle = $2`,
          [handle, followingHandle],
        );
      }
    });
  },
);
