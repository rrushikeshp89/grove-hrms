import { TEMPLATE_CSV } from "@/features/people/import-logic";
import { csvResponse } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { actorOf, getCurrentUser } from "@/server/session";

/** A starter file with the right columns and two worked examples. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download the template.", { status: 401 });
  if (!can(actorOf(user), "employee.create")) return new Response("Not allowed.", { status: 403 });
  return csvResponse("grove-people-import-template.csv", TEMPLATE_CSV);
}
