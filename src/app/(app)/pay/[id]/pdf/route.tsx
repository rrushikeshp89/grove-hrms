import { renderToBuffer } from "@react-pdf/renderer";

import { PayslipDocument } from "@/features/payroll/payslip-pdf";
import { payslipDetail } from "@/features/payroll/queries";
import { getCurrentUser } from "@/server/session";

/** Streams a payslip as a PDF, after the same access check the page uses. */
export async function GET(_req: Request, ctx: RouteContext<"/pay/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download payslips.", { status: 401 });
  const { id } = await ctx.params;
  const slip = await payslipDetail(user, id);
  if (!slip) return new Response("Payslip not found.", { status: 404 });

  const pdf = await renderToBuffer(<PayslipDocument slip={slip} />);
  const file = `payslip-${slip.year}-${String(slip.month).padStart(2, "0")}-${slip.employee.code}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
