import { describe, expect, it } from "vitest";

import { approvalChain, decide } from "./approval";
import { accrued, carryForward, summarize, type Policy } from "./balance";
import { isWorkingDay, leaveDayParts, leaveDays, rangesOverlap } from "./days";
import { validateLeave, type LeaveTypeRules } from "./validate";

// Mon 2 Nov 2026 is the observed Kannada Rajyotsava holiday.
const cal = { workDays: [1, 2, 3, 4, 5], holidays: new Set(["2026-11-02"]) };

describe("leaveDays", () => {
  it("skips weekends and holidays", () => {
    // Fri 30 Oct → Wed 4 Nov: Fri, (Sat, Sun), (Mon holiday), Tue, Wed
    expect(leaveDays({ start: "2026-10-30", end: "2026-11-04" }, cal)).toBe(3);
  });

  it("counts half days at either end", () => {
    const base = { start: "2026-11-03", end: "2026-11-06" }; // Tue → Fri
    expect(leaveDays(base, cal)).toBe(4);
    expect(leaveDays({ ...base, startHalf: "SECOND" }, cal)).toBe(3.5);
    expect(leaveDays({ ...base, startHalf: "SECOND", endHalf: "FIRST" }, cal)).toBe(3);
  });

  it("makes a single half day worth 0.5", () => {
    expect(leaveDays({ start: "2026-11-03", end: "2026-11-03", startHalf: "FIRST" }, cal)).toBe(
      0.5,
    );
  });

  it("is zero for a weekend-only range or a reversed one", () => {
    expect(leaveDays({ start: "2026-10-31", end: "2026-11-01" }, cal)).toBe(0);
    expect(leaveDays({ start: "2026-11-05", end: "2026-11-03" }, cal)).toBe(0);
  });

  it("does not discount a half on a non-working edge", () => {
    expect(leaveDays({ start: "2026-10-31", end: "2026-11-04", startHalf: "SECOND" }, cal)).toBe(2);
  });

  it("lists each day's portion", () => {
    expect(
      leaveDayParts({ start: "2026-11-05", end: "2026-11-06", endHalf: "FIRST" }, cal),
    ).toEqual([
      { day: "2026-11-05", portion: 1, half: null },
      { day: "2026-11-06", portion: 0.5, half: "FIRST" },
    ]);
  });

  it("knows working days and overlaps", () => {
    expect(isWorkingDay("2026-11-02", cal)).toBe(false);
    expect(isWorkingDay("2026-11-03", cal)).toBe(true);
    expect(
      rangesOverlap(
        { start: "2026-11-01", end: "2026-11-05" },
        { start: "2026-11-05", end: "2026-11-09" },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { start: "2026-11-01", end: "2026-11-04" },
        { start: "2026-11-05", end: "2026-11-09" },
      ),
    ).toBe(false);
  });
});

describe("accrued", () => {
  const monthly: Policy = {
    annualQuota: 18,
    accrual: "MONTHLY",
    carryForwardMax: 30,
    proRataOnJoin: true,
  };
  const upfront: Policy = {
    annualQuota: 8,
    accrual: "UPFRONT",
    carryForwardMax: 0,
    proRataOnJoin: true,
  };

  it("earns 1/12 at the start of each month", () => {
    expect(accrued(monthly, "2020-01-01", 2026, "2026-01-15")).toBe(1.5);
    expect(accrued(monthly, "2020-01-01", 2026, "2026-10-30")).toBe(15);
    expect(accrued(monthly, "2020-01-01", 2025, "2026-10-30")).toBe(18);
  });

  it("starts from the first full month after joining", () => {
    expect(accrued(monthly, "2026-03-01", 2026, "2026-10-30")).toBe(12); // Mar–Oct
    expect(accrued(monthly, "2026-03-15", 2026, "2026-10-30")).toBe(10.5); // Apr–Oct
  });

  it("grants upfront leave at once, pro-rated in the joining year", () => {
    expect(accrued(upfront, "2021-06-01", 2026, "2026-01-01")).toBe(8);
    expect(accrued(upfront, "2026-07-01", 2026, "2026-07-01")).toBe(4); // Jul–Dec
    expect(accrued({ ...upfront, proRataOnJoin: false }, "2026-07-01", 2026, "2026-07-01")).toBe(8);
  });

  it("is zero before the year or before joining", () => {
    expect(accrued(monthly, "2020-01-01", 2027, "2026-10-30")).toBe(0);
    expect(accrued(monthly, "2027-02-01", 2026, "2026-10-30")).toBe(0);
  });
});

describe("summarize", () => {
  it("nets carry-forward, usage, holds and adjustments", () => {
    const s = summarize(15, [
      { kind: "CARRY_FORWARD", days: 6 },
      { kind: "PENDING_HOLD", days: -2 }, // approved later
      { kind: "RELEASE", days: 2 },
      { kind: "USAGE", days: -2 },
      { kind: "PENDING_HOLD", days: -1.5 }, // still pending
      { kind: "ADJUSTMENT", days: 1 },
    ]);
    expect(s).toEqual({
      accrued: 15,
      carriedForward: 6,
      adjusted: 1,
      used: 2,
      pending: 1.5,
      available: 18.5,
    });
  });

  it("caps carry-forward by policy", () => {
    const p: Policy = {
      annualQuota: 18,
      accrual: "MONTHLY",
      carryForwardMax: 30,
      proRataOnJoin: true,
    };
    expect(carryForward(p, 34.2)).toBe(30);
    expect(carryForward(p, 4.3)).toBe(4.5);
    expect(carryForward({ ...p, carryForwardMax: 0 }, 9)).toBe(0);
    expect(carryForward(p, -2)).toBe(0);
  });
});

