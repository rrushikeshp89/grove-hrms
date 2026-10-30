import { describe, expect, it } from "vitest";

import {
  canWriteReview,
  goalProgress,
  resultsShared,
  keyResultPercent,
  nextCycleStatus,
  ratingGap,
  ratingSummary,
  reviewProblems,
  suggestStatus,
} from "./goals";

describe("key results", () => {
  it("measures progress from start to target", () => {
    expect(keyResultPercent({ startValue: 0, targetValue: 10, currentValue: 4 })).toBe(40);
    expect(keyResultPercent({ startValue: 20, targetValue: 40, currentValue: 30 })).toBe(50);
  });

  it("works for targets that go down", () => {
    expect(keyResultPercent({ startValue: 8, targetValue: 2, currentValue: 5 })).toBe(50);
  });

  it("clamps beyond the target or behind the start", () => {
    expect(keyResultPercent({ startValue: 0, targetValue: 10, currentValue: 15 })).toBe(100);
    expect(keyResultPercent({ startValue: 5, targetValue: 10, currentValue: 2 })).toBe(0);
  });

  it("handles a target equal to the start", () => {
    expect(keyResultPercent({ startValue: 5, targetValue: 5, currentValue: 5 })).toBe(100);
    expect(keyResultPercent({ startValue: 5, targetValue: 5, currentValue: 4 })).toBe(0);
  });

  it("averages key results into goal progress, or leaves it manual", () => {
    expect(
      goalProgress([
        { startValue: 0, targetValue: 10, currentValue: 10 },
        { startValue: 0, targetValue: 10, currentValue: 5 },
        { startValue: 0, targetValue: 4, currentValue: 0 },
      ]),
    ).toBe(50);
    expect(goalProgress([])).toBeNull();
  });
});

describe("suggestStatus", () => {
  const base = { start: "2026-01-01", due: "2026-12-31", today: "2026-07-02" } as const;
  it("compares progress with the time that's passed", () => {
    // Just over half the year gone.
    expect(suggestStatus({ ...base, progress: 55 })).toBe("ON_TRACK");
    expect(suggestStatus({ ...base, progress: 35 })).toBe("AT_RISK");
    expect(suggestStatus({ ...base, progress: 10 })).toBe("OFF_TRACK");
  });
  it("is done at 100 whatever the date", () => {
    expect(suggestStatus({ ...base, progress: 100 })).toBe("DONE");
  });
  it("assumes on track with no due date, and clamps outside the period", () => {
    expect(suggestStatus({ ...base, due: null, progress: 0 })).toBe("ON_TRACK");
    expect(suggestStatus({ ...base, today: "2025-06-01", progress: 0 })).toBe("ON_TRACK");
    expect(suggestStatus({ ...base, today: "2027-06-01", progress: 70 })).toBe("OFF_TRACK");
  });
});

describe("review cycles", () => {
  it("moves through its steps in order and stops at closed", () => {
    expect(nextCycleStatus("DRAFT")).toBe("SELF_REVIEW");
    expect(nextCycleStatus("CALIBRATION")).toBe("CLOSED");
    expect(nextCycleStatus("CLOSED")).toBeNull();
  });

  it("asks for thoughtful answers and a rating before submitting", () => {
    expect(reviewProblems("PEER", {}, null)).toEqual(["well", "different", "rating"]);
    expect(
      reviewProblems("PEER", { well: "Great at unblocking people", different: "Short." }, 4),
    ).toEqual(["different"]);
    expect(
      reviewProblems(
        "PEER",
        { well: "Great at unblocking people", different: "Could say no more often" },
        4,
      ),
    ).toEqual([]);
    expect(reviewProblems("PEER", { well: "x".repeat(20), different: "y".repeat(20) }, 6)).toEqual([
      "rating",
    ]);
  });

  it("summarizes ratings, ignoring blanks", () => {
    expect(ratingSummary([5, 4, 4, null, 3, 4])).toEqual({
      counts: [0, 0, 1, 3, 1],
      count: 5,
      average: 4,
    });
    expect(ratingSummary([])).toEqual({ counts: [0, 0, 0, 0, 0], count: 0, average: null });
  });

  it("measures the gap between self and manager ratings", () => {
    expect(ratingGap(3, 4)).toBe(1);
    expect(ratingGap(5, 3)).toBe(-2);
    expect(ratingGap(null, 4)).toBeNull();
  });
});

describe("review windows", () => {
  it("lets self and peer reviews run through the manager phase, but manager reviews only in it", () => {
    expect(canWriteReview("SELF", "SELF_REVIEW")).toBe(true);
    expect(canWriteReview("SELF", "MANAGER_REVIEW")).toBe(true);
    expect(canWriteReview("SELF", "CALIBRATION")).toBe(false);
    expect(canWriteReview("PEER", "SELF_REVIEW")).toBe(true);
    expect(canWriteReview("MANAGER", "SELF_REVIEW")).toBe(false);
    expect(canWriteReview("MANAGER", "MANAGER_REVIEW")).toBe(true);
    expect(canWriteReview("MANAGER", "CLOSED")).toBe(false);
    expect(canWriteReview("SELF", "DRAFT")).toBe(false);
  });

  it("shares results only when the cycle closes", () => {
    expect(resultsShared("CALIBRATION")).toBe(false);
    expect(resultsShared("CLOSED")).toBe(true);
  });
});
