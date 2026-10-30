import { timingSafeEqual } from "node:crypto";

/**
 * Scheduled jobs are plain HTTP routes, so they need a shared secret. Vercel
 * Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 * With no secret configured the job is off, never open.
 */
export function cronAuth(
  header: string | null,
  secret: string | undefined,
): "ok" | "unconfigured" | "denied" {
  if (!secret || secret.length < 16) return "unconfigured";
  const given = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? "ok" : "denied";
}
