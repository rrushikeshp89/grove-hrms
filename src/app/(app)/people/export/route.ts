import { EMPLOYMENT_LABELS, STATUS_META, displayName } from "@/features/people/format";
import { parseFilters } from "@/features/people/filters";
import { listPeople } from "@/features/people/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { getCurrentUser } from "@/server/session";

/**
 * The directory as a spreadsheet, for whatever filters are applied. It holds
 * only what the directory already shows everyone: no personal details.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const { people } = await listPeople(user, parseFilters(params));
  const rows = people.map((p) => ({
    code: p.employeeCode,
    name: displayName(p),
    email: p.workEmail,
    title: p.designation.title,
    department: p.department.name,
    location: p.location.name,
    manager: p.manager ? displayName(p.manager) : "",
    type: EMPLOYMENT_LABELS[p.employmentType],
    status: STATUS_META[p.status].label,
    joined: p.joinDate.toISOString().slice(0, 10),
  }));
  const csv = toCsv(
    [
      { key: "code", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Work email" },
      { key: "title", label: "Title" },
      { key: "department", label: "Department" },
      { key: "location", label: "Location" },
      { key: "manager", label: "Manager" },
      { key: "type", label: "Contract" },
      { key: "status", label: "Status" },
      { key: "joined", label: "Joined" },
    ],
    rows,
  );
  return csvResponse(`people-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
