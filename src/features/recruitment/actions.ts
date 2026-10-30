"use server";

import { revalidatePath } from "next/cache";

import { startChecklist } from "@/features/lifecycle/start";
import { insertEmployee } from "@/features/people/create";
import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/rbac";
import { addDays, todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import type { CurrentUser } from "@/server/session";
import { actorOf } from "@/server/session";

import {
  averageRating,
  docFromText,
  moveProblem,
  orderBetween,
  restoreStage,
  type Stage,
} from "./logic/pipeline";
import { mayRecruit } from "./queries";
import {
  candidateSchema,
  convertSchema,
  jobSchema,
  moveSchema,
  noteSchema,
  rejectSchema,
  restoreSchema,
} from "./schemas";

function refresh(jobId: string, candidateId?: string) {
  revalidatePath("/hiring");
  revalidatePath(`/hiring/${jobId}`);
  if (candidateId) revalidatePath(`/hiring/candidates/${candidateId}`);
}

/** Loads a candidate with their job, and checks this person may move them. */
async function candidateFor(tx: Prisma.TransactionClient, user: CurrentUser, candidateId: string) {
  const c = await tx.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      stage: true,
      jobId: true,
      job: {
        select: {
          id: true,
          title: true,
          status: true,
          openings: true,
          departmentId: true,
          locationId: true,
          employmentType: true,
          hiringManagerId: true,
        },
      },
    },
  });
  if (!c) throw new ActionError("That candidate no longer exists.");
  if (!mayRecruit(user, c.job)) {
    throw new ActionError("Only recruiters and this role's hiring manager can do that.");
  }
  return c;
}

/* ─── Jobs ─────────────────────────────────────────────────────────────── */

export const saveJob = createAction({
  schema: jobSchema,
  permission: "recruitment.manage",
  handler: async ({ input, tx, audit }) => {
    const { id, description, ...fields } = input;
    const before = id ? await tx.jobPosting.findUnique({ where: { id } }) : null;
    if (id && !before) throw new ActionError("That role no longer exists.");
    const now = new Date();
    const data = {
      ...fields,
      description: docFromText(description),
      // A role starts its clock the first time it opens, and stops when it closes.
      openedAt: input.status === "OPEN" ? (before?.openedAt ?? now) : (before?.openedAt ?? null),
      closedAt: input.status === "CLOSED" ? (before?.closedAt ?? now) : null,
    };
    const job = before
      ? await tx.jobPosting.update({ where: { id: before.id }, data })
      : await tx.jobPosting.create({ data });
    audit({
      action: before ? "job.update" : "job.create",
      entityType: "JobPosting",
      entityId: job.id,
      before: before
        ? { title: before.title, status: before.status, openings: before.openings }
        : undefined,
      after: { title: job.title, status: job.status, openings: job.openings },
    });
    refresh(job.id);
    return { id: job.id };
  },
});

/* ─── Candidates ───────────────────────────────────────────────────────── */

export const addCandidate = createAction({
  schema: candidateSchema,
  permission: "recruitment.read",
  handler: async ({ input, user, tx, audit }) => {
    const job = await tx.jobPosting.findUnique({
      where: { id: input.jobId },
      select: { id: true, status: true, hiringManagerId: true },
    });
    if (!job) throw new ActionError("That role no longer exists.");
    if (!mayRecruit(user, job)) {
      throw new ActionError("Only recruiters and this role's hiring manager can add candidates.");
    }
    if (job.status === "CLOSED") throw new ActionError("This role is closed to new candidates.");
    const duplicate = await tx.candidate.findFirst({
      where: { jobId: job.id, email: input.email },
      select: { id: true },
    });
    if (duplicate) {
      throw new ActionError("They've already applied for this role.", {
        email: ["Already in this pipeline"],
      });
    }
    const top = await tx.candidate.findFirst({
      where: { jobId: job.id, stage: "APPLIED" },
      orderBy: { stageOrder: "asc" },
      select: { stageOrder: true },
    });
    const candidate = await tx.candidate.create({
      data: {
        jobId: job.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: input.source,
        stage: "APPLIED",
        stageOrder: orderBetween(null, top?.stageOrder ?? null),
        stageHistory: { create: { to: "APPLIED", byId: user.employee?.id ?? null } },
      },
    });
    audit({
      action: "candidate.create",
      entityType: "Candidate",
      entityId: candidate.id,
      after: { name: `${input.firstName} ${input.lastName}`, jobId: job.id, source: input.source },
    });
    refresh(job.id, candidate.id);
    return { id: candidate.id };
  },
});

