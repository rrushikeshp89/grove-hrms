import { renderToBuffer } from "@react-pdf/renderer";

import { parseRange, rangeLabel } from "@/features/analytics/logic/range";
import {
  attendanceReport,
  dataStart,
  departmentOptions,
  hiringReport,
  leaveReport,
  peopleReport,
} from "@/features/analytics/queries";
import { ReportDocument } from "@/features/analytics/report-pdf";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { todayIn } from "@/lib/tz";
import { actorOf, getCurrentUser } from "@/server/session";

/** The analytics page as a printable report, for the same period and team the page is showing. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  if (!can(actorOf(user), "analytics.read")) return new Response("Not allowed.", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const today = todayIn();
  const [start, departments, company] = await Promise.all([
    dataStart(today),
    departmentOptions(),
    db.company.findFirst({ select: { legalName: true } }),
  ]);
  const range = parseRange(
    {
      range: sp.get("range") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    },
    today,
    start,
  );
  const dept = departments.find((d) => d.code === sp.get("dept"));
  const f = { start: range.start, end: range.end, department: dept?.code ?? null };

  const [people, leave, attendance, hiring] = await Promise.all([
    peopleReport(f),
    leaveReport(f),
    attendanceReport(f),
    hiringReport(f),
  ]);
  const pdf = await renderToBuffer(
    <ReportDocument
      company={company?.legalName ?? "Northwind Grove"}
      scope={dept?.name ?? "All departments"}
      period={rangeLabel(range)}
      people={people}
      leave={leave}
      attendance={attendance}
      hiring={hiring}
    />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="people-report-${range.end}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
