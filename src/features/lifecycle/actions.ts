"use server";

import { revalidatePath } from "next/cache";

import { can } from "@/lib/rbac";
import { addDays, dbDate, isoFromDbDate, todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { actorOf } from "@/server/session";

import { canTick } from "./logic/checklist";
import { startOffboardingSchema, templateSchema, toggleTaskSchema } from "./schemas";
import { startChecklist } from "./start";

function refresh(checklistId?: string) {
  revalidatePath("/lifecycle");
  if (checklistId) revalidatePath(`/lifecycle/${checklistId}`);
  revalidatePath("/home");
}

/**
 * Ticks or unticks a task. When the last task is done the checklist
 * completes: a finished onboarding makes the person active (once they've
 * started), and a finished offboarding after their last day marks them as
 * having left.
 */
export const toggleTask = createAction({
  schema: toggleTaskSchema,
  handler: async ({ input, user, tx, audit }) => {
    const task = await tx.checklistTask.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        completedAt: true,
        checklist: {
          select: {
            id: true,
            kind: true,
            employee: { select: { id: true, status: true, joinDate: true, exitDate: true } },
          },
        },
      },
    });
    if (!task) throw new ActionError("That task no longer exists.");
    const actor = {
      employeeId: user.employee?.id ?? null,
      manage: can(actorOf(user), "lifecycle.manage"),
    };
    if (!canTick(actor, task)) {
      throw new ActionError("This task belongs to someone else. Ask them or the people team.");
    }
    if (!!task.completedAt === input.done) return { complete: false, changed: false };

    await tx.checklistTask.update({
      where: { id: task.id },
      data: input.done
        ? { completedAt: new Date(), completedById: actor.employeeId }
        : { completedAt: null, completedById: null },
    });
    const open = await tx.checklistTask.count({
      where: { checklistId: task.checklist.id, completedAt: null },
    });
    const complete = open === 0;
    await tx.checklist.update({
      where: { id: task.checklist.id },
      data: { completedAt: complete ? new Date() : null },
    });

    const today = todayIn();
    const person = task.checklist.employee;
    if (complete && task.checklist.kind === "ONBOARDING" && person.status === "ONBOARDING") {
      if (isoFromDbDate(person.joinDate) <= today)
        await tx.employee.update({ where: { id: person.id }, data: { status: "ACTIVE" } });
    }
    if (
      complete &&
      task.checklist.kind === "OFFBOARDING" &&
      person.exitDate &&
      isoFromDbDate(person.exitDate) < today
    ) {
      await tx.employee.update({ where: { id: person.id }, data: { status: "EXITED" } });
    }

    audit({
      action: input.done ? "checklist.task.complete" : "checklist.task.reopen",
      entityType: "ChecklistTask",
      entityId: task.id,
      after: { title: task.title, checklistComplete: complete },
    });
    refresh(task.checklist.id);
    return { complete, changed: true };
  },
});

export const startOffboarding = createAction({
  schema: startOffboardingSchema,
  permission: "lifecycle.manage",
  handler: async ({ input, user, tx, audit }) => {
    const person = await tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, firstName: true, lastName: true, status: true, joinDate: true },
    });
    if (!person) throw new ActionError("We couldn't find that person.");
    if (person.status === "NOTICE" || person.status === "EXITED") {
      throw new ActionError(`${person.firstName} is already leaving.`, {
        employeeId: ["Already serving notice or gone"],
      });
    }
    const today = todayIn();
    if (input.lastDay < today) {
      throw new ActionError("The last day can't be in the past.", {
        lastDay: ["Pick today or a later day"],
      });
    }
    if (input.lastDay > addDays(today, 120)) {
      throw new ActionError("Notice periods here are at most four months.", {
        lastDay: ["Pick a day within 120 days"],
      });
    }
    if (input.lastDay < isoFromDbDate(person.joinDate)) {
      throw new ActionError("The last day is before they joined.", {
        lastDay: ["Pick a day after their join date"],
      });
    }
    await tx.employee.update({
      where: { id: person.id },
      data: { status: "NOTICE", exitDate: dbDate(input.lastDay), exitReason: input.reason },
    });
    const checklistId = await startChecklist(tx, {
      employeeId: person.id,
      kind: "OFFBOARDING",
      startDate: input.lastDay,
      hrId: user.employee?.id ?? null,
    });
    audit({
      action: "employee.offboard",
      entityType: "Employee",
      entityId: person.id,
      before: { status: person.status },
      after: { status: "NOTICE", exitDate: input.lastDay, exitReason: input.reason },
    });
    refresh();
    revalidatePath("/people");
    revalidatePath(`/people/${person.id}`);
    return { checklistId };
  },
});

export const saveTemplate = createAction({
  schema: templateSchema,
  permission: "lifecycle.manage",
  handler: async ({ input, tx, audit }) => {
    const template = await tx.checklistTemplate.findUnique({
      where: { id: input.templateId },
      select: { id: true, name: true, _count: { select: { tasks: true } } },
    });
    if (!template) throw new ActionError("That template no longer exists.");
    // Running checklists keep their own copies, so replacing tasks is safe.
    await tx.checklistTemplateTask.deleteMany({ where: { templateId: template.id } });
    await tx.checklistTemplateTask.createMany({
      data: input.tasks.map((t, i) => ({ ...t, templateId: template.id, sortOrder: i })),
    });
    audit({
      action: "checklist.template.update",
      entityType: "ChecklistTemplate",
      entityId: template.id,
      before: { tasks: template._count.tasks },
      after: { tasks: input.tasks.length },
    });
    revalidatePath("/lifecycle/templates");
    return { saved: input.tasks.length };
  },
});
