import { describe, expect, it } from "vitest";

import { rateLimit } from "@/lib/rateLimit";

describe("rateLimit (in-memory)", () => {
  it("enforces a simple windowed limit", async () => {
    delete process.env.REDIS_URL;
    const key = `rl:test:${Date.now()}:${Math.random().toString(16).slice(2)}`;

    const a = await rateLimit({ key, limit: 2, windowSeconds: 60 });
    expect(a.ok).toBe(true);
    expect(a.remaining).toBe(1);

    const b = await rateLimit({ key, limit: 2, windowSeconds: 60 });
    expect(b.ok).toBe(true);
    expect(b.remaining).toBe(0);

    const c = await rateLimit({ key, limit: 2, windowSeconds: 60 });
    expect(c.ok).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.resetSeconds).toBeGreaterThan(0);
  });
});