/** Moves a candidate to a stage and position on the board. */
export const moveCandidate = createAction({
  schema: moveSchema,
  permission: "recruitment.read",
  handler: async ({ input, user, tx, audit }) => {
    const c = await candidateFor(tx, user, input.candidateId);
    const problem = moveProblem(c.stage as Stage, input.stage);
    if (problem) throw new ActionError(problem);
    const neighbours = await tx.candidate.findMany({
      where: {
        id: { in: [input.aboveId, input.belowId].filter((x): x is string => !!x) },
        jobId: c.jobId,
      },
      select: { id: true, stageOrder: true },
    });
    const orderOf = (id: string | null) => neighbours.find((n) => n.id === id)?.stageOrder ?? null;
    const stageOrder = orderBetween(orderOf(input.aboveId), orderOf(input.belowId));
    await tx.candidate.update({ where: { id: c.id }, data: { stage: input.stage, stageOrder } });
    if (c.stage !== input.stage) {
      await tx.candidateStageEvent.create({
        data: {
          candidateId: c.id,
          from: c.stage,
          to: input.stage,
          byId: user.employee?.id ?? null,
        },
      });
      audit({
        action: "candidate.move",
        entityType: "Candidate",
        entityId: c.id,
        before: { stage: c.stage },
        after: { stage: input.stage },
      });
    }
    refresh(c.jobId, c.id);
    return { stage: input.stage, stageOrder };
  },
});

export const rejectCandidate = createAction({
  schema: rejectSchema,
  permission: "recruitment.read",
  handler: async ({ input, user, tx, audit }) => {
    const c = await candidateFor(tx, user, input.candidateId);
    if (c.stage === "HIRED") throw new ActionError("They've already been hired.");
    if (c.stage === "REJECTED") return { stage: "REJECTED" as const };
    const me = user.employee?.id;
    await tx.candidate.update({ where: { id: c.id }, data: { stage: "REJECTED" } });
    await tx.candidateStageEvent.create({
      data: { candidateId: c.id, from: c.stage, to: "REJECTED", byId: me ?? null },
    });
    if (me) {
      await tx.candidateNote.create({
        data: { candidateId: c.id, authorId: me, body: `Not moving forward: ${input.reason}` },
      });
    }
    audit({
      action: "candidate.reject",
      entityType: "Candidate",
      entityId: c.id,
      before: { stage: c.stage },
      after: { stage: "REJECTED", reason: input.reason },
    });
    refresh(c.jobId, c.id);
    return { stage: "REJECTED" as const };
  },
});

export const restoreCandidate = createAction({
  schema: restoreSchema,
  permission: "recruitment.read",
  handler: async ({ input, user, tx, audit }) => {
    const c = await candidateFor(tx, user, input.candidateId);
    if (c.stage !== "REJECTED") return { stage: c.stage };
    const path = await tx.candidateStageEvent.findMany({
      where: { candidateId: c.id },
      select: { to: true },
    });
    const stage = restoreStage(path.map((p) => p.to as Stage));
    const top = await tx.candidate.findFirst({
      where: { jobId: c.jobId, stage },
      orderBy: { stageOrder: "asc" },
      select: { stageOrder: true },
    });
    await tx.candidate.update({
      where: { id: c.id },
      data: { stage, stageOrder: orderBetween(null, top?.stageOrder ?? null) },
    });
    await tx.candidateStageEvent.create({
      data: { candidateId: c.id, from: "REJECTED", to: stage, byId: user.employee?.id ?? null },
    });
    audit({
      action: "candidate.restore",
      entityType: "Candidate",
      entityId: c.id,
      before: { stage: "REJECTED" },
      after: { stage },
    });
    refresh(c.jobId, c.id);
    return { stage };
  },
});

