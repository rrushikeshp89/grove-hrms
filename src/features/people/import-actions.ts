"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { startChecklist } from "@/features/lifecycle/start";
import type { Prisma } from "@/generated/prisma/client";
import { MAX_CSV_BYTES, missingColumns, parseCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { todayIn } from "@/lib/tz";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { actorOf } from "@/server/session";

import { insertEmployee } from "./create";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  summarize,
  validateRows,
  type ImportRow,
} from "./import-logic";

const schema = z.object({
  csv: z.string().min(1, "Choose a file first").max(MAX_CSV_BYTES, "That file is too large"),
});

/** Reads and checks a file against what's in Grove right now. */
async function analyze(tx: Prisma.TransactionClient, csv: string) {
  const parsed = parseCsv(csv);
  const problems = [...parsed.problems];
  const missing = missingColumns(parsed.headers, IMPORT_COLUMNS);
  if (missing.length) problems.push(`The file is missing these columns: ${missing.join(", ")}.`);
  if (parsed.rows.length === 0 && problems.length === 0) problems.push("The file has no rows.");
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    problems.push(`Import up to ${MAX_IMPORT_ROWS} people at a time.`);
  }
  if (problems.length) return { problems, rows: [] as ImportRow[] };

  const [departments, designations, locations, employees] = await Promise.all([
    tx.department.findMany({ select: { id: true, name: true } }),
    tx.designation.findMany({ select: { id: true, title: true, departmentId: true } }),
    tx.location.findMany({ select: { id: true, name: true } }),
    tx.employee.findMany({
      select: { id: true, workEmail: true, firstName: true, lastName: true },
    }),
  ]);
  const rows = validateRows(
    parsed.rows,
    {
      departments,
      designations,
      locations,
      employees: employees.map((e) => ({
        id: e.id,
        workEmail: e.workEmail,
        name: `${e.firstName} ${e.lastName}`,
      })),
    },
    todayIn(),
  );
  return { problems, rows };
}

/** What the preview shows: every row and its problems, without the resolved ids. */
export const previewEmployeeImport = createAction({
  schema,
  permission: "employee.create",
  handler: async ({ input, tx }) => {
    const { problems, rows } = await analyze(tx, input.csv);
    return {
      problems,
      summary: summarize(rows),
      rows: rows.map((r) => ({ line: r.line, errors: r.errors, display: r.display })),
    };
  },
});

/**
 * Adds every row that passed, in file order, so a manager above a report
 * exists by the time the report is added. Rows with problems are skipped
 * and reported; nothing half-written is left behind if something fails.
 */
export const importEmployees = createAction({
  schema,
  permission: "employee.create",
  handler: async ({ input, user, tx, audit }) => {
    const { problems, rows } = await analyze(tx, input.csv);
    if (problems.length) throw new ActionError(problems[0]!);
    const ready = rows.filter((r) => r.data);
    if (ready.length === 0)
      throw new ActionError("None of the rows can be imported yet. Fix them and try again.");

    const hrId = can(actorOf(user), "lifecycle.manage") ? (user.employee?.id ?? null) : null;
    const idByEmail = new Map<string, string>();
    const created: { name: string; code: string }[] = [];
    for (const row of ready) {
      const d = row.data!;
      const managerId = "id" in d.manager ? d.manager.id : idByEmail.get(d.manager.email);
      if (!managerId) throw new ActionError(`Line ${row.line}: the manager couldn't be found.`);
      const { id, employeeCode } = await insertEmployee(tx, {
        firstName: d.firstName,
        lastName: d.lastName,
        workEmail: d.workEmail,
        designationId: d.designationId,
        departmentId: d.departmentId,
        locationId: d.locationId,
        managerId,
        employmentType: d.employmentType,
        joinDate: d.joinDate,
      });
      idByEmail.set(d.workEmail, id);
      await startChecklist(tx, { employeeId: id, kind: "ONBOARDING", startDate: d.joinDate, hrId });
      audit({
        action: "employee.create",
        entityType: "Employee",
        entityId: id,
        after: {
          employeeCode,
          name: `${d.firstName} ${d.lastName}`,
          joinDate: d.joinDate,
          via: "csv import",
        },
      });
      created.push({ name: `${d.firstName} ${d.lastName}`, code: employeeCode });
    }
    audit({
      action: "people.import",
      entityType: "Employee",
      entityId: "import",
      after: { created: created.length, skipped: rows.length - ready.length },
    });
    revalidatePath("/people");
    revalidatePath("/org");
    revalidatePath("/lifecycle");
    return { created, skipped: rows.length - ready.length };
  },
});
