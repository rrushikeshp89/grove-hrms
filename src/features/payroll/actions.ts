"use server";

import { revalidatePath } from "next/cache";

import { dbDate, monthBounds, todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";

import { notifyPayslipsReady } from "@/features/notifications/broadcasts";

import { buildPayslips } from "./generate";
import { runnableMonth, standardStructure } from "./logic/compute";
import { periodLabel } from "./queries";
import { createRunSchema, returnRunSchema, runIdSchema, structureSchema } from "./schemas";

const refresh = (runId?: string) => {
  revalidatePath("/payroll");
  if (runId) revalidatePath(`/payroll/${runId}`);
  revalidatePath("/pay");
};

/** The payslip rows for a run, ready for createMany. */
async function slipsFor(
  tx: Parameters<typeof buildPayslips>[0],
  runId: string,
  year: number,
  month: number,
) {
  const slips = await buildPayslips(tx, year, month);
  if (slips.length === 0) {
    throw new ActionError("Nobody has a salary structure for that month yet.");
  }
  return slips.map((s) => ({ ...s, runId }));
}

export const createRun = createAction({
  schema: createRunSchema,
  permission: "payroll.run",
  handler: async ({ input, user, tx, audit }) => {
    if (!user.employee) throw new ActionError("Payroll runs need an employee record behind them.");
    if (!runnableMonth(input.year, input.month, todayIn())) {
      throw new ActionError("That month isn't ready to run yet. Wait until the 25th or month end.");
    }
    const existing = await tx.payrollRun.findUnique({
      where: { year_month: { year: input.year, month: input.month } },
    });
    if (existing) throw new ActionError("That month already has a run.");
    const run = await tx.payrollRun.create({
      data: { year: input.year, month: input.month, createdById: user.employee.id },
    });
    const slips = await slipsFor(tx, run.id, input.year, input.month);
    await tx.payslip.createMany({ data: slips });
    audit({
      action: "payroll.run.create",
      entityType: "PayrollRun",
      entityId: run.id,
      after: { year: input.year, month: input.month, people: slips.length },
    });
    refresh(run.id);
    return { id: run.id };
  },
});

/** Re-reads attendance, leave and structures. Only while the run is still a draft. */
export const regenerateRun = createAction({
  schema: runIdSchema,
  permission: "payroll.run",
  handler: async ({ input, tx, audit }) => {
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId } });
    if (!run) throw new ActionError("That run no longer exists.");
    if (run.status !== "DRAFT") throw new ActionError("Only a draft can be regenerated.");
    const slips = await slipsFor(tx, run.id, run.year, run.month);
    await tx.payslip.deleteMany({ where: { runId: run.id } });
    await tx.payslip.createMany({ data: slips });
    audit({
      action: "payroll.run.regenerate",
      entityType: "PayrollRun",
      entityId: run.id,
      after: { people: slips.length },
    });
    refresh(run.id);
    return { people: slips.length };
  },
});

export const submitRun = createAction({
  schema: runIdSchema,
  permission: "payroll.run",
  handler: async ({ input, tx, audit }) => {
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId } });
    if (!run) throw new ActionError("That run no longer exists.");
    if (run.status !== "DRAFT") throw new ActionError("This run has already been sent for review.");
    await tx.payrollRun.update({ where: { id: run.id }, data: { status: "IN_REVIEW" } });
    audit({
      action: "payroll.run.submit",
      entityType: "PayrollRun",
      entityId: run.id,
      before: { status: "DRAFT" },
      after: { status: "IN_REVIEW" },
    });
    refresh(run.id);
    return { status: "IN_REVIEW" as const };
  },
});

export const returnRun = createAction({
  schema: returnRunSchema,
  permission: "payroll.run",
  handler: async ({ input, tx, audit }) => {
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId } });
    if (!run) throw new ActionError("That run no longer exists.");
    if (run.status !== "IN_REVIEW") throw new ActionError("Only a run in review can be sent back.");
    await tx.payrollRun.update({ where: { id: run.id }, data: { status: "DRAFT" } });
    audit({
      action: "payroll.run.return",
      entityType: "PayrollRun",
      entityId: run.id,
      before: { status: "IN_REVIEW" },
      after: { status: "DRAFT", note: input.note },
    });
    refresh(run.id);
    return { status: "DRAFT" as const };
  },
});

/**
 * Locks the run. Four eyes: whoever prepared a run can't also finalize it,
 * so every payout has been looked at by two people.
 */
export const finalizeRun = createAction({
  schema: runIdSchema,
  permission: "payroll.run",
  handler: async ({ input, user, tx, audit }) => {
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId } });
    if (!run) throw new ActionError("That run no longer exists.");
    if (run.status === "FINALIZED") throw new ActionError("This run is already final.");
    if (run.status !== "IN_REVIEW") throw new ActionError("Send the run for review first.");
    if (run.createdById === user.employee?.id) {
      throw new ActionError(
        "Someone other than the person who prepared this run needs to finalize it.",
      );
    }
    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "FINALIZED",
        reviewedById: user.employee?.id ?? null,
        finalizedAt: new Date(),
      },
    });
    audit({
      action: "payroll.run.finalize",
      entityType: "PayrollRun",
      entityId: run.id,
      before: { status: "IN_REVIEW" },
      after: { status: "FINALIZED" },
    });
    await notifyPayslipsReady(tx, run.id, periodLabel(run.year, run.month), user.id);
    refresh(run.id);
    return { status: "FINALIZED" as const };
  },
});

/** A revision: a new structure from the standard split, effective from a date. */
export const reviseSalary = createAction({
  schema: structureSchema,
  permission: "payroll.run",
  handler: async ({ input, tx, audit }) => {
    const person = await tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, firstName: true, lastName: true, joinDate: true },
    });
    if (!person) throw new ActionError("We couldn't find that person.");
    const locked = await tx.payrollRun.findFirst({
      where: { status: "FINALIZED" },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { year: true, month: true },
    });
    if (locked && input.effectiveFrom <= monthBounds(locked.year, locked.month).end) {
      throw new ActionError("That date falls in a month that's already been paid.", {
        effectiveFrom: ["Pick a date after the last finalized month"],
      });
    }
    const before = await tx.salaryStructure.findFirst({
      where: { employeeId: person.id },
      orderBy: { effectiveFrom: "desc" },
      select: { annualCtcMinor: true },
    });
    const annualCtcMinor = input.annualCtcRupees * 100;
    const components = standardStructure(annualCtcMinor);
    const structure = await tx.salaryStructure.create({
      data: {
        employeeId: person.id,
        effectiveFrom: dbDate(input.effectiveFrom),
        annualCtcMinor: BigInt(annualCtcMinor),
        components: {
          create: components.map((c) => ({
            name: c.name,
            kind: c.kind,
            calc: c.calc,
            amountMinor: c.amountMinor,
            percentBps: c.percentBps,
            sortOrder: c.sortOrder,
          })),
        },
      },
    });
    audit({
      action: "payroll.salary.revise",
      entityType: "SalaryStructure",
      entityId: structure.id,
      before: before ? { annualCtcRupees: Number(before.annualCtcMinor) / 100 } : undefined,
      after: { annualCtcRupees: input.annualCtcRupees, effectiveFrom: input.effectiveFrom },
    });
    refresh();
    revalidatePath("/payroll/structures");
    return { id: structure.id };
  },
});
