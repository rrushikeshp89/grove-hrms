"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { dbDate } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";

import { roleChangeProblem } from "./logic";
import {
  companySchema,
  deleteHolidaySchema,
  holidaySchema,
  leaveTypeActiveSchema,
  leaveTypeSchema,
  roleChangeSchema,
  scheduleSchema,
} from "./schemas";

/* ─── Company and working hours ────────────────────────────────────────── */

export const updateCompany = createAction({
  schema: companySchema,
  permission: "settings.company",
  handler: async ({ input, tx, audit }) => {
    const company = await tx.company.findFirst({
      select: { id: true, name: true, legalName: true },
    });
    if (!company) throw new ActionError("The company record is missing.");
    await tx.company.update({ where: { id: company.id }, data: input });
    audit({
      action: "settings.company.update",
      entityType: "Company",
      entityId: company.id,
      before: { name: company.name, legalName: company.legalName },
      after: input,
    });
    revalidatePath("/settings/company");
    revalidatePath("/pay", "layout");
    return { saved: true };
  },
});

/** The shift every location shares. Attendance is evaluated against it from the next clock-in on. */
export const updateSchedule = createAction({
  schema: scheduleSchema,
  permission: "settings.company",
  handler: async ({ input, tx, audit }) => {
    const before = await tx.workSchedule.findUnique({ where: { id: input.scheduleId } });
    if (!before) throw new ActionError("That schedule no longer exists.");
    const workDays = [...new Set(input.workDays)].sort((a, b) => a - b);
    await tx.workSchedule.update({
      where: { id: before.id },
      data: {
        startTime: input.startTime,
        endTime: input.endTime,
        graceMinutes: input.graceMinutes,
        workDays,
      },
    });
    audit({
      action: "settings.schedule.update",
      entityType: "WorkSchedule",
      entityId: before.id,
      before: {
        startTime: before.startTime,
        endTime: before.endTime,
        graceMinutes: before.graceMinutes,
        workDays: before.workDays,
      },
      after: {
        startTime: input.startTime,
        endTime: input.endTime,
        graceMinutes: input.graceMinutes,
        workDays,
      },
    });
    revalidatePath("/settings/company");
    revalidatePath("/attendance", "layout");
    return { saved: true };
  },
});

/* ─── Leave types ──────────────────────────────────────────────────────── */

const COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"] as const;

export const saveLeaveType = createAction({
  schema: leaveTypeSchema,
  permission: "leave.configure",
  handler: async ({ input, tx, audit }) => {
    const existing = input.id
      ? await tx.leaveType.findUnique({ where: { id: input.id }, include: { policies: true } })
      : null;
    if (input.id && !existing) throw new ActionError("That leave type no longer exists.");

    const clash = await tx.leaveType.findFirst({
      where: {
        id: existing ? { not: existing.id } : undefined,
        OR: [{ name: input.name }, ...(existing ? [] : [{ code: input.code }])],
      },
      select: { name: true, code: true },
    });
    if (clash) {
      throw new ActionError("A leave type with that name or code already exists.", {
        [clash.name === input.name ? "name" : "code"]: ["Already in use"],
      });
    }
    if (
      input.annualQuota < input.carryForwardMax &&
      input.carryForwardMax > 0 &&
      input.accrual === "UPFRONT"
    ) {
      // Carrying over more than a year's worth is allowed for monthly accrual, but odd for upfront.
      throw new ActionError("Carry-forward can't be more than the yearly days for upfront leave.", {
        carryForwardMax: ["At most the yearly days"],
      });
    }

    const fields = {
      name: input.name,
      description: input.description,
      isPaid: input.isPaid,
      allowHalfDay: input.allowHalfDay,
      approvalLevels: input.approvalLevels,
      maxConsecutiveDays: input.maxConsecutiveDays,
      minNoticeDays: input.minNoticeDays,
      requiresDocumentAfterDays: input.requiresDocumentAfterDays,
    };
    const policy = {
      annualQuota: input.annualQuota,
      accrual: input.accrual,
      carryForwardMax: input.carryForwardMax,
      proRataOnJoin: input.proRataOnJoin,
    };

    let id: string;
    if (existing) {
      id = existing.id;
      await tx.leaveType.update({ where: { id }, data: fields });
      const current =
        existing.policies.find((p) => !p.locationId && !p.employmentType) ?? existing.policies[0];
      if (current) await tx.leavePolicy.update({ where: { id: current.id }, data: policy });
      else await tx.leavePolicy.create({ data: { ...policy, leaveTypeId: id } });
    } else {
      const used = new Set(
        (await tx.leaveType.findMany({ select: { colorToken: true } })).map((t) => t.colorToken),
      );
      const created = await tx.leaveType.create({
        data: {
          ...fields,
          code: input.code,
          colorToken: COLORS.find((c) => !used.has(c)) ?? COLORS[0],
          policies: { create: policy },
        },
      });
      id = created.id;
    }
    const before = existing
      ? {
          ...Object.fromEntries(
            Object.keys(fields).map((k) => [k, (existing as Record<string, unknown>)[k]]),
          ),
          ...(existing.policies[0]
            ? {
                annualQuota: Number(existing.policies[0].annualQuota),
                accrual: existing.policies[0].accrual,
                carryForwardMax: Number(existing.policies[0].carryForwardMax),
                proRataOnJoin: existing.policies[0].proRataOnJoin,
              }
            : {}),
        }
      : undefined;
    audit({
      action: "leave.type.save",
      entityType: "LeaveType",
      entityId: id,
      before: before as Prisma.InputJsonValue | undefined,
      after: { ...fields, ...policy, code: existing?.code ?? input.code } as Prisma.InputJsonValue,
    });
    revalidatePath("/settings/leave");
    revalidatePath("/leave", "layout");
    return { id };
  },
});

