"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { notifyCycleStep, notifyFeedbackRequested } from "@/features/notifications/broadcasts";
import { can } from "@/lib/rbac";
import { dbDate } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { managerChain } from "@/server/authz";
import { actorOf, type CurrentUser } from "@/server/session";

import {
  canWriteReview,
  goalProgress,
  nextCycleStatus,
  reviewProblems,
  type CycleStatus,
  type ReviewKind,
} from "./logic/goals";
import {
  checkInSchema,
  cycleIdSchema,
  cycleSchema,
  declineFeedbackSchema,
  deleteGoalSchema,
  goalSchema,
  requestFeedbackSchema,
  saveReviewSchema,
} from "./schemas";

const refreshGoals = (id?: string) => {
  revalidatePath("/performance");
  if (id) revalidatePath(`/performance/goals/${id}`);
  revalidatePath("/home");
};

/* ─── Goals ────────────────────────────────────────────────────────────── */

/** Which review cycle a goal belongs to: the one whose period contains its due date. */
async function cycleFor(tx: Prisma.TransactionClient, due: string) {
  const c = await tx.reviewCycle.findFirst({
    where: { periodStart: { lte: dbDate(due) }, periodEnd: { gte: dbDate(due) } },
    select: { id: true },
  });
  return c?.id ?? null;
}

function assertOwnsGoal(user: CurrentUser, goal: { ownerId: string | null }) {
  if (goal.ownerId === null) {
    if (!can(actorOf(user), "performance.manageCycles")) {
      throw new ActionError("Only the people team changes company goals.");
    }
    return;
  }
  if (goal.ownerId !== user.employee?.id)
    throw new ActionError("That goal belongs to someone else.");
}

export const saveGoal = createAction({
  schema: goalSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Goals need an employee record behind them.");
    if (input.company && !can(actorOf(user), "performance.manageCycles")) {
      throw new ActionError("Only the people team sets company goals.");
    }
    const existing = input.id ? await tx.goal.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new ActionError("That goal no longer exists.");
    if (existing) assertOwnsGoal(user, existing);
    if (input.parentId) {
      const parent = await tx.goal.findUnique({
        where: { id: input.parentId },
        select: { id: true },
      });
      if (!parent) throw new ActionError("The goal you're aligning to no longer exists.");
      if (input.parentId === input.id) throw new ActionError("A goal can't support itself.");
    }
    const krs = input.keyResults;
    const progress = goalProgress(krs) ?? existing?.progress ?? 0;
    const data = {
      title: input.title,
      description: input.description,
      dueDate: dbDate(input.dueDate),
      parentId: input.parentId,
      cycleId: await cycleFor(tx, input.dueDate),
      ownerId: input.company ? null : (existing?.ownerId ?? me),
      progress,
      status: progress >= 100 ? ("DONE" as const) : (existing?.status ?? ("ON_TRACK" as const)),
    };
    const goal = existing
      ? await tx.goal.update({ where: { id: existing.id }, data })
      : await tx.goal.create({ data });

    // Key results are replaced as a set; ones kept by id keep their history.
    const keep = krs.flatMap((k) => (k.id ? [k.id] : []));
    await tx.keyResult.deleteMany({ where: { goalId: goal.id, id: { notIn: keep } } });
    for (const k of krs) {
      const fields = {
        title: k.title,
        startValue: k.startValue,
        targetValue: k.targetValue,
        currentValue: k.currentValue,
        unit: k.unit,
      };
      if (k.id) await tx.keyResult.update({ where: { id: k.id }, data: fields });
      else await tx.keyResult.create({ data: { ...fields, goalId: goal.id } });
    }
    audit({
      action: existing ? "goal.update" : "goal.create",
      entityType: "Goal",
      entityId: goal.id,
      after: { title: goal.title, keyResults: krs.length },
    });
    refreshGoals(goal.id);
    return { id: goal.id };
  },
});

export const checkIn = createAction({
  schema: checkInSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Check-ins need an employee record behind them.");
    const goal = await tx.goal.findUnique({
      where: { id: input.goalId },
      select: { id: true, ownerId: true, title: true, keyResults: true },
    });
    if (!goal) throw new ActionError("That goal no longer exists.");
    assertOwnsGoal(user, goal);

    for (const v of input.values) {
      if (!goal.keyResults.some((k) => k.id === v.id))
        throw new ActionError("That key result no longer exists.");
      await tx.keyResult.update({ where: { id: v.id }, data: { currentValue: v.currentValue } });
    }
    const updated = goal.keyResults.map((k) => ({
      ...k,
      currentValue: input.values.find((v) => v.id === k.id)?.currentValue ?? k.currentValue,
    }));
    const progress = goalProgress(updated) ?? input.progress;
    if (progress == null)
      throw new ActionError("Enter how far along it is.", { progress: ["Enter 0 to 100"] });
    const status = progress >= 100 ? "DONE" : input.status === "DONE" ? "ON_TRACK" : input.status;
    await tx.goal.update({ where: { id: goal.id }, data: { progress, status } });
    await tx.goalCheckIn.create({
      data: { goalId: goal.id, authorId: me, progress, note: input.note },
    });
    audit({
      action: "goal.checkin",
      entityType: "Goal",
      entityId: goal.id,
      after: { progress, status },
    });
    refreshGoals(goal.id);
    return { progress, status };
  },
});

