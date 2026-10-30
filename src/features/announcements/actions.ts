"use server";

import { revalidatePath } from "next/cache";

import { can } from "@/lib/rbac";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { actorOf } from "@/server/session";

import { docToText, inAudience, sanitizeDoc, type Audience } from "./logic/content";
import { announcementIdSchema, announcementSchema, reactionSchema } from "./schemas";

const refresh = () => {
  revalidatePath("/announcements");
  revalidatePath("/home");
};

export const saveAnnouncement = createAction({
  schema: announcementSchema,
  permission: "announcements.publish",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Announcements need an employee record behind them.");
    const body = sanitizeDoc(input.body);
    const text = docToText(body);
    if (text.length < 10) {
      throw new ActionError("Write a little more before publishing.", {
        body: ["Say what you want people to know"],
      });
    }
    const audience: Audience =
      input.departmentIds.length || input.locationIds.length
        ? { departmentIds: input.departmentIds, locationIds: input.locationIds }
        : null;
    const existing = input.id
      ? await tx.announcement.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing) throw new ActionError("That announcement no longer exists.");

    const data = {
      title: input.title,
      body,
      bodyText: text,
      audience: audience ?? undefined,
      pinned: input.pinned,
      // Publishing sets the time once; editing a published post keeps it.
      publishedAt: input.publish ? (existing?.publishedAt ?? new Date()) : null,
    };
    const saved = existing
      ? await tx.announcement.update({
          where: { id: existing.id },
          data: { ...data, audience: audience ?? { departmentIds: [], locationIds: [] } },
        })
      : await tx.announcement.create({ data: { ...data, authorId: me } });
    audit({
      action: existing ? "announcement.update" : "announcement.create",
      entityType: "Announcement",
      entityId: saved.id,
      after: { title: saved.title, published: !!saved.publishedAt, pinned: saved.pinned },
    });
    refresh();
    return { id: saved.id, published: !!saved.publishedAt };
  },
});

/** Adds or removes the viewer's reaction. Returns the new state so the UI can settle. */
export const toggleReaction = createAction({
  schema: reactionSchema,
  handler: async ({ input, user, tx }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Reactions need an employee record behind them.");
    const a = await tx.announcement.findUnique({
      where: { id: input.announcementId },
      select: { id: true, audience: true, publishedAt: true },
    });
    if (!a || !a.publishedAt) throw new ActionError("That announcement isn't available.");
    const key = {
      announcementId_employeeId_kind: { announcementId: a.id, employeeId: me, kind: input.kind },
    };
    const had = await tx.announcementReaction.findUnique({ where: key });
    if (had) await tx.announcementReaction.delete({ where: key });
    else
      await tx.announcementReaction.create({
        data: { announcementId: a.id, employeeId: me, kind: input.kind },
      });
    return { on: !had };
  },
});

/**
 * Records that someone has read an announcement. Anything that stops it
 * (not in the audience, not published) is a quiet no-op rather than an error,
 * because failing to record a read should never get in the way of reading.
 */
export const markRead = createAction({
  schema: announcementIdSchema,
  handler: async ({ input, user, tx }) => {
    const me = user.employee?.id;
    if (!me) return { recorded: false };
    const [a, person] = await Promise.all([
      tx.announcement.findUnique({
        where: { id: input.announcementId },
        select: { id: true, audience: true, publishedAt: true },
      }),
      tx.employee.findUnique({
        where: { id: me },
        select: { departmentId: true, locationId: true },
      }),
    ]);
    if (!a?.publishedAt || !person) return { recorded: false };
    const audience = (
      a.audience && typeof a.audience === "object" && !Array.isArray(a.audience) ? a.audience : null
    ) as Audience;
    if (!can(actorOf(user), "announcements.publish") && !inAudience(person, audience)) {
      return { recorded: false };
    }
    await tx.announcementRead.upsert({
      where: { announcementId_employeeId: { announcementId: a.id, employeeId: me } },
      create: { announcementId: a.id, employeeId: me },
      update: {},
    });
    return { recorded: true };
  },
});

export const deleteAnnouncement = createAction({
  schema: announcementIdSchema,
  permission: "announcements.publish",
  handler: async ({ input, tx, audit }) => {
    const a = await tx.announcement.findUnique({
      where: { id: input.announcementId },
      select: { id: true, title: true },
    });
    if (!a) return { deleted: false };
    await tx.announcement.delete({ where: { id: a.id } });
    audit({
      action: "announcement.delete",
      entityType: "Announcement",
      entityId: a.id,
      before: { title: a.title },
    });
    refresh();
    return { deleted: true };
  },
});

/** For publishers: the people in the audience who haven't opened it yet. */
export const whoHasntRead = createAction({
  schema: announcementIdSchema,
  permission: "announcements.publish",
  handler: async ({ input, tx }) => {
    const a = await tx.announcement.findUnique({
      where: { id: input.announcementId },
      select: { audience: true },
    });
    if (!a) throw new ActionError("That announcement no longer exists.");
    const audience = (
      a.audience && typeof a.audience === "object" && !Array.isArray(a.audience) ? a.audience : null
    ) as Audience;
    const people = await tx.employee.findMany({
      where: {
        status: { not: "EXITED" },
        reads: { none: { announcementId: input.announcementId } },
        ...(audience?.departmentIds?.length
          ? { departmentId: { in: audience.departmentIds } }
          : {}),
        ...(audience?.locationIds?.length ? { locationId: { in: audience.locationIds } } : {}),
      },
      orderBy: { firstName: "asc" },
      select: { firstName: true, lastName: true, preferredName: true },
      take: 200,
    });
    return { names: people.map((p) => `${p.preferredName ?? p.firstName} ${p.lastName}`) };
  },
});
