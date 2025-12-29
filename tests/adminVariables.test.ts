import { describe, expect, it } from "vitest";

import { AdminVariablesUpdateSchema } from "@/lib/adminVariables";

describe("AdminVariablesUpdateSchema", () => {
  it("rejects empty payload", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({ nope: true });
    expect(parsed.success).toBe(false);
  });

  it("accepts updating chat mood", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({
      chat_mood: "neutral",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid chat mood", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({ chat_mood: "angry" });
    expect(parsed.success).toBe(false);
  });

  it("accepts dob in YYYY-MM-DD", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({ dob: "1971-06-28" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid dob format", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({ dob: "1971/06/28" });
    expect(parsed.success).toBe(false);
  });

  it("accepts children_count range", () => {
    expect(
      AdminVariablesUpdateSchema.safeParse({ children_count: 0 }).success,
    ).toBe(true);
    expect(
      AdminVariablesUpdateSchema.safeParse({ children_count: 100 }).success,
    ).toBe(true);
    expect(
      AdminVariablesUpdateSchema.safeParse({ children_count: 101 }).success,
    ).toBe(false);
  });

  it("accepts typing quirk boolean", () => {
    const parsed = AdminVariablesUpdateSchema.safeParse({
      chat_typing_quirk: true,
    });
    expect(parsed.success).toBe(true);
  });
});
