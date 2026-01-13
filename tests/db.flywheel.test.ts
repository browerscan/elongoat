import { afterAll, describe, expect, it } from "vitest";

import { getDbPool } from "../src/lib/db";
import {
  formatDisplayQuestion,
  hashQuestion,
  normalizeQuestion,
  recordChatQuestionStat,
} from "../src/lib/chatAnalytics";
import { getCustomQa, upsertCustomQa } from "../src/lib/customQa";

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";

describe(
  RUN_DB_TESTS
    ? "db integration (flywheel)"
    : "db integration (flywheel) [skipped]",
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

    it("records aggregated chat question stats when enabled", async () => {
      const prev = process.env.CHAT_ANALYTICS_ENABLED;
      process.env.CHAT_ANALYTICS_ENABLED = "1";

      const db = getDbPool();
      expect(db).toBeTruthy();

      const message = "What is the strongest argument for Mars?";
      const display = formatDisplayQuestion(message);
      const hash = hashQuestion(normalizeQuestion(display));

      try {
        await recordChatQuestionStat({ message, currentPage: "/mars" });

        const res = await db!.query<{ count: number }>(
          `select count from elongoat.chat_question_stats where question_hash = $1 limit 1`,
          [hash],
        );
        expect(res.rows[0]?.count ?? 0).toBeGreaterThan(0);
      } finally {
        await db!.query(
          `delete from elongoat.chat_question_stats where question_hash = $1`,
          [hash],
        );
        if (prev === undefined) delete process.env.CHAT_ANALYTICS_ENABLED;
        else process.env.CHAT_ANALYTICS_ENABLED = prev;
      }
    });

    it("stores and reads custom Q&A pages", async () => {
      const db = getDbPool();
      expect(db).toBeTruthy();

      const slug = `test-custom-qa-${Math.random().toString(16).slice(2, 10)}`;
      try {
        await upsertCustomQa({
          slug,
          question: "Test question?",
          answerMd: "## ElonSim answer\n\nok.\n",
          model: "manual",
          sources: { kind: "test" },
        });

        const row = await getCustomQa(slug);
        expect(row?.slug).toBe(slug);
        expect(row?.question).toBe("Test question?");
      } finally {
        await db!.query(`delete from elongoat.custom_qas where slug = $1`, [
          slug,
        ]);
      }
    });
  },
);
