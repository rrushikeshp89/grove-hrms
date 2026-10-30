import "server-only";

import { db } from "@/lib/db";
import type { CurrentUser } from "@/server/session";

export const PAGE_SIZE = 30;

/** This person's notifications, newest first, optionally only the unread ones. */
export async function notificationsFor(
  user: CurrentUser,
  opts: { unreadOnly: boolean; limit: number },
) {
  const where = { recipientId: user.id, ...(opts.unreadOnly ? { readAt: null } : {}) };
  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { recipientId: user.id, readAt: null } }),
  ]);
  return {
    total,
    unread,
    items: rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}
