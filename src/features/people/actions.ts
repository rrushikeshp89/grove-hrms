"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { reportIds, targetFor } from "@/server/authz";
import { actorOf, getCurrentUser } from "@/server/session";

import { profileAccess } from "./access";
import { searchPeople } from "./queries";
import {
  emergencyContactSchema,
  jobSchema,
  newEmployeeSchema,
  personalSchema,
  privateSchema,
} from "./schemas";

async function accessFor(
  user: Parameters<typeof actorOf>[0],
  employeeId: string,
  tx: Prisma.TransactionClient,
) {
  return profileAccess(actorOf(user), await targetFor(employeeId, tx));
}

/** Only the keys that actually changed, for compact audit entries. */
function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(after)) {
    const prev = before[k];
    const same = JSON.stringify(prev) === JSON.stringify(v);
    if (!same) {
      b[k] = prev ?? null;
      a[k] = v ?? null;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

const toDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const fromDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export const updatePersonal = createAction({
  schema: personalSchema,
  handler: async ({ input, user, tx, audit }) => {
    const access = await accessFor(user, input.employeeId, tx);
    if (!access.editPersonal) throw new ActionError("You can only edit your own profile.");
    const current = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
      select: { preferredName: true, pronouns: true, bio: true, skills: true },
    });
    const { employeeId, ...data } = input;
    const d = diff(current, data);
    if (!d.changed) return { changed: false };
    await tx.employee.update({ where: { id: employeeId }, data });
    audit({
      action: "employee.update_personal",
      entityType: "Employee",
      entityId: employeeId,
      before: d.before as Prisma.InputJsonValue,
      after: d.after as Prisma.InputJsonValue,
    });
    revalidatePath(`/people/${employeeId}`);
    return { changed: true };
  },
});

export const updatePrivate = createAction({
  schema: privateSchema,
  handler: async ({ input, user, tx, audit }) => {
    const access = await accessFor(user, input.employeeId, tx);
    if (!access.editPrivate)
      throw new ActionError("Only this person and HR can change private details.");
    const current = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
      select: { phone: true, personalEmail: true, dateOfBirth: true, address: true },
    });
    const prevAddress = (current.address ?? {}) as Record<string, string | null>;
    const next = {
      phone: input.phone,
      personalEmail: input.personalEmail,
      dateOfBirth: input.dateOfBirth,
      address: {
        ...prevAddress,
        area: input.area,
        city: input.city,
        state: input.state,
        country: "India",
      },
    };
    const d = diff(
      {
        ...current,
        dateOfBirth: fromDay(current.dateOfBirth),
        address: { ...prevAddress, country: "India" },
      },
      next,
    );
    if (!d.changed) return { changed: false };
    await tx.employee.update({
      where: { id: input.employeeId },
      data: { ...next, dateOfBirth: next.dateOfBirth ? toDay(next.dateOfBirth) : null },
    });
    // Private values aren't copied into the log, only which fields changed.
    audit({
      action: "employee.update_private",
      entityType: "Employee",
      entityId: input.employeeId,
      after: { fields: Object.keys(d.after) },
    });
    revalidatePath(`/people/${input.employeeId}`);
    return { changed: true };
  },
});

export const updateJob = createAction({
  schema: jobSchema,
  handler: async ({ input, user, tx, audit }) => {
    const access = await accessFor(user, input.employeeId, tx);
    if (!access.editJob) throw new ActionError("Only HR and admins can change job details.");

    const designation = await tx.designation.findUnique({ where: { id: input.designationId } });
    if (!designation)
      throw new ActionError("That designation no longer exists.", {
        designationId: ["Choose a designation"],
      });
    if (designation.departmentId && designation.departmentId !== input.departmentId) {
      throw new ActionError("That designation belongs to a different department.", {
        designationId: ["Pick a designation from the selected department"],
      });
    }
    if (input.managerId) {
      if (input.managerId === input.employeeId) {
        throw new ActionError("Someone can't report to themselves.", {
          managerId: ["Choose a different manager"],
        });
      }
      const below = await reportIds(input.employeeId, tx);
      if (below.includes(input.managerId)) {
        throw new ActionError("That would create a loop in the org chart.", {
          managerId: ["This person already reports to them, directly or indirectly"],
        });
      }
    }

    const current = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
      select: {
        designationId: true,
        departmentId: true,
        locationId: true,
        managerId: true,
        employmentType: true,
        status: true,
        joinDate: true,
      },
    });
    const { employeeId, joinDate, ...rest } = input;
    const d = diff({ ...current, joinDate: fromDay(current.joinDate) }, { ...rest, joinDate });
    if (!d.changed) return { changed: false };
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...rest,
        joinDate: toDay(joinDate),
        exitDate:
          rest.status === "EXITED" ? (current.status === "EXITED" ? undefined : new Date()) : null,
      },
    });
    audit({
      action: "employee.update_job",
      entityType: "Employee",
      entityId: employeeId,
      before: d.before as Prisma.InputJsonValue,
      after: d.after as Prisma.InputJsonValue,
    });
    revalidatePath(`/people/${employeeId}`);
    revalidatePath("/people");
    revalidatePath("/org");
    return { changed: true };
  },
});

