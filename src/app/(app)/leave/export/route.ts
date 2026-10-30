import { leaveForExport } from "@/features/leave/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayIn } from "@/lib/tz";
import { getCurrentUser } from "@/server/session";

/** Leave requests for a year, as far as this person is allowed to see them. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  const thisYear = Number(todayIn().slice(0, 4));
  const asked = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(asked) && asked >= 2020 && asked <= thisYear + 1 ? asked : thisYear;

  const rows = await leaveForExport(user, year);
  const csv = toCsv(
    [
      { key: "code", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "type", label: "Leave type" },
      { key: "start", label: "From" },
      { key: "end", label: "To" },
      { key: "days", label: "Days" },
      { key: "status", label: "Status" },
      { key: "requested", label: "Requested on" },
      { key: "reason", label: "Reason" },
    ],
    rows,
  );
  return csvResponse(`leave-${year}.csv`, csv);
}
