import "server-only";

import { db } from "@/lib/db";
import { todayIn } from "@/lib/tz";

import {
  approvalReminders,
  reviewReminders,
  taskReminders,
  type ReminderDraft,
} from "./logic/reminders";
import { notify } from "./notify";

/** A reminder about the same page is sent at most once in this long. */
const QUIET_HOURS = 20;

/**
 * The nightly job: nudges people about approvals that have waited, checklist
 * tasks that are due, and review deadlines. Safe to run twice; anyone who
 * already got a reminder for the same page in the last day is skipped.
 */
export async function sendReminders(now: Date = new Date()) {
  const today = todayIn(undefined, now);

  const [steps, tasks, reviews] = await Promise.all([
    db.approvalStep.findMany({
      where: { status: "WAITING", request: { status: "PENDING" } },
      select: { approverId: true, createdAt: true },
    }),
    db.checklistTask.findMany({
      where: { completedAt: null, assigneeId: { not: null }, checklist: { completedAt: null } },
      select: { assigneeId: true, dueDate: true },
    }),
    db.review.findMany({
      where: {
        status: { not: "SUBMITTED" },
        OR: [
          { kind: "SELF", cycle: { status: "SELF_REVIEW", selfReviewDue: { not: null } } },
          { kind: "MANAGER", cycle: { status: "MANAGER_REVIEW", managerReviewDue: { not: null } } },
        ],
      },
      select: {
        reviewerId: true,
        kind: true,
        cycle: { select: { name: true, selfReviewDue: true, managerReviewDue: true } },
      },
    }),
  ]);

  const drafts: ReminderDraft[] = [
    ...approvalReminders(
      steps.map((s) => ({ approverId: s.approverId, since: s.createdAt })),
      now,
    ),
    ...taskReminders(
      tasks.map((t) => ({ assigneeId: t.assigneeId!, dueDate: t.dueDate })),
      today,
    ),
    ...reviewReminders(
      reviews.flatMap((r) => {
        const due = r.kind === "SELF" ? r.cycle.selfReviewDue : r.cycle.managerReviewDue;
        return due
          ? [
              {
                reviewerId: r.reviewerId,
                cycleName: r.cycle.name,
                step: r.kind === "SELF" ? ("SELF_REVIEW" as const) : ("MANAGER_REVIEW" as const),
                due,
              },
            ]
          : [];
      }),
      today,
    ),
  ];

  // Skip anyone who already heard about the same page recently.
  const recent = drafts.length
    ? await db.notification.findMany({
        where: {
          kind: "REMINDER",
          createdAt: { gte: new Date(now.getTime() - QUIET_HOURS * 3_600_000) },
          recipient: { employeeId: { in: [...new Set(drafts.map((d) => d.employeeId))] } },
        },
        select: { href: true, recipient: { select: { employeeId: true } } },
      })
    : [];
  const heard = new Set(recent.map((n) => `${n.recipient.employeeId}|${n.href}`));
  const fresh = drafts.filter((d) => !heard.has(`${d.employeeId}|${d.href}`));

  const sent = await notify(db, fresh);
  return { checked: drafts.length, sent, skipped: drafts.length - fresh.length };
}