export const saveEmergencyContact = createAction({
  schema: emergencyContactSchema,
  handler: async ({ input, user, tx, audit }) => {
    const access = await accessFor(user, input.employeeId, tx);
    if (!access.editPrivate)
      throw new ActionError("Only this person and HR can change emergency contacts.");
    const { id, employeeId, ...data } = input;
    if (data.isPrimary) {
      await tx.emergencyContact.updateMany({
        where: { employeeId, id: id ? { not: id } : undefined },
        data: { isPrimary: false },
      });
    }
    const saved = id
      ? await tx.emergencyContact.update({ where: { id, employeeId }, data })
      : await tx.emergencyContact.create({ data: { ...data, employeeId } });
    audit({
      action: id ? "employee.update_emergency_contact" : "employee.add_emergency_contact",
      entityType: "Employee",
      entityId: employeeId,
      after: { name: saved.name, relationship: saved.relationship },
    });
    revalidatePath(`/people/${employeeId}`);
    return { id: saved.id };
  },
});

export const deleteEmergencyContact = createAction({
  schema: z.object({ employeeId: z.string().min(1), id: z.string().min(1) }),
  handler: async ({ input, user, tx, audit }) => {
    const access = await accessFor(user, input.employeeId, tx);
    if (!access.editPrivate)
      throw new ActionError("Only this person and HR can change emergency contacts.");
    const contact = await tx.emergencyContact.findFirst({
      where: { id: input.id, employeeId: input.employeeId },
    });
    if (!contact) return { deleted: false };
    await tx.emergencyContact.delete({ where: { id: contact.id } });
    audit({
      action: "employee.remove_emergency_contact",
      entityType: "Employee",
      entityId: input.employeeId,
      before: { name: contact.name, relationship: contact.relationship },
    });
    revalidatePath(`/people/${input.employeeId}`);
    return { deleted: true };
  },
});

export const createEmployee = createAction({
  schema: newEmployeeSchema,
  permission: "employee.create",
  handler: async ({ input, tx, audit }) => {
    const taken = await tx.employee.findUnique({ where: { workEmail: input.workEmail } });
    if (taken) {
      throw new ActionError("Someone already uses that work email.", {
        workEmail: [`${input.workEmail} belongs to ${taken.firstName} ${taken.lastName}`],
      });
    }
    const designation = await tx.designation.findUnique({ where: { id: input.designationId } });
    if (designation?.departmentId && designation.departmentId !== input.departmentId) {
      throw new ActionError("That designation belongs to a different department.", {
        designationId: ["Pick a designation from the selected department"],
      });
    }
    // Codes are sequential and never reused, like a real HR system.
    const last = await tx.employee.findFirst({
      orderBy: { employeeCode: "desc" },
      select: { employeeCode: true },
    });
    const next = Number(last?.employeeCode.replace(/\D/g, "") ?? 0) + 1;
    const employeeCode = `GRV-${String(next).padStart(4, "0")}`;
    const joinDate = toDay(input.joinDate);
    const employee = await tx.employee.create({
      data: {
        employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        designationId: input.designationId,
        departmentId: input.departmentId,
        locationId: input.locationId,
        managerId: input.managerId,
        employmentType: input.employmentType,
        joinDate,
        status: joinDate > new Date() ? "ONBOARDING" : "ACTIVE",
      },
    });
    audit({
      action: "employee.create",
      entityType: "Employee",
      entityId: employee.id,
      after: {
        employeeCode,
        name: `${input.firstName} ${input.lastName}`,
        joinDate: input.joinDate,
      },
    });
    revalidatePath("/people");
    revalidatePath("/org");
    return { id: employee.id, employeeCode };
  },
});

/** People search for the command palette; returns only what the palette shows. */
export async function findPeople(q: string) {
  if (!(await getCurrentUser())) return [];
  const rows = await searchPeople(q);
  return rows.map((p) => ({
    id: p.id,
    name: `${p.preferredName ?? p.firstName} ${p.lastName}`,
    title: p.designation.title,
    department: p.department.name,
    code: p.employeeCode,
    avatarUrl: p.avatarUrl,
  }));
}
