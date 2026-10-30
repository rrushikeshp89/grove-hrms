import { addDays, isoFromDbDate, type ISODate } from "@/lib/tz";

/**
 * What the nightly job tells people, worked out from plain rows so it can be
 * tested without a database. Each function returns at most one notification per
 * person per topic, so a long backlog is one nudge, not a flood.
 */
export type ReminderDraft = {
  employeeId: string;
  kind: "REMINDER";
  title: string;
  body: string;
  href: string;
};

export const WAITING_HOURS = 48;
/** How far ahead a review deadline starts to be mentioned. */
export const REVIEW_WINDOW_DAYS = 2;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "today", "tomorrow", "in 2 days", "yesterday", "3 days ago"; null when it is further off than the window. */
export function dueWhen(due: ISODate, today: ISODate, windowDays = REVIEW_WINDOW_DAYS) {
  if (due === today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  if (due === addDays(today, -1)) return "yesterday";
  if (due > today) {
    for (let n = 2; n <= windowDays; n++) if (due === addDays(today, n)) return `in ${n} days`;
    return null;
  }
  for (let n = 2; n <= 60; n++) if (due === addDays(today, -n)) return `${n} days ago`;
  return "a while ago";
}

export function approvalReminders(
  waiting: { approverId: string; since: Date }[],
  now: Date,
): ReminderDraft[] {
  const cutoff = now.getTime() - WAITING_HOURS * 3_600_000;
  const byApprover = new Map<string, number>();
  for (const w of waiting) {
    if (w.since.getTime() <= cutoff) {
      byApprover.set(w.approverId, (byApprover.get(w.approverId) ?? 0) + 1);
    }
  }
  return [...byApprover].map(([employeeId, n]) => ({
    employeeId,
    kind: "REMINDER",
    title: `${plural(n, "request has", "requests have")} waited two days for you`,
    body: "Leave and attendance corrections are held up until you decide.",
    href: "/approvals",
  }));
}

export function taskReminders(
  tasks: { assigneeId: string; dueDate: Date }[],
  today: ISODate,
): ReminderDraft[] {
  const byAssignee = new Map<string, { due: number; overdue: number }>();
  for (const t of tasks) {
    const due = isoFromDbDate(t.dueDate);
    if (due > today) continue;
    const row = byAssignee.get(t.assigneeId) ?? { due: 0, overdue: 0 };
    if (due === today) row.due++;
    else row.overdue++;
    byAssignee.set(t.assigneeId, row);
  }
  return [...byAssignee].map(([employeeId, { due, overdue }]) => {
    const total = due + overdue;
    return {
      employeeId,
      kind: "REMINDER",
      title: `${plural(total, "checklist task needs", "checklist tasks need")} you`,
      body:
        overdue > 0
          ? `${overdue} overdue${due > 0 ? `, ${due} due today` : ""}.`
          : `${due} due today.`,
      href: "/lifecycle",
    };
  });
}

type ReviewRow = {
  reviewerId: string;
  cycleName: string;
  step: "SELF_REVIEW" | "MANAGER_REVIEW";
  due: Date;
};

export function reviewReminders(reviews: ReviewRow[], today: ISODate): ReminderDraft[] {
  const grouped = new Map<
    string,
    { cycleName: string; step: ReviewRow["step"]; when: string; n: number }
  >();
  for (const r of reviews) {
    const when = dueWhen(isoFromDbDate(r.due), today);
    if (!when) continue;
    const key = `${r.reviewerId}|${r.cycleName}|${r.step}`;
    const row = grouped.get(key);
    if (row) row.n++;
    else grouped.set(key, { cycleName: r.cycleName, step: r.step, when, n: 1 });
  }
  return [...grouped].map(([key, g]) => {
    const overdue = g.when.includes("ago") || g.when === "yesterday" || g.when === "a while ago";
    const mine = g.step === "SELF_REVIEW";
    return {
      employeeId: key.split("|")[0]!,
      kind: "REMINDER",
      title: mine
        ? `Your ${g.cycleName} self review ${overdue ? "was due" : "is due"} ${g.when}`
        : `${plural(g.n, "manager review", "manager reviews")} ${
            overdue ? (g.n === 1 ? "was due" : "were due") : g.n === 1 ? "is due" : "are due"
          } ${g.when}`,
      body: mine
        ? "It takes about half an hour, and you can save a draft."
        : `For ${g.cycleName}. Your reports see their results when the cycle closes.`,
      href: "/performance?view=reviews",
    };
  });
}
