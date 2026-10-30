"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { leaveDayParts } from "@/features/leave/logic/days";
import { createRequest } from "@/features/requests/engine";
import { hrApproverId, workCalendar, workContext } from "@/features/time/calendar";
import { addDays, dbDate, instantAt, todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";

import { evaluateDay } from "./logic/evaluate";
import { REGULARIZE_WINDOW_DAYS, regularizeSchema } from "./schemas";

/**
 * One button: clocks in if you haven't, out if you have. One session per
 * day; anything more unusual goes through a regularization request.
 */
export const clockInOrOut = createAction({
  schema: z.object({ source: z.enum(["WEB", "MOBILE"]).default("WEB") }),
  permission: "attendance.clock",
  handler: async ({ input, user, tx, audit }) => {
    const employeeId = user.employee?.id;
    if (!employeeId) throw new ActionError("Your account isn't linked to an employee record yet.");
    const ctx = await workContext(employeeId, tx);
    const today = todayIn(ctx.tz);
    const now = new Date();
    const date = dbDate(today);

    const onLeave = await tx.leaveRequest.findFirst({
      where: {
        request: { requesterId: employeeId, status: "APPROVED" },
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    if (onLeave) {
      const cal = await workCalendar(ctx, today, today, tx);
      const part = leaveDayParts(
        {
          start: onLeave.startDate.toISOString().slice(0, 10),
          end: onLeave.endDate.toISOString().slice(0, 10),
          startHalf: onLeave.startHalf,
          endHalf: onLeave.endHalf,
        },
        cal,
      ).find((p) => p.day === today);
      if (part?.portion === 1) {
        throw new ActionError("You're on leave today, so there's nothing to clock. Enjoy the day.");
      }
    }

    const existing = await tx.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (existing?.clockOutAt) {
      throw new ActionError(
        "You've already clocked out today. If the times are wrong, request a correction.",
      );
    }

    if (!existing?.clockInAt) {
      const evaluated = evaluateDay({ clockInAt: now, clockOutAt: null }, ctx.schedule, ctx.tz);
      const record = await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: { employeeId, date, clockInAt: now, source: input.source, ...evaluated },
        update: { clockInAt: now, source: input.source, ...evaluated },
      });
      audit({
        action: "attendance.clock_in",
        entityType: "AttendanceRecord",
        entityId: record.id,
        after: { at: now.toISOString() },
      });
      revalidatePath("/attendance");
      return {
        action: "in" as const,
        at: now.toISOString(),
        lateByMinutes: evaluated.lateByMinutes,
      };
    }

    if (now.getTime() - existing.clockInAt.getTime() < 60_000) {
      throw new ActionError(
        "You clocked in less than a minute ago. Clock out when you're done for the day.",
      );
    }
    const evaluated = evaluateDay(
      { clockInAt: existing.clockInAt, clockOutAt: now },
      ctx.schedule,
      ctx.tz,
    );
    await tx.attendanceRecord.update({
      where: { id: existing.id },
      data: { clockOutAt: now, ...evaluated },
    });
    audit({
      action: "attendance.clock_out",
      entityType: "AttendanceRecord",
      entityId: existing.id,
      after: { at: now.toISOString() },
    });
    revalidatePath("/attendance");
    return {
      action: "out" as const,
      at: now.toISOString(),
      workedMinutes: evaluated.workedMinutes,
    };
  },
});

export const requestRegularization = createAction({
  schema: regularizeSchema,
  permission: "attendance.clock",
  handler: async ({ input, user, tx, audit }) => {
    const employeeId = user.employee?.id;
    if (!employeeId) throw new ActionError("Your account isn't linked to an employee record yet.");
    const ctx = await workContext(employeeId, tx);
    const today = todayIn(ctx.tz);
    if (input.date > today)
      throw new ActionError("You can only correct days that have happened.", {
        date: ["Pick today or an earlier day"],
      });
    if (input.date < addDays(today, -REGULARIZE_WINDOW_DAYS)) {
      throw new ActionError(
        `Corrections are possible for the last ${REGULARIZE_WINDOW_DAYS} days.`,
        {
          date: [`Pick a day after ${addDays(today, -REGULARIZE_WINDOW_DAYS)}`],
        },
      );
    }
    if (input.date < ctx.joinDate)
      throw new ActionError("That's before you joined.", { date: ["Pick a later day"] });

    const pending = await tx.regularizationRequest.findFirst({
      where: { date: dbDate(input.date), request: { requesterId: employeeId, status: "PENDING" } },
    });
    if (pending)
      throw new ActionError("You already have a correction waiting for that day.", {
        date: ["Already requested"],
      });

    const request = await createRequest(tx, {
      type: "REGULARIZATION",
      requesterId: employeeId,
      managerId: ctx.managerId,
      hrApproverId: await hrApproverId(tx),
      levels: 1,
    });
    await tx.regularizationRequest.create({
      data: {
        requestId: request.id,
        date: dbDate(input.date),
        requestedClockIn: input.clockIn ? instantAt(input.date, input.clockIn, ctx.tz) : null,
        requestedClockOut: input.clockOut ? instantAt(input.date, input.clockOut, ctx.tz) : null,
        reason: input.reason,
      },
    });
    audit({
      action: "attendance.request_correction",
      entityType: "Request",
      entityId: request.id,
      after: { date: input.date, clockIn: input.clockIn, clockOut: input.clockOut },
    });
    revalidatePath("/attendance");
    revalidatePath("/approvals");
    return { requestId: request.id };
  },
});