export const deleteGoal = createAction({
  schema: deleteGoalSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx, audit }) => {
    const goal = await tx.goal.findUnique({
      where: { id: input.goalId },
      select: { id: true, ownerId: true, title: true },
    });
    if (!goal) return { deleted: false };
    assertOwnsGoal(user, goal);
    await tx.goal.delete({ where: { id: goal.id } });
    audit({
      action: "goal.delete",
      entityType: "Goal",
      entityId: goal.id,
      before: { title: goal.title },
    });
    refreshGoals();
    return { deleted: true };
  },
});

/* ─── Review cycles ────────────────────────────────────────────────────── */

export const saveCycle = createAction({
  schema: cycleSchema,
  permission: "performance.manageCycles",
  handler: async ({ input, tx, audit }) => {
    const taken = await tx.reviewCycle.findUnique({ where: { name: input.name } });
    if (taken)
      throw new ActionError("A cycle with that name exists.", { name: ["Choose another name"] });
    const cycle = await tx.reviewCycle.create({
      data: {
        name: input.name,
        periodStart: dbDate(input.periodStart),
        periodEnd: dbDate(input.periodEnd),
        selfReviewDue: dbDate(input.selfReviewDue),
        managerReviewDue: dbDate(input.managerReviewDue),
      },
    });
    audit({
      action: "cycle.create",
      entityType: "ReviewCycle",
      entityId: cycle.id,
      after: { name: cycle.name },
    });
    revalidatePath("/performance/cycles");
    return { id: cycle.id };
  },
});

/**
 * Moves a cycle to its next step. Starting a cycle creates everyone's self
 * review and, for people with a manager, that manager's review of them.
 */
export const advanceCycle = createAction({
  schema: cycleIdSchema,
  permission: "performance.manageCycles",
  handler: async ({ input, user, tx, audit }) => {
    const cycle = await tx.reviewCycle.findUnique({ where: { id: input.cycleId } });
    if (!cycle) throw new ActionError("That cycle no longer exists.");
    const next = nextCycleStatus(cycle.status as CycleStatus);
    if (!next) throw new ActionError("This cycle is already closed.");
    if (cycle.status === "DRAFT") {
      const running = await tx.reviewCycle.findFirst({
        where: { status: { in: ["SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATION"] } },
        select: { name: true },
      });
      if (running)
        throw new ActionError(
          `${running.name} is still running. Close it before starting another.`,
        );
      const people = await tx.employee.findMany({
        where: { status: { not: "EXITED" }, joinDate: { lte: cycle.periodEnd } },
        select: { id: true, managerId: true },
      });
      await tx.review.createMany({
        data: people.flatMap((p) => [
          { cycleId: cycle.id, revieweeId: p.id, reviewerId: p.id, kind: "SELF" as const },
          ...(p.managerId
            ? [
                {
                  cycleId: cycle.id,
                  revieweeId: p.id,
                  reviewerId: p.managerId,
                  kind: "MANAGER" as const,
                },
              ]
            : []),
        ]),
        skipDuplicates: true,
      });
    }
    if (next === "CALIBRATION") {
      const submitted = await tx.review.count({
        where: { cycleId: cycle.id, kind: "MANAGER", status: "SUBMITTED" },
      });
      if (submitted === 0) throw new ActionError("No manager reviews have been submitted yet.");
    }
    await tx.reviewCycle.update({ where: { id: cycle.id }, data: { status: next } });
    await notifyCycleStep(tx, cycle.id, next, user.id);
    audit({
      action: "cycle.advance",
      entityType: "ReviewCycle",
      entityId: cycle.id,
      before: { status: cycle.status },
      after: { status: next },
    });
    revalidatePath("/performance", "layout");
    return { status: next };
  },
});

/* ─── Reviews ──────────────────────────────────────────────────────────── */

