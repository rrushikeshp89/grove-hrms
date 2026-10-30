import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { todayIn } from "@/lib/tz";
import { ActionError } from "@/server/action-error";

export type NewEmployee = {
  firstName: string;
  lastName: string;
  workEmail: string;
  personalEmail?: string | null;
  phone?: string | null;
  designationId: string;
  departmentId: string;
  locationId: string;
  managerId: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  joinDate: string;
};

/**
 * Inserts an employee with the next sequential code. Shared by "Add
 * employee" and "Convert to employee" so both follow the same rules.
 * Someone who hasn't started yet is ONBOARDING until their first day.
 */
export async function insertEmployee(tx: Prisma.TransactionClient, input: NewEmployee) {
  const taken = await tx.employee.findUnique({ where: { workEmail: input.workEmail } });
  if (taken) {
    throw new ActionError("Someone already uses that work email.", {
      workEmail: [`${input.workEmail} belongs to ${taken.firstName} ${taken.lastName}`],
    });
  }
  // Codes are sequential and never reused, like a real HR system.
  const last = await tx.employee.findFirst({
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  const next = Number(last?.employeeCode.replace(/\D/g, "") ?? 0) + 1;
  const employeeCode = `GRV-${String(next).padStart(4, "0")}`;
  const employee = await tx.employee.create({
    data: {
      employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      workEmail: input.workEmail,
      personalEmail: input.personalEmail ?? null,
      phone: input.phone ?? null,
      designationId: input.designationId,
      departmentId: input.departmentId,
      locationId: input.locationId,
      managerId: input.managerId,
      employmentType: input.employmentType,
      joinDate: new Date(`${input.joinDate}T00:00:00.000Z`),
      status: input.joinDate > todayIn() ? "ONBOARDING" : "ACTIVE",
    },
  });
  return { id: employee.id, employeeCode };
}
