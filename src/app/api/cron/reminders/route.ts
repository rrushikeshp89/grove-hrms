import { sendReminders } from "@/features/notifications/reminders";
import { cronAuth } from "@/lib/cron-auth";

/** The nightly reminders job (see vercel.json). Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const auth = cronAuth(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "unconfigured") {
    return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (auth === "denied") return Response.json({ error: "Not allowed." }, { status: 401 });

  const result = await sendReminders();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
