import "server-only";

import { notifyChecklistTasks } from "@/features/notifications/broadcasts";
import { hrApproverId } from "@/features/time/calendar";
import type { Prisma } from "@/generated/prisma/client";
import type { ISODate } from "@/lib/tz";

import { planTasks, type Assignee } from "./logic/checklist";

/**
 * The people behind each assignee role for one person's checklist. IT is
 * whoever holds the IT Administrator title, falling back to the head of
 * Finance & Operations; HR is the person starting it if they're on the
 * people team, otherwise the most senior HR manager.
 */
async function assigneesFor(
  tx: Prisma.TransactionClient,
  employeeId: string,
  managerId: string | null,
  hrId: string | null,
): Promise<Record<Assignee, string | null>> {
  const it =
    (
      await tx.employee.findFirst({
        where: { designation: { title: "IT Administrator" }, status: { not: "EXITED" } },
        orderBy: { joinDate: "asc" },
        select: { id: true },
      })
    )?.id ??
    (await tx.department.findFirst({ where: { code: "FIN" }, select: { headId: true } }))?.headId ??
    null;
  return {
    HR: hrId ?? (await hrApproverId(tx)),
    IT: it,
    MANAGER: managerId,
    EMPLOYEE: employeeId,
  };
}

/**
 * Starts onboarding or offboarding for someone from the current template.
 * Returns the existing checklist if one is already running, so a retried
 * action never doubles up.
 */
export async function startChecklist(
  tx: Prisma.TransactionClient,
  opts: {
    employeeId: string;
    kind: "ONBOARDING" | "OFFBOARDING";
    startDate: ISODate;
    /** The person starting it, when they belong to the people team. */
    hrId: string | null;
  },
): Promise<string | null> {
  const running = await tx.checklist.findFirst({
    where: { employeeId: opts.employeeId, kind: opts.kind, completedAt: null },
    select: { id: true },
  });
  if (running) return running.id;

  const template = await tx.checklistTemplate.findFirst({
    where: { kind: opts.kind },
    orderBy: { createdAt: "asc" },
    include: { tasks: true },
  });
  if (!template) return null;
  const employee = await tx.employee.findUniqueOrThrow({
    where: { id: opts.employeeId },
    select: { managerId: true },
  });
  const people = await assigneesFor(tx, opts.employeeId, employee.managerId, opts.hrId);
  const tasks = planTasks(template.tasks, opts.startDate, people);

  const checklist = await tx.checklist.create({
    data: {
      employeeId: opts.employeeId,
      templateId: template.id,
      kind: opts.kind,
      startDate: new Date(`${opts.startDate}T00:00:00.000Z`),
      tasks: {
        create: tasks.map((t) => ({ ...t, dueDate: new Date(`${t.dueDate}T00:00:00.000Z`) })),
      },
    },
  });
  await notifyChecklistTasks(tx, checklist.id);
  return checklist.id;
}
