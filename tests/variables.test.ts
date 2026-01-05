import { describe, expect, it } from "vitest";

import { calculateAge } from "../src/lib/variables";

describe("calculateAge", () => {
  it("calculates age after birthday (UTC)", () => {
    const now = new Date(Date.UTC(2025, 11, 24, 0, 0, 0));
    expect(calculateAge("1971-06-28", now)).toBe(54);
  });

  it("calculates age before birthday (UTC)", () => {
    const now = new Date(Date.UTC(2025, 5, 27, 0, 0, 0));
    expect(calculateAge("1971-06-28", now)).toBe(53);
  });

  it("calculates age on birthday (UTC)", () => {
    const now = new Date(Date.UTC(2025, 5, 28, 0, 0, 0));
    expect(calculateAge("1971-06-28", now)).toBe(54);
  });
});
