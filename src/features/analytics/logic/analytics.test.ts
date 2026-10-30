import { describe, expect, it } from "vitest";

import {
  arrivalGrid,
  attrition,
  funnelCounts,
  furthestStage,
  headcountOn,
  headcountSeries,
  leaveByBucket,
  median,
  monthsBetween,
} from "./metrics";
import { bucketIndex, bucketsFor, parseRange, spanDays } from "./range";

const TODAY = "2026-10-30";
const DATA_START = "2025-10-01";

describe("parseRange", () => {
  it("defaults to the last 12 calendar months", () => {
    expect(parseRange({}, TODAY, DATA_START)).toEqual({
      start: "2025-11-01",
      end: TODAY,
      preset: "12m",
    });
  });

  it("starts presets on the first of a month", () => {
    expect(parseRange({ range: "3m" }, TODAY, DATA_START).start).toBe("2026-08-01");
    expect(parseRange({ range: "6m" }, TODAY, DATA_START).start).toBe("2026-05-01");
    expect(parseRange({ range: "ytd" }, TODAY, DATA_START).start).toBe("2026-01-01");
  });

  it("handles month arithmetic across a year boundary", () => {
    expect(parseRange({ range: "3m" }, "2026-01-15", "2020-01-01").start).toBe("2025-11-01");
  });

  it("accepts a custom range, swapping reversed dates", () => {
    expect(
      parseRange({ range: "custom", from: "2026-06-30", to: "2026-03-01" }, TODAY, DATA_START),
    ).toEqual({ start: "2026-03-01", end: "2026-06-30", preset: "custom" });
  });

  it("clamps to the data window", () => {
    const r = parseRange(
      { range: "custom", from: "2024-01-01", to: "2027-01-01" },
      TODAY,
      DATA_START,
    );
    expect(r).toEqual({ start: DATA_START, end: TODAY, preset: "custom" });
  });

  it("falls back to the default for nonsense", () => {
    expect(parseRange({ range: "custom", from: "soon" }, TODAY, DATA_START).preset).toBe("12m");
    expect(parseRange({ range: "forever" }, TODAY, DATA_START).preset).toBe("12m");
  });
});

