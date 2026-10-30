import { format } from "date-fns";

import { addDays, dbDate, type ISODate } from "@/lib/tz";

export const ASSIGNEES = ["HR", "IT", "MANAGER", "EMPLOYEE"] as const;
export type Assignee = (typeof ASSIGNEES)[number];

export const ASSIGNEE_LABELS: Record<"ONBOARDING" | "OFFBOARDING", Record<Assignee, string>> = {
  ONBOARDING: { HR: "People team", IT: "IT", MANAGER: "Manager", EMPLOYEE: "New joiner" },
  OFFBOARDING: { HR: "People team", IT: "IT", MANAGER: "Manager", EMPLOYEE: "Leaver" },
};

export type TemplateTask = {
  title: string;
  description: string | null;
  assigneeRole: Assignee;
  /** Days relative to the join date (onboarding) or last day (offboarding). */
  dueOffsetDays: number;
  sortOrder: number;
};

/**
 * Copies a template into concrete tasks: due dates from the start date and
 * a named person for each role. Copies, so editing the template later never
 * rewrites someone's checklist halfway through.
 */
export function planTasks(
  template: readonly TemplateTask[],
  startDate: ISODate,
  people: Record<Assignee, string | null>,
) {
  return [...template]
    .sort((a, b) => a.dueOffsetDays - b.dueOffsetDays || a.sortOrder - b.sortOrder)
    .map((t, i) => ({
      title: t.title,
      description: t.description,
      assigneeRole: t.assigneeRole,
      assigneeId: people[t.assigneeRole],
      dueDate: addDays(startDate, t.dueOffsetDays),
      sortOrder: i,
    }));
}

export type TaskState = { dueDate: ISODate; completedAt: string | null };

export function checklistProgress(tasks: readonly TaskState[], today: ISODate) {
  const done = tasks.filter((t) => t.completedAt).length;
  const overdue = tasks.filter((t) => !t.completedAt && t.dueDate < today).length;
  return {
    done,
    total: tasks.length,
    overdue,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    complete: tasks.length > 0 && done === tasks.length,
  };
}

/** The open task due soonest, or null when everything's done. */
export function nextTask<T extends TaskState>(tasks: readonly T[]): T | null {
  return (
    [...tasks]
      .filter((t) => !t.completedAt)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
  );
}

/** "Due today", "2 days overdue", "Due tomorrow", "Due in 5 days", "Due Mon 2 Nov". */
export function dueLabel(due: ISODate, today: ISODate): string {
  const days = Math.round((dbDate(due).getTime() - dbDate(today).getTime()) / 864e5);
  if (days === 0) return "Due today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 1) return "Due tomorrow";
  if (days <= 6) return `Due in ${days} days`;
  return `Due ${format(dbDate(due), "EEE d MMM")}`;
}

/**
 * Who may tick a task: whoever it's assigned to, or the people team. A task
 * with nobody assigned (a role we couldn't fill) falls to the people team.
 */
export function canTick(
  actor: { employeeId: string | null; manage: boolean },
  task: { assigneeId: string | null },
) {
  return actor.manage || (!!actor.employeeId && task.assigneeId === actor.employeeId);
}