export const saveReview = createAction({
  schema: saveReviewSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx, audit }) => {
    const review = await tx.review.findUnique({
      where: { id: input.reviewId },
      select: {
        id: true,
        kind: true,
        status: true,
        reviewerId: true,
        revieweeId: true,
        cycle: { select: { status: true } },
        feedback: { select: { id: true } },
      },
    });
    if (!review) throw new ActionError("That review no longer exists.");
    if (review.reviewerId !== user.employee?.id)
      throw new ActionError("This review is someone else's to write.");
    if (review.status === "SUBMITTED")
      throw new ActionError("This review has already been submitted.");
    const kind = review.kind as ReviewKind;
    if (!canWriteReview(kind, review.cycle.status as CycleStatus)) {
      throw new ActionError("This review isn't open for writing right now.");
    }
    const problems = input.submit ? reviewProblems(kind, input.answers, input.rating) : [];
    if (problems.length) {
      throw new ActionError(
        "A few things are still missing.",
        Object.fromEntries(
          problems.map((p) => [
            p === "rating" ? "rating" : `answers.${p}`,
            [p === "rating" ? "Choose a rating" : "Write a little more (at least a sentence)"],
          ]),
        ),
      );
    }
    await tx.review.update({
      where: { id: review.id },
      data: {
        answers: input.answers,
        overallRating: input.rating,
        status: input.submit ? "SUBMITTED" : "IN_PROGRESS",
        submittedAt: input.submit ? new Date() : null,
      },
    });
    if (input.submit && review.feedback) {
      await tx.feedbackRequest.update({
        where: { id: review.feedback.id },
        data: { status: "SUBMITTED" },
      });
    }
    audit({
      action: input.submit ? "review.submit" : "review.save",
      entityType: "Review",
      entityId: review.id,
      after: { kind, rating: input.rating },
    });
    revalidatePath("/performance", "layout");
    return { submitted: input.submit };
  },
});

/** A manager or HR asks colleagues for peer feedback; each gets a short review to write. */
export const requestFeedback = createAction({
  schema: requestFeedbackSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id;
    const cycle = await tx.reviewCycle.findUnique({
      where: { id: input.cycleId },
      select: { id: true, status: true },
    });
    if (!cycle) throw new ActionError("That cycle no longer exists.");
    if (!canWriteReview("PEER", cycle.status as CycleStatus)) {
      throw new ActionError(
        "Feedback can only be requested while self and manager reviews are open.",
      );
    }
    const chain = await managerChain(input.revieweeId, tx);
    const allowed = can(actorOf(user), "performance.manageCycles") || (!!me && chain.includes(me));
    if (!allowed)
      throw new ActionError(
        "Only their manager or the people team can ask for feedback about someone.",
      );
    const from = [...new Set(input.fromIds)].filter((id) => id !== input.revieweeId);
    if (from.length === 0)
      throw new ActionError("Pick someone other than the person being reviewed.");
    let created = 0;
    for (const reviewerId of from) {
      const exists = await tx.review.findFirst({
        where: { cycleId: cycle.id, revieweeId: input.revieweeId, reviewerId, kind: "PEER" },
        select: { id: true },
      });
      if (exists) continue;
      const review = await tx.review.create({
        data: { cycleId: cycle.id, revieweeId: input.revieweeId, reviewerId, kind: "PEER" },
      });
      await tx.feedbackRequest.create({
        data: {
          cycleId: cycle.id,
          revieweeId: input.revieweeId,
          requestedFromId: reviewerId,
          reviewId: review.id,
        },
      });
      created++;
    }
    if (created === 0) throw new ActionError("They've all been asked already.");
    await notifyFeedbackRequested(tx, {
      revieweeId: input.revieweeId,
      fromIds: from,
      actorUserId: user.id,
    });
    audit({
      action: "feedback.request",
      entityType: "ReviewCycle",
      entityId: cycle.id,
      after: { revieweeId: input.revieweeId, asked: created },
    });
    revalidatePath("/performance", "layout");
    return { asked: created };
  },
});

export const declineFeedback = createAction({
  schema: declineFeedbackSchema,
  permission: "performance.read",
  handler: async ({ input, user, tx }) => {
    const review = await tx.review.findUnique({
      where: { id: input.reviewId },
      select: {
        id: true,
        kind: true,
        reviewerId: true,
        status: true,
        feedback: { select: { id: true } },
      },
    });
    if (!review || review.kind !== "PEER" || review.reviewerId !== user.employee?.id) {
      throw new ActionError("That request isn't yours to decline.");
    }
    if (review.status === "SUBMITTED") throw new ActionError("You've already sent this feedback.");
    if (review.feedback)
      await tx.feedbackRequest.update({
        where: { id: review.feedback.id },
        data: { status: "DECLINED" },
      });
    revalidatePath("/performance", "layout");
    return { declined: true };
  },
});