describe("approvalChain and decide", () => {
  it("goes to the manager, then HR for long or two-level leave", () => {
    expect(
      approvalChain({ requesterId: "a", managerId: "m", hrApproverId: "hr", levels: 1, days: 2 }),
    ).toEqual([{ level: 1, approverId: "m", status: "PENDING" }]);
    expect(
      approvalChain({ requesterId: "a", managerId: "m", hrApproverId: "hr", levels: 1, days: 6 }),
    ).toEqual([
      { level: 1, approverId: "m", status: "PENDING" },
      { level: 2, approverId: "hr", status: "WAITING" },
    ]);
    expect(
      approvalChain({ requesterId: "a", managerId: "m", hrApproverId: "hr", levels: 2 }).length,
    ).toBe(2);
  });

  it("doesn't ask HR twice or let people approve themselves", () => {
    expect(
      approvalChain({ requesterId: "a", managerId: "hr", hrApproverId: "hr", levels: 2 }),
    ).toEqual([{ level: 1, approverId: "hr", status: "PENDING" }]);
    expect(
      approvalChain({ requesterId: "ceo", managerId: null, hrApproverId: "hr", levels: 1 })[0]!
        .approverId,
    ).toBe("hr");
  });

  it("moves through levels on approval and stops on rejection", () => {
    const chain = approvalChain({
      requesterId: "a",
      managerId: "m",
      hrApproverId: "hr",
      levels: 2,
    });
    const first = decide(chain, "APPROVE");
    expect(first).toMatchObject({ status: "PENDING", final: false, decidedLevel: 1 });
    expect(first.steps.map((s) => s.status)).toEqual(["APPROVED", "PENDING"]);
    const second = decide(first.steps, "APPROVE");
    expect(second).toMatchObject({ status: "APPROVED", final: true });

    const rejected = decide(chain, "REJECT");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.steps.map((s) => s.status)).toEqual(["REJECTED", "SKIPPED"]);
    expect(() => decide(rejected.steps, "APPROVE")).toThrow();
  });
});

describe("validateLeave", () => {
  const el: LeaveTypeRules = {
    code: "EL",
    name: "Earned leave",
    isPaid: true,
    allowHalfDay: true,
    minNoticeDays: 7,
    maxConsecutiveDays: 15,
  };
  const sl: LeaveTypeRules = {
    code: "SL",
    name: "Sick leave",
    isPaid: true,
    allowHalfDay: true,
    minNoticeDays: 0,
    maxConsecutiveDays: null,
  };
  const lwp: LeaveTypeRules = {
    code: "LWP",
    name: "Leave without pay",
    isPaid: false,
    allowHalfDay: true,
    minNoticeDays: 0,
    maxConsecutiveDays: null,
  };
  const ok = {
    start: "2026-11-16",
    end: "2026-11-17",
    halfDay: false,
    days: 2,
    today: "2026-10-30",
    available: 10,
    overlaps: null,
  };

  it("accepts a valid request", () => {
    expect(validateLeave({ ...ok, type: el })).toEqual([]);
  });

  it("enforces notice with the earliest allowed date", () => {
    const p = validateLeave({ ...ok, type: el, start: "2026-11-02", end: "2026-11-03" });
    expect(p[0]?.message).toContain("7 days' notice");
    expect(p[0]?.message).toContain("Fri 6 Nov");
  });

  it("allows backdated sick leave within a week only", () => {
    expect(
      validateLeave({ ...ok, type: sl, start: "2026-10-28", end: "2026-10-28", days: 1 }),
    ).toEqual([]);
    expect(
      validateLeave({ ...ok, type: sl, start: "2026-10-15", end: "2026-10-15", days: 1 })[0]
        ?.message,
    ).toContain("7 days afterwards");
    expect(
      validateLeave({ ...ok, type: el, start: "2026-10-28", end: "2026-10-28", days: 1 })[0]
        ?.message,
    ).toContain("has passed");
  });

  it("checks balance only for paid leave", () => {
    expect(validateLeave({ ...ok, type: el, days: 12 })[0]?.message).toContain(
      "10 days of earned leave left",
    );
    expect(validateLeave({ ...ok, type: lwp, available: 0 })).toEqual([]);
  });

  it("reports overlaps, empty ranges, year crossings and limits together", () => {
    const p = validateLeave({
      ...ok,
      type: { ...el, maxConsecutiveDays: 3, allowHalfDay: false },
      start: "2026-12-28",
      end: "2027-01-08",
      days: 0,
      halfDay: true,
      overlaps: { start: "2026-12-30", end: "2026-12-31" },
    });
    expect(p.map((x) => x.field)).toEqual(["range", "range", "startHalf", "range"]);
  });
});
