import { describe, expect, it } from "vitest";

import { policySummary, roleChangeProblem, shiftProblem, weekSummary } from "./logic";

describe("shiftProblem", () => {
  it("accepts an ordinary day", () => {
    expect(shiftProblem("09:30", "18:30")).toBeNull();
    expect(shiftProblem("00:00", "23:59")).toMatch(/at most fourteen/);
  });
  it("wants the 24-hour format", () => {
    expect(shiftProblem("9:30", "18:30")).toMatch(/24-hour/);
    expect(shiftProblem("09:30", "25:00")).toMatch(/24-hour/);
    expect(shiftProblem("09:30", "18:60")).toMatch(/24-hour/);
  });
  it("rejects backwards, tiny and enormous days", () => {
    expect(shiftProblem("18:30", "09:30")).toMatch(/end after it starts/);
    expect(shiftProblem("09:00", "09:00")).toMatch(/end after it starts/);
    expect(shiftProblem("09:00", "12:00")).toMatch(/at least four/);
  });
});

describe("weekSummary", () => {
  it("collapses a run of days", () => {
    expect(weekSummary([1, 2, 3, 4, 5])).toBe("Mon to Fri");
    expect(weekSummary([5, 4, 3, 2, 1, 6])).toBe("Mon to Sat");
  });
  it("lists days that aren't in a row", () => {
    expect(weekSummary([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(weekSummary([6, 7])).toBe("Sat, Sun");
    expect(weekSummary([])).toBe("No working days");
  });
});

describe("roleChangeProblem", () => {
  const base = {
    actorUserId: "admin",
    target: { id: "u1", name: "Rahul", role: "HR_MANAGER" as const, isDemo: false },
    newRole: "TEAM_MANAGER" as const,
    superAdmins: 2,
  };
  it("allows an ordinary change", () => {
    expect(roleChangeProblem(base)).toBeNull();
  });
  it("won't change nothing", () => {
    expect(roleChangeProblem({ ...base, newRole: "HR_MANAGER" })).toMatch(/already has/);
  });
  it("won't let people change their own role", () => {
    expect(roleChangeProblem({ ...base, actorUserId: "u1" })).toMatch(/your own role/);
  });
  it("leaves the demo accounts alone", () => {
    expect(roleChangeProblem({ ...base, target: { ...base.target, isDemo: true } })).toMatch(
      /Demo accounts/,
    );
  });
  it("always keeps a super admin", () => {
    const last = {
      ...base,
      target: { ...base.target, role: "SUPER_ADMIN" as const },
      superAdmins: 1,
    };
    expect(roleChangeProblem(last)).toMatch(/at least one super admin/);
    expect(roleChangeProblem({ ...last, superAdmins: 2 })).toBeNull();
  });
});

describe("policySummary", () => {
  it("says it in a line", () => {
    expect(
      policySummary({
        annualQuota: 24,
        accrual: "MONTHLY",
        carryForwardMax: 15,
        proRataOnJoin: true,
      }),
    ).toBe("24 days a year · earned monthly · carries over up to 15");
    expect(
      policySummary({
        annualQuota: 6.5,
        accrual: "UPFRONT",
        carryForwardMax: 0,
        proRataOnJoin: false,
      }),
    ).toBe("6.5 days a year · given up front · doesn't carry over");
  });
});
