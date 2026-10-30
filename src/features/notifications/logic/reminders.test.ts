import { describe, expect, it } from "vitest";

import { approvalReminders, dueWhen, reviewReminders, taskReminders } from "./reminders";

const now = new Date("2026-10-30T10:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("dueWhen", () => {
  it("names the days around today and ignores the far future", () => {
    expect(dueWhen("2026-10-30", "2026-10-30")).toBe("today");
    expect(dueWhen("2026-10-31", "2026-10-30")).toBe("tomorrow");
    expect(dueWhen("2026-11-01", "2026-10-30")).toBe("in 2 days");
    expect(dueWhen("2026-11-02", "2026-10-30")).toBeNull();
    expect(dueWhen("2026-10-29", "2026-10-30")).toBe("yesterday");
    expect(dueWhen("2026-10-25", "2026-10-30")).toBe("5 days ago");
  });
});

describe("approvalReminders", () => {
  it("counts only requests that have waited two days, one nudge per approver", () => {
    const out = approvalReminders(
      [
        { approverId: "p", since: hoursAgo(49) },
        { approverId: "p", since: hoursAgo(100) },
        { approverId: "p", since: hoursAgo(5) },
        { approverId: "q", since: hoursAgo(48) },
        { approverId: "r", since: hoursAgo(47) },
      ],
      now,
    );
    expect(out.map((d) => d.employeeId).sort()).toEqual(["p", "q"]);
    expect(out.find((d) => d.employeeId === "p")!.title).toBe(
      "2 requests have waited two days for you",
    );
    expect(out.find((d) => d.employeeId === "q")!.title).toBe(
      "1 request has waited two days for you",
    );
    expect(out[0]!.href).toBe("/approvals");
  });
});

describe("taskReminders", () => {
  it("groups due and overdue tasks per assignee and skips future ones", () => {
    const out = taskReminders(
      [
        { assigneeId: "a", dueDate: day("2026-10-30") },
        { assigneeId: "a", dueDate: day("2026-10-27") },
        { assigneeId: "a", dueDate: day("2026-11-05") },
        { assigneeId: "b", dueDate: day("2026-10-30") },
        { assigneeId: "c", dueDate: day("2026-11-01") },
      ],
      "2026-10-30",
    );
    expect(out.map((d) => d.employeeId).sort()).toEqual(["a", "b"]);
    expect(out.find((d) => d.employeeId === "a")).toMatchObject({
      title: "2 checklist tasks need you",
      body: "1 overdue, 1 due today.",
    });
    expect(out.find((d) => d.employeeId === "b")).toMatchObject({
      title: "1 checklist task needs you",
      body: "1 due today.",
    });
  });
});

describe("reviewReminders", () => {
  const base = { cycleName: "H2 2026", step: "SELF_REVIEW" as const };
  it("reminds about self reviews due soon or late, one per person", () => {
    const out = reviewReminders(
      [
        { ...base, reviewerId: "a", due: day("2026-10-31") },
        { ...base, reviewerId: "b", due: day("2026-10-27") },
        { ...base, reviewerId: "c", due: day("2026-11-20") },
      ],
      "2026-10-30",
    );
    expect(out.map((d) => d.employeeId)).toEqual(["a", "b"]);
    expect(out[0]!.title).toBe("Your H2 2026 self review is due tomorrow");
    expect(out[1]!.title).toBe("Your H2 2026 self review was due 3 days ago");
  });

  it("rolls a manager's reviews into one message", () => {
    const out = reviewReminders(
      [
        { cycleName: "H2 2026", step: "MANAGER_REVIEW", reviewerId: "m", due: day("2026-10-30") },
        { cycleName: "H2 2026", step: "MANAGER_REVIEW", reviewerId: "m", due: day("2026-10-30") },
        { cycleName: "H2 2026", step: "MANAGER_REVIEW", reviewerId: "m", due: day("2026-10-30") },
      ],
      "2026-10-30",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("3 manager reviews are due today");
  });
});
