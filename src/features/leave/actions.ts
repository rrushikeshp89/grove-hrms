"use server";

import { revalidatePath } from "next/cache";

import { createRequest } from "@/features/requests/engine";
import { hrApproverId, workCalendar, workContext } from "@/features/time/calendar";
import { dbDate, todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";

import { leaveDays } from "./logic/days";
import { validateLeave } from "./logic/validate";
import { balancesFor } from "./queries";
import { applyLeaveSchema, cancelLeaveSchema } from "./schemas";

function refresh() {
  revalidatePath("/leave");
  revalidatePath("/approvals");
  revalidatePath("/attendance");
  revalidatePath("/home");
}

export const applyLeave = createAction({
  schema: applyLeaveSchema,
  permission: "leave.apply",
  handler: async ({ input, user, tx, audit }) => {
    const employeeId = user.employee?.id;
    if (!employeeId)
      throw new ActionError(
        "Your account isn't linked to an employee record yet. Ask HR to link it.",
      );

    const ctx = await workContext(employeeId, tx);
    const today = todayIn(ctx.tz);
    const year = Number(input.start.slice(0, 4));
    const [cal, balances, overlapping] = await Promise.all([
      workCalendar(ctx, input.start, input.end, tx),
      balancesFor(employeeId, year, tx),
      tx.leaveRequest.findFirst({
        where: {
          request: { requesterId: employeeId, status: { in: ["PENDING", "APPROVED"] } },
          startDate: { lte: dbDate(input.end) },
          endDate: { gte: dbDate(input.start) },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);
    const balance = balances.find((b) => b.typeId === input.leaveTypeId);
    if (!balance)
      throw new ActionError("That leave type isn't available to you.", {
        leaveTypeId: ["Choose another type"],
      });

    const days = leaveDays(input, cal);
    const problems = validateLeave({
      type: balance,
      start: input.start,
      end: input.end,
      halfDay: !!(input.startHalf || input.endHalf),
      days,
      today,
      available: balance.summary.available,
      overlaps: overlapping
        ? {
            start: overlapping.startDate.toISOString().slice(0, 10),
            end: overlapping.endDate.toISOString().slice(0, 10),
          }
        : null,
    });
    if (problems.length) {
      const fieldErrors: Record<string, string[]> = {};
      for (const p of problems) {
        const key = p.field === "range" ? "start" : p.field;
        (fieldErrors[key] ??= []).push(p.message);
      }
      throw new ActionError(problems[0]!.message, fieldErrors);
    }

    const request = await createRequest(tx, {
      type: "LEAVE",
      requesterId: employeeId,
      managerId: ctx.managerId,
      hrApproverId: await hrApproverId(tx),
      levels: balance.approvalLevels,
      days,
    });
    await tx.leaveRequest.create({
      data: {
        requestId: request.id,
        leaveTypeId: input.leaveTypeId,
        startDate: dbDate(input.start),
        endDate: dbDate(input.end),
        startHalf: input.startHalf,
        endHalf: input.endHalf,
        days,
        reason: input.reason,
      },
    });
    // Hold the days so a second request can't spend them twice.
    await tx.leaveLedgerEntry.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        year,
        kind: "PENDING_HOLD",
        days: -days,
        requestId: request.id,
        createdById: user.id,
      },
    });
    audit({
      action: "leave.apply",
      entityType: "Request",
      entityId: request.id,
      after: { type: balance.code, start: input.start, end: input.end, days },
    });
    refresh();
    return { requestId: request.id, days };
  },
});

export const cancelLeave = createAction({
  schema: cancelLeaveSchema,
  handler: async ({ input, user, tx, audit }) => {
    const request = await tx.request.findFirst({
      where: { id: input.requestId, requesterId: user.employee?.id ?? "-" },
      include: { leave: true, steps: true },
    });
    if (!request?.leave) throw new ActionError("We couldn't find that request.");
    const ctx = await workContext(request.requesterId, tx);
    const start = request.leave.startDate.toISOString().slice(0, 10);
    if (request.status === "APPROVED" && start <= todayIn(ctx.tz)) {
      throw new ActionError("This leave has already started. Ask HR to adjust it.");
    }
    if (request.status !== "PENDING" && request.status !== "APPROVED") {
      throw new ActionError("Only pending or upcoming leave can be cancelled.");
    }
    const days = Number(request.leave.days);
    const base = {
      employeeId: request.requesterId,
      leaveTypeId: request.leave.leaveTypeId,
      year: request.leave.startDate.getUTCFullYear(),
      requestId: request.id,
      createdById: user.id,
    };
    // Pending: release the hold. Approved: reverse the usage.
    await tx.leaveLedgerEntry.create({
      data: { ...base, kind: request.status === "PENDING" ? "RELEASE" : "USAGE", days },
    });
    await tx.approvalStep.updateMany({
      where: { requestId: request.id, status: { in: ["PENDING", "WAITING"] } },
      data: { status: "SKIPPED" },
    });
    await tx.request.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
    audit({
      action: "leave.cancel",
      entityType: "Request",
      entityId: request.id,
      before: { status: request.status },
    });
    refresh();
    return { cancelled: true };
  },
});
