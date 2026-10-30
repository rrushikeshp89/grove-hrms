import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type Client = Pick<Prisma.TransactionClient, "user" | "notification">;

export type NotificationKind =
  "APPROVAL_REQUESTED" | "APPROVAL_DECIDED" | "MENTION" | "REMINDER" | "ANNOUNCEMENT" | "SYSTEM";

export type NotificationDraft = {
  /** Who it's for: an employee (resolved to their sign-in) or, if you have it, the user directly. */
  employeeId?: string | null;
  userId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  /** The user who caused it. They're never notified about their own action. */
  actorUserId?: string | null;
};

/**
 * Writes in-app notifications inside the caller's transaction, so a
 * notification exists exactly when the thing it announces does. People
 * without a sign-in (someone about to start) are skipped, and the same
 * message is never sent to someone twice in one call.
 */
export async function notify(client: Client, drafts: NotificationDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  const employeeIds = [...new Set(drafts.flatMap((d) => (d.employeeId ? [d.employeeId] : [])))];
  const users = employeeIds.length
    ? await client.user.findMany({
        where: { employeeId: { in: employeeIds } },
        select: { id: true, employeeId: true },
      })
    : [];
  const userOf = new Map(users.map((u) => [u.employeeId!, u.id]));

  const seen = new Set<string>();
  const rows: Prisma.NotificationCreateManyInput[] = [];
  for (const d of drafts) {
    const recipientId = d.userId ?? (d.employeeId ? userOf.get(d.employeeId) : undefined);
    if (!recipientId || recipientId === d.actorUserId) continue;
    const key = `${recipientId}|${d.kind}|${d.title}|${d.href ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      recipientId,
      kind: d.kind,
      title: d.title,
      body: d.body ?? null,
      href: d.href ?? null,
      actorId: d.actorUserId ?? null,
    });
  }
  if (rows.length === 0) return 0;
  const { count } = await client.notification.createMany({ data: rows });
  return count;
}