describe("bucketsFor", () => {
  it("uses calendar months for longer ranges, clipped at the ends", () => {
    const b = bucketsFor({ start: "2026-05-01", end: "2026-10-30" });
    expect(b.map((x) => x.key)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(b[1]).toMatchObject({ start: "2026-06-01", end: "2026-06-30", label: "Jun 26" });
    expect(b.at(-1)!.end).toBe("2026-10-30");
  });

  it("uses Monday-start weeks for ranges up to about three months", () => {
    const b = bucketsFor({ start: "2026-08-01", end: "2026-10-30" });
    expect(spanDays({ start: "2026-08-01", end: "2026-10-30" })).toBe(91);
    // 1 Aug 2026 is a Saturday: the first week is clipped to start that day.
    expect(b[0]).toMatchObject({ key: "2026-07-27", start: "2026-08-01", end: "2026-08-02" });
    expect(b[1]).toMatchObject({ start: "2026-08-03", end: "2026-08-09" });
    expect(b.at(-1)!.end).toBe("2026-10-30");
  });

  it("finds the bucket for a day", () => {
    const b = bucketsFor({ start: "2026-01-01", end: "2026-12-31" });
    expect(bucketIndex(b, "2026-01-01")).toBe(0);
    expect(bucketIndex(b, "2026-07-31")).toBe(6);
    expect(bucketIndex(b, "2025-12-31")).toBe(-1);
  });
});

const people = [
  { joinDate: "2020-01-01", exitDate: null },
  { joinDate: "2024-03-01", exitDate: "2026-02-15" },
  { joinDate: "2026-02-01", exitDate: null },
  { joinDate: "2026-03-10", exitDate: null },
  { joinDate: "2023-05-05", exitDate: "2026-03-31" },
];

describe("headcount", () => {
  it("counts people employed at the end of a day", () => {
    expect(headcountOn(people, "2026-01-31")).toBe(3);
    // Someone's last day still counts that day; they're gone the next.
    expect(headcountOn(people, "2026-02-14")).toBe(4);
    expect(headcountOn(people, "2026-02-15")).toBe(3);
  });

  it("tracks joiners and leavers per bucket", () => {
    const series = headcountSeries(people, bucketsFor({ start: "2026-01-01", end: "2026-04-30" }));
    expect(series.map((p) => [p.key, p.headcount, p.joiners, p.leavers])).toEqual([
      ["2026-01", 3, 0, 0],
      ["2026-02", 3, 1, 1],
      ["2026-03", 3, 1, 1],
      ["2026-04", 3, 0, 0],
    ]);
  });
});

describe("attrition", () => {
  it("divides leavers by average headcount and annualizes", () => {
    const a = attrition(people, { start: "2026-01-01", end: "2026-06-30" });
    expect(a).toMatchObject({ opening: 3, closing: 3, leavers: 2, average: 3 });
    expect(a.rate).toBeCloseTo(2 / 3);
    expect(a.annualized).toBeCloseTo((2 / 3) * (365 / 181));
  });

  it("is zero for an empty company", () => {
    expect(attrition([], { start: "2026-01-01", end: "2026-01-31" }).rate).toBe(0);
  });

  it("counts whole months of tenure", () => {
    expect(monthsBetween("2024-03-15", "2026-03-14")).toBe(23);
    expect(monthsBetween("2024-03-15", "2026-03-15")).toBe(24);
  });
});

describe("hiring funnel", () => {
  it("takes the furthest stage, ignoring rejection", () => {
    expect(furthestStage(["APPLIED", "SCREENING", "INTERVIEW", "REJECTED"])).toBe("INTERVIEW");
    expect(furthestStage(["APPLIED", "REJECTED"])).toBe("APPLIED");
    expect(furthestStage([])).toBe("APPLIED");
  });

  it("counts everyone who passed through each stage", () => {
    const f = funnelCounts(["APPLIED", "APPLIED", "SCREENING", "INTERVIEW", "HIRED"]);
    expect(f.map((s) => s.count)).toEqual([5, 3, 2, 1, 1]);
    expect(f[0]!.conversion).toBeNull();
    expect(f[1]!.conversion).toBeCloseTo(0.6);
    expect(f[4]!.conversion).toBe(1);
  });

  it("reports zero conversion after an empty stage", () => {
    expect(funnelCounts([]).map((s) => s.conversion)).toEqual([null, 0, 0, 0, 0]);
  });

  it("finds the median", () => {
    expect(median([])).toBeNull();
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe("arrivalGrid", () => {
  it("bins arrivals by weekday and time, folding outliers into the edges", () => {
    const g = arrivalGrid(
      [
        { weekday: 1, minute: 9 * 60 + 10, count: 3 },
        { weekday: 1, minute: 7 * 60, count: 1 }, // early: first column
        { weekday: 5, minute: 12 * 60, count: 2 }, // late: last column
        { weekday: 6, minute: 9 * 60, count: 9 }, // Saturday: ignored
      ],
      { from: 8 * 60 + 30, to: 10 * 60 + 30, step: 30 },
    );
    expect(g.columns).toEqual(["8:30", "9:00", "9:30", "10:00", "10:30+"]);
    expect(g.values[0]).toEqual([1, 3, 0, 0, 0]);
    expect(g.values[4]).toEqual([0, 0, 0, 0, 2]);
    expect(g.values.flat().reduce((a, b) => a + b)).toBe(6);
  });
});

describe("leaveByBucket", () => {
  it("sums day portions per bucket and type", () => {
    const rows = leaveByBucket(
      [
        { day: "2026-01-05", code: "EL", portion: 1 },
        { day: "2026-01-06", code: "EL", portion: 0.5 },
        { day: "2026-02-02", code: "SL", portion: 1 },
        { day: "2026-02-03", code: "XX", portion: 1 },
      ],
      bucketsFor({ start: "2026-01-01", end: "2026-04-30" }),
      ["EL", "SL"],
    );
    expect(rows[0]).toMatchObject({ key: "2026-01", EL: 1.5, SL: 0 });
    expect(rows[1]).toMatchObject({ EL: 0, SL: 1 });
  });
});
