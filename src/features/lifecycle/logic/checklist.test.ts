import { describe, expect, it } from "vitest";

import { canTick, checklistProgress, dueLabel, nextTask, planTasks } from "./checklist";

const template = [
  { title: "Laptop ready", description: null, assigneeRole: "IT", dueOffsetDays: -2, sortOrder: 1 },
  {
    title: "Welcome lunch",
    description: null,
    assigneeRole: "MANAGER",
    dueOffsetDays: 0,
    sortOrder: 2,
  },
  {
    title: "Send offer pack",
    description: null,
    assigneeRole: "HR",
    dueOffsetDays: -10,
    sortOrder: 0,
  },
  {
    title: "Set up payroll",
    description: null,
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: 3,
    sortOrder: 3,
  },
] as const;

describe("planTasks", () => {
  it("dates tasks from the start date, names the people, and orders by due date", () => {
    const tasks = planTasks(template, "2026-11-09", {
      HR: "hr",
      IT: null,
      MANAGER: "mgr",
      EMPLOYEE: "new",
    });
    expect(tasks.map((t) => [t.title, t.dueDate, t.assigneeId, t.sortOrder])).toEqual([
      ["Send offer pack", "2026-10-30", "hr", 0],
      ["Laptop ready", "2026-11-07", null, 1],
      ["Welcome lunch", "2026-11-09", "mgr", 2],
      ["Set up payroll", "2026-11-12", "new", 3],
    ]);
  });
});

describe("progress", () => {
  const tasks = [
    { dueDate: "2026-10-20", completedAt: "2026-10-19T10:00:00Z" },
    { dueDate: "2026-10-25", completedAt: null },
    { dueDate: "2026-11-02", completedAt: null },
  ];

  it("counts done and overdue", () => {
    expect(checklistProgress(tasks, "2026-10-30")).toEqual({
      done: 1,
      total: 3,
      overdue: 1,
      percent: 33,
      complete: false,
    });
  });

  it("is complete only when every task is done", () => {
    expect(checklistProgress([], "2026-10-30").complete).toBe(false);
    expect(checklistProgress([tasks[0]!], "2026-10-30").complete).toBe(true);
  });

  it("picks the open task due soonest", () => {
    expect(nextTask(tasks)?.dueDate).toBe("2026-10-25");
    expect(nextTask([tasks[0]!])).toBeNull();
  });
});

describe("dueLabel", () => {
  it("speaks plainly about time", () => {
    expect(dueLabel("2026-10-30", "2026-10-30")).toBe("Due today");
    expect(dueLabel("2026-10-29", "2026-10-30")).toBe("1 day overdue");
    expect(dueLabel("2026-10-27", "2026-10-30")).toBe("3 days overdue");
    expect(dueLabel("2026-10-31", "2026-10-30")).toBe("Due tomorrow");
    expect(dueLabel("2026-11-03", "2026-10-30")).toBe("Due in 4 days");
    expect(dueLabel("2026-11-09", "2026-10-30")).toBe("Due Mon 9 Nov");
  });
});

describe("canTick", () => {
  it("lets the assignee or the people team tick a task", () => {
    expect(canTick({ employeeId: "a", manage: false }, { assigneeId: "a" })).toBe(true);
    expect(canTick({ employeeId: "a", manage: false }, { assigneeId: "b" })).toBe(false);
    expect(canTick({ employeeId: "a", manage: false }, { assigneeId: null })).toBe(false);
    expect(canTick({ employeeId: null, manage: true }, { assigneeId: "b" })).toBe(true);
  });
});
