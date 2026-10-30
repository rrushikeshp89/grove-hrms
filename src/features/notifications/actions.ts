"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { createAction } from "@/server/action";
import { getCurrentUser } from "@/server/session";

const shape = (n: {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  href: n.href,
  read: !!n.readAt,
  createdAt: n.createdAt.toISOString(),
});

export type NotificationItem = ReturnType<typeof shape>;

/**
 * The bell's data: the newest few and how many are unread. A read, so it
 * isn't wrapped in the mutation pipeline, but it still answers only for the
 * signed-in person.
 */
export async function loadNotifications(
  take = 8,
): Promise<{ unread: number; items: NotificationItem[] }> {
  const user = await getCurrentUser();
  if (!user) return { unread: 0, items: [] };
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { recipientId: user.id, readAt: null } }),
    db.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, take), 30),
    }),
  ]);
  return { unread, items: rows.map(shape) };
}

const idsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

export const markNotificationsRead = createAction({
  schema: idsSchema,
  handler: async ({ input, user, tx }) => {
    const { count } = await tx.notification.updateMany({
      where: { id: { in: input.ids }, recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return { marked: count };
  },
});

export const markNotificationUnread = createAction({
  schema: z.object({ id: z.string().min(1) }),
  handler: async ({ input, user, tx }) => {
    await tx.notification.updateMany({
      where: { id: input.id, recipientId: user.id },
      data: { readAt: null },
    });
    revalidatePath("/notifications");
    return { ok: true };
  },
});

export const markAllNotificationsRead = createAction({
  schema: z.object({}),
  handler: async ({ user, tx }) => {
    const { count } = await tx.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/notifications");
    return { marked: count };
  },
});
