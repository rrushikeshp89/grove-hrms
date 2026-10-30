import { db } from "@/lib/db";

/** For uptime checks: confirms the app is up and can reach its database. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { status: "database unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
