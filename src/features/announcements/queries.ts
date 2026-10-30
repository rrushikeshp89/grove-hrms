import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, type CurrentUser } from "@/server/session";

import {
  inAudience,
  previewText,
  sanitizeDoc,
  type Audience,
  type Doc,
  type ReactionKind,
} from "./logic/content";

const nameOf = (p: { firstName: string; lastName: string; preferredName?: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const select = {
  id: true,
  title: true,
  body: true,
  audience: true,
  pinned: true,
  publishedAt: true,
  authorId: true,
  author: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      avatarUrl: true,
      designation: { select: { title: true } },
    },
  },
  reactions: { select: { employeeId: true, kind: true } },
  reads: { select: { employeeId: true } },
} satisfies Prisma.AnnouncementSelect;

type Row = Prisma.AnnouncementGetPayload<{ select: typeof select }>;

const audienceOf = (a: Prisma.JsonValue): Audience =>
  a && typeof a === "object" && !Array.isArray(a) ? (a as Audience) : null;

/** Who the viewer is, for audience matching and "mine" flags. */
async function viewerContext(user: CurrentUser) {
  const me = user.employee?.id ?? null;
  const person = me
    ? await db.employee.findUnique({
        where: { id: me },
        select: { departmentId: true, locationId: true },
      })
    : null;
  return { me, person, publisher: can(actorOf(user), "announcements.publish") };
}

/** How many people an audience reaches today. */
async function audienceSize(audience: Audience) {
  return db.employee.count({
    where: {
      status: { not: "EXITED" },
      ...(audience?.departmentIds?.length ? { departmentId: { in: audience.departmentIds } } : {}),
      ...(audience?.locationIds?.length ? { locationId: { in: audience.locationIds } } : {}),
    },
  });
}

export async function audienceLabels(audience: Audience): Promise<string[]> {
  if (!audience || (!audience.departmentIds?.length && !audience.locationIds?.length)) return [];
  const [d, l] = await Promise.all([
    audience.departmentIds?.length
      ? db.department.findMany({
          where: { id: { in: audience.departmentIds } },
          select: { name: true },
        })
      : [],
    audience.locationIds?.length
      ? db.location.findMany({
          where: { id: { in: audience.locationIds } },
          select: { name: true },
        })
      : [],
  ]);
  return [...d.map((x) => x.name), ...l.map((x) => x.name)];
}

async function shape(r: Row, ctx: Awaited<ReturnType<typeof viewerContext>>) {
  const audience = audienceOf(r.audience);
  const counts: Record<string, number> = {};
  for (const x of r.reactions) counts[x.kind] = (counts[x.kind] ?? 0) + 1;
  const audienceNames = await audienceLabels(audience);
  return {
    id: r.id,
    title: r.title,
    body: sanitizeDoc(r.body),
    pinned: r.pinned,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    author: {
      id: r.authorId,
      name: nameOf(r.author),
      avatarUrl: r.author.avatarUrl,
      title: r.author.designation.title,
    },
    audience: audienceNames,
    reactions: counts as Partial<Record<ReactionKind, number>>,
    mine: r.reactions.filter((x) => x.employeeId === ctx.me).map((x) => x.kind as ReactionKind),
    read: !!ctx.me && r.reads.some((x) => x.employeeId === ctx.me),
    stats: ctx.publisher
      ? { readCount: r.reads.length, audienceSize: await audienceSize(audience) }
      : null,
  };
}

export type AnnouncementCard = Awaited<ReturnType<typeof shape>>;

/** Published announcements this person is in the audience for, pinned first. */
export async function feed(user: CurrentUser, take = 30) {
  const ctx = await viewerContext(user);
  const rows = await db.announcement.findMany({
    where: { publishedAt: { not: null, lte: new Date() } },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: take * 2,
    select,
  });
  const visible = rows
    .filter((r) => ctx.publisher || (ctx.person && inAudience(ctx.person, audienceOf(r.audience))))
    .slice(0, take);
  return Promise.all(visible.map((r) => shape(r, ctx)));
}

/** Unpublished drafts, for people who can publish. */
export async function drafts(user: CurrentUser) {
  const ctx = await viewerContext(user);
  if (!ctx.publisher) return [];
  const rows = await db.announcement.findMany({
    where: { publishedAt: null },
    orderBy: { updatedAt: "desc" },
    select,
  });
  return Promise.all(rows.map((r) => shape(r, ctx)));
}

/** The newest few for Home, with unread flagged. */
export async function latestForHome(user: CurrentUser, take = 3) {
  const items = await feed(user, take);
  const unread = items.filter((i) => !i.read).length;
  return {
    unread,
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      preview: previewText(i.body as Doc, 110),
      pinned: i.pinned,
      read: i.read,
      publishedAt: i.publishedAt,
      author: i.author.name,
    })),
  };
}

/** One announcement for the editor, only for people who can publish. */
export async function forEditing(user: CurrentUser, id: string) {
  const ctx = await viewerContext(user);
  if (!ctx.publisher) return null;
  const r = await db.announcement.findUnique({ where: { id }, select });
  if (!r) return null;
  const audience = audienceOf(r.audience);
  return {
    id: r.id,
    title: r.title,
    body: sanitizeDoc(r.body),
    pinned: r.pinned,
    published: !!r.publishedAt,
    departmentIds: audience?.departmentIds ?? [],
    locationIds: audience?.locationIds ?? [],
  };
}

export async function audienceOptions() {
  const [departments, locations] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { departments, locations };
}
