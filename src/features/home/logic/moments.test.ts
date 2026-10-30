import { describe, expect, it } from "vitest";

import { nextOccurrence, upcomingMoments } from "./moments";

describe("nextOccurrence", () => {
  it("finds this year's date when it hasn't passed", () => {
    expect(nextOccurrence("1990-11-02", "2026-10-30")).toEqual({ day: "2026-11-02", year: 2026 });
    expect(nextOccurrence("1990-10-30", "2026-10-30")).toEqual({ day: "2026-10-30", year: 2026 });
  });

  it("rolls over to next year", () => {
    expect(nextOccurrence("1990-01-04", "2026-12-30")).toEqual({ day: "2027-01-04", year: 2027 });
  });

  it("moves 29 February to the 28th outside leap years", () => {
    expect(nextOccurrence("1992-02-29", "2026-01-10").day).toBe("2026-02-28");
    expect(nextOccurrence("1992-02-29", "2027-03-01").day).toBe("2028-02-29");
  });
});

describe("upcomingMoments", () => {
  const today = "2026-10-30";

  it("finds birthdays and anniversaries ahead, and recent joiners", () => {
    const m = upcomingMoments(
      [
        { id: "a", dateOfBirth: "1991-11-03", joinDate: "2022-06-01" },
        { id: "b", dateOfBirth: null, joinDate: "2023-10-30" },
        { id: "c", dateOfBirth: "1995-12-25", joinDate: "2026-10-12" },
        { id: "d", dateOfBirth: "1988-05-01", joinDate: "2025-11-20" },
      ],
      today,
    );
    expect(m).toEqual([
      { kind: "anniversary", personId: "b", day: "2026-10-30", daysAway: 0, years: 3 },
      { kind: "birthday", personId: "a", day: "2026-11-03", daysAway: 4 },
      { kind: "joined", personId: "c", day: "2026-10-12", daysAway: -18 },
    ]);
  });

  it("doesn't count the day someone joined as an anniversary", () => {
    const m = upcomingMoments([{ id: "x", dateOfBirth: null, joinDate: "2026-10-30" }], today);
    expect(m).toEqual([{ kind: "joined", personId: "x", day: "2026-10-30", daysAway: 0 }]);
  });

  it("ignores people who haven't started yet", () => {
    expect(
      upcomingMoments([{ id: "y", dateOfBirth: null, joinDate: "2026-11-05" }], today),
    ).toEqual([]);
  });
});
