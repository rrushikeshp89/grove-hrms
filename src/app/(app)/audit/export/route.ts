import { describeAction, parseFilters } from "@/features/audit/logic";
import { auditForExport } from "@/features/audit/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { actorOf, getCurrentUser } from "@/server/session";

/** The audit log (or the filtered view of it) as a spreadsheet, for people who can read it. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to export.", { status: 401 });
  if (!can(actorOf(user), "audit.read")) return new Response("Not allowed.", { status: 403 });

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const rows = (await auditForExport(parseFilters(params))).map((e) => ({
    when: e.createdAt,
    who: e.actor?.name ?? "System",
    role: e.actor?.role ?? "",
    what: describeAction(e.action),
    action: e.action,
    record_type: e.entityType,
    record_id: e.entityId,
    before: e.before ? JSON.stringify(e.before) : "",
    after: e.after ? JSON.stringify(e.after) : "",
    ip: e.ip ?? "",
  }));
  const csv = toCsv(
    [
      { key: "when", label: "When (UTC)" },
      { key: "who", label: "Who" },
      { key: "role", label: "Role" },
      { key: "what", label: "What" },
      { key: "action", label: "Action" },
      { key: "record_type", label: "Record type" },
      { key: "record_id", label: "Record ID" },
      { key: "before", label: "Before" },
      { key: "after", label: "After" },
      { key: "ip", label: "IP address" },
    ],
    rows,
  );
  return csvResponse(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
