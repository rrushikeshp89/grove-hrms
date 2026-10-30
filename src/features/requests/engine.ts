import "server-only";

import { evaluateDay } from "@/features/attendance/logic/evaluate";
import { approvalChain, decide, type Decision } from "@/features/leave/logic/approval";
import { workContext } from "@/features/time/calendar";
import type { Prisma } from "@/lib/db";
import { isoFromDbDate } from "@/lib/tz";
import { ActionError } from "@/server/action-error";

type Tx = Prisma.TransactionClient;

/**
 * The one place requests are created and decided, for every request type.
 * Side effects of a final decision live here too, so the inbox, bulk
 * approve and any future request type behave the same way.
 */
export async function createRequest(
  tx: Tx,
  opts: {
    type: "LEAVE" | "REGULARIZATION";
    requesterId: string;
    managerId: string | null;
    hrApproverId: string;
    levels: number;
    days?: number;
  },
) {
  const steps = approvalChain({
    requesterId: opts.requesterId,
    managerId: opts.managerId,
    hrApproverId: opts.hrApproverId,
    levels: opts.levels,
    days: opts.days,
  });
  return tx.request.create({
    data: {
      type: opts.type,
      requesterId: opts.requesterId,
      status: "PENDING",
      currentLevel: 1,
      steps: {
        create: steps.map((s) => ({ level: s.level, approverId: s.approverId, status: s.status })),
      },
    },
  });
}

export async function applyDecision(
  tx: Tx,
  opts: {
    requestId: string;
    decision: Decision;
    deciderId: string;
    comment: string | null;
    now?: Date;
  },
) {
  const now = opts.now ?? new Date();
  const request = await tx.request.findUniqueOrThrow({
    where: { id: opts.requestId },
    include: {
      steps: { orderBy: { level: "asc" } },
      leave: true,
      regularization: true,
    },
  });
  if (request.status !== "PENDING") {
    throw new ActionError("Someone already decided this request.");
  }
  const result = decide(
    request.steps.map((s) => ({ level: s.level, approverId: s.approverId, status: s.status })),
    opts.decision,
  );

  for (const s of result.steps) {
    const before = request.steps.find((x) => x.level === s.level)!;
    if (before.status === s.status) continue;
    const decided = s.level === result.decidedLevel;
    await tx.approvalStep.update({
      where: { id: before.id },
      data: {
        status: s.status,
        ...(decided ? { decidedAt: now, comment: opts.comment, approverId: opts.deciderId } : {}),
      },
    });
  }
  await tx.request.update({
    where: { id: request.id },
    data: {
      status: result.status,
      currentLevel: result.final ? result.decidedLevel : result.decidedLevel + 1,
    },
  });

  if (result.final && request.leave) {
    const days = Number(request.leave.days);
    const year = request.leave.startDate.getUTCFullYear();
    const base = {
      employeeId: request.requesterId,
      leaveTypeId: request.leave.leaveTypeId,
      year,
      requestId: request.id,
      createdById: opts.deciderId,
    };
    // The hold placed when they applied is released either way…
    await tx.leaveLedgerEntry.create({ data: { ...base, kind: "RELEASE", days } });
    // …and approved leave becomes usage.
    if (result.status === "APPROVED") {
      await tx.leaveLedgerEntry.create({ data: { ...base, kind: "USAGE", days: -days } });
    }
  }

  if (result.final && result.status === "APPROVED" && request.regularization) {
    const r = request.regularization;
    const ctx = await workContext(request.requesterId, tx);
    const existing = await tx.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: request.requesterId, date: r.date } },
    });
    const clockInAt = r.requestedClockIn ?? existing?.clockInAt ?? null;
    const clockOutAt = r.requestedClockOut ?? existing?.clockOutAt ?? null;
    const evaluated = evaluateDay({ clockInAt, clockOutAt }, ctx.schedule, ctx.tz);
    await tx.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: request.requesterId, date: r.date } },
      create: {
        employeeId: request.requesterId,
        date: r.date,
        clockInAt,
        clockOutAt,
        source: "REGULARIZED",
        ...evaluated,
      },
      update: { clockInAt, clockOutAt, source: "REGULARIZED", ...evaluated },
    });
  }

  return {
    status: result.status,
    final: result.final,
    type: request.type,
    requesterId: request.requesterId,
    summary: request.leave
      ? {
          start: isoFromDbDate(request.leave.startDate),
          end: isoFromDbDate(request.leave.endDate),
          days: Number(request.leave.days),
        }
      : request.regularization
        ? { date: isoFromDbDate(request.regularization.date) }
        : null,
  };
}
