import { describe, expect, it } from "vitest";

import { tenure } from "./dates";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("tenure", () => {
  it.each([
    ["2026-10-29", "2026-10-29", "Joined today"],
    ["2026-10-26", "2026-10-29", "3 days"],
    ["2026-10-28", "2026-10-29", "1 day"],
    ["2026-09-29", "2026-10-29", "1 month"],
    ["2025-10-29", "2026-10-29", "1 year"],
    ["2021-03-15", "2026-10-29", "5 years, 7 months"],
    ["2026-01-31", "2026-02-28", "28 days"],
    ["2026-01-15", "2026-03-14", "1 month"],
  ])("%s → %s is %s", (from, to, expected) => {
    expect(tenure(d(from), d(to))).toBe(expected);
  });
});