export const setLeaveTypeActive = createAction({
  schema: leaveTypeActiveSchema,
  permission: "leave.configure",
  handler: async ({ input, tx, audit }) => {
    const type = await tx.leaveType.findUnique({
      where: { id: input.id },
      select: { id: true, name: true, isActive: true },
    });
    if (!type) throw new ActionError("That leave type no longer exists.");
    if (type.isActive === input.active) return { active: input.active };
    await tx.leaveType.update({ where: { id: type.id }, data: { isActive: input.active } });
    audit({
      action: "leave.type.save",
      entityType: "LeaveType",
      entityId: type.id,
      before: { isActive: type.isActive },
      after: { isActive: input.active, name: type.name },
    });
    revalidatePath("/settings/leave");
    revalidatePath("/leave", "layout");
    return { active: input.active };
  },
});

/* ─── Holidays ─────────────────────────────────────────────────────────── */

export const saveHoliday = createAction({
  schema: holidaySchema,
  permission: "leave.configure",
  handler: async ({ input, tx, audit }) => {
    const existing = input.id ? await tx.holiday.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new ActionError("That holiday no longer exists.");
    if (input.locationId) {
      const loc = await tx.location.findUnique({
        where: { id: input.locationId },
        select: { id: true },
      });
      if (!loc) throw new ActionError("That location no longer exists.");
    }
    const data = {
      name: input.name,
      date: dbDate(input.date),
      locationId: input.locationId,
      isOptional: input.isOptional,
    };
    const clash = await tx.holiday.findFirst({
      where: { ...data, isOptional: undefined, id: existing ? { not: existing.id } : undefined },
      select: { id: true },
    });
    if (clash) {
      throw new ActionError("That holiday is already on the calendar.", {
        name: ["Already listed for that day and place"],
      });
    }
    const saved = existing
      ? await tx.holiday.update({ where: { id: existing.id }, data })
      : await tx.holiday.create({ data });
    audit({
      action: "holiday.save",
      entityType: "Holiday",
      entityId: saved.id,
      before: existing
        ? {
            name: existing.name,
            date: existing.date.toISOString().slice(0, 10),
            locationId: existing.locationId,
            isOptional: existing.isOptional,
          }
        : undefined,
      after: {
        name: input.name,
        date: input.date,
        locationId: input.locationId,
        isOptional: input.isOptional,
      },
    });
    revalidatePath("/settings/holidays");
    revalidatePath("/holidays");
    revalidatePath("/leave", "layout");
    return { id: saved.id };
  },
});

export const deleteHoliday = createAction({
  schema: deleteHolidaySchema,
  permission: "leave.configure",
  handler: async ({ input, tx, audit }) => {
    const h = await tx.holiday.findUnique({ where: { id: input.id } });
    if (!h) return { deleted: false };
    await tx.holiday.delete({ where: { id: h.id } });
    audit({
      action: "holiday.delete",
      entityType: "Holiday",
      entityId: h.id,
      before: { name: h.name, date: h.date.toISOString().slice(0, 10) },
    });
    revalidatePath("/settings/holidays");
    revalidatePath("/holidays");
    revalidatePath("/leave", "layout");
    return { deleted: true };
  },
});

/* ─── Roles ────────────────────────────────────────────────────────────── */

export const changeRole = createAction({
  schema: roleChangeSchema,
  permission: "roles.assign",
  handler: async ({ input, user, tx, audit }) => {
    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, role: true, isDemo: true },
    });
    if (!target) throw new ActionError("We couldn't find that person.");
    const superAdmins = await tx.user.count({ where: { role: "SUPER_ADMIN" } });
    const problem = roleChangeProblem({
      actorUserId: user.id,
      target,
      newRole: input.role,
      superAdmins,
    });
    if (problem) throw new ActionError(problem);
    await tx.user.update({ where: { id: target.id }, data: { role: input.role } });
    audit({
      action: "role.change",
      entityType: "User",
      entityId: target.id,
      before: { role: target.role, name: target.name },
      after: { role: input.role, name: target.name },
    });
    revalidatePath("/settings/roles");
    return { role: input.role };
  },
});