/** Interviewers and recruiters leave notes; a rating updates the average. */
export const addNote = createAction({
  schema: noteSchema,
  permission: "recruitment.read",
  handler: async ({ input, user, tx }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Notes need an employee record behind them.");
    const c = await tx.candidate.findUnique({
      where: { id: input.candidateId },
      select: { id: true, jobId: true },
    });
    if (!c) throw new ActionError("That candidate no longer exists.");
    const note = await tx.candidateNote.create({
      data: { candidateId: c.id, authorId: me, body: input.body, rating: input.rating },
    });
    const ratings = await tx.candidateNote.findMany({
      where: { candidateId: c.id },
      select: { rating: true },
    });
    const rating = averageRating(ratings.map((r) => r.rating));
    await tx.candidate.update({ where: { id: c.id }, data: { rating } });
    refresh(c.jobId, c.id);
    return { id: note.id, rating };
  },
});

/* ─── Hiring ───────────────────────────────────────────────────────────── */

/**
 * Turns an accepted offer into an employee: creates their record, marks
 * the candidate hired, closes the role once every opening is filled, and
 * starts onboarding from the template.
 */
export const convertToEmployee = createAction({
  schema: convertSchema,
  permission: "employee.create",
  handler: async ({ input, user, tx, audit }) => {
    const c = await candidateFor(tx, user, input.candidateId);
    if (c.stage === "HIRED") throw new ActionError("They've already been hired.");
    if (c.stage !== "OFFER") throw new ActionError("Make them an offer first, then convert.");
    const today = todayIn();
    if (input.joinDate < addDays(today, -30)) {
      throw new ActionError("That start date is too far in the past.", {
        joinDate: ["Pick a date within the last 30 days or later"],
      });
    }

    // Their title comes from the role; reuse the department's designation if it exists.
    const designation =
      (await tx.designation.findFirst({
        where: { title: c.job.title, departmentId: c.job.departmentId },
        select: { id: true },
      })) ??
      (await tx.designation.create({
        data: { title: c.job.title, level: 2, departmentId: c.job.departmentId },
        select: { id: true },
      }));

    const employee = await insertEmployee(tx, {
      firstName: c.firstName,
      lastName: c.lastName,
      workEmail: input.workEmail,
      personalEmail: c.email,
      phone: c.phone,
      designationId: designation.id,
      departmentId: c.job.departmentId,
      locationId: c.job.locationId,
      managerId: input.managerId,
      employmentType: c.job.employmentType,
      joinDate: input.joinDate,
    });

    await tx.candidate.update({
      where: { id: c.id },
      data: { stage: "HIRED", hiredEmployeeId: employee.id },
    });
    await tx.candidateStageEvent.create({
      data: { candidateId: c.id, from: c.stage, to: "HIRED", byId: user.employee?.id ?? null },
    });

    const hired = await tx.candidate.count({ where: { jobId: c.jobId, stage: "HIRED" } });
    const filled = hired >= c.job.openings;
    if (filled && c.job.status !== "CLOSED") {
      await tx.jobPosting.update({
        where: { id: c.jobId },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }

    const checklistId = await startChecklist(tx, {
      employeeId: employee.id,
      kind: "ONBOARDING",
      startDate: input.joinDate,
      hrId: can(actorOf(user), "lifecycle.manage") ? (user.employee?.id ?? null) : null,
    });

    audit({
      action: "candidate.hire",
      entityType: "Candidate",
      entityId: c.id,
      before: { stage: c.stage },
      after: { stage: "HIRED", employeeId: employee.id, employeeCode: employee.employeeCode },
    });
    audit({
      action: "employee.create",
      entityType: "Employee",
      entityId: employee.id,
      after: {
        employeeCode: employee.employeeCode,
        name: `${c.firstName} ${c.lastName}`,
        joinDate: input.joinDate,
        fromCandidate: c.id,
      },
    });
    refresh(c.jobId, c.id);
    revalidatePath("/people");
    revalidatePath("/org");
    revalidatePath("/lifecycle");
    return { employeeId: employee.id, checklistId, roleClosed: filled };
  },
});
