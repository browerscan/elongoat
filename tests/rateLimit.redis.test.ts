import { afterAll, describe, expect, it } from "vitest";

import { getRedis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";

const RUN_REDIS_TESTS = process.env.RUN_REDIS_TESTS === "1";

describe(
  RUN_REDIS_TESTS ? "rateLimit (redis)" : "rateLimit (redis) [skipped]",
  () => {
    if (!RUN_REDIS_TESTS) {
      it.skip("requires RUN_REDIS_TESTS=1", () => {});
      return;
    }

    process.env.REDIS_URL ||= "redis://localhost:63790/0";

    afterAll(async () => {
      const redis = getRedis();
      try {
        await redis?.quit();
      } catch {
        // ignore
      }
    });

    it("uses redis with TTL", async () => {
      const redis = getRedis();
      expect(redis).toBeTruthy();
      await redis!.connect();
      await redis!.ping();

      const key = `rl:test:redis:${Date.now()}:${Math.random().toString(16).slice(2)}`;

      const a = await rateLimit({ key, limit: 2, windowSeconds: 5 });
      expect(a.ok).toBe(true);
      expect(a.remaining).toBe(1);
      expect(a.resetSeconds).toBeGreaterThan(0);

      const b = await rateLimit({ key, limit: 2, windowSeconds: 5 });
      expect(b.ok).toBe(true);
      expect(b.remaining).toBe(0);

      const c = await rateLimit({ key, limit: 2, windowSeconds: 5 });
      expect(c.ok).toBe(false);
      expect(c.remaining).toBe(0);

      await redis!.del(key);
    });
  },
);
