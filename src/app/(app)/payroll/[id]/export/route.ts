import { runDetail } from "@/features/payroll/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { actorOf, getCurrentUser } from "@/server/session";

/** A pay run as a spreadsheet, in rupees, for the people who can run payroll. */
export async function GET(_req: Request, ctx: RouteContext<"/payroll/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  if (!can(actorOf(user), "payroll.run")) return new Response("Not allowed.", { status: 403 });
  const { id } = await ctx.params;
  const run = await runDetail(id);
  if (!run) return new Response("Pay run not found.", { status: 404 });

  const rupees = (minor: number) => minor / 100;
  const csv = toCsv(
    [
      { key: "code", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "working", label: "Working days" },
      { key: "paid", label: "Paid days" },
      { key: "lop", label: "Loss of pay days" },
      { key: "gross", label: "Gross (INR)" },
      { key: "deductions", label: "Deductions (INR)" },
      { key: "net", label: "Net pay (INR)" },
    ],
    run.payslips.map((p) => ({
      code: p.code,
      name: p.name,
      department: p.department,
      working: p.workingDays,
      paid: p.paidDays,
      lop: p.lopDays,
      gross: rupees(p.grossMinor),
      deductions: rupees(p.deductionsMinor),
      net: rupees(p.netMinor),
    })),
  );
  const name = `payroll-${run.year}-${String(run.month).padStart(2, "0")}${run.status === "FINALIZED" ? "" : "-draft"}.csv`;
  return csvResponse(name, csv);
}
