import "server-only";

import { db, type Prisma } from "@/lib/db";

import { dayRange, domainOf, type AuditFilters } from "./logic";

export const PAGE = 50;

function where(f: AuditFilters): Prisma.AuditLogWhereInput {
  const range = dayRange(f.from, f.to);
  const q = f.q;
  return {
    ...(f.actor ? { actorId: f.actor } : {}),
    ...(f.domain ? { action: { startsWith: `${f.domain}.` } } : {}),
    ...(f.entity ? { entityType: f.entity } : {}),
    ...(range.gte || range.lt ? { createdAt: { gte: range.gte, lt: range.lt } } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { entityId: q },
            { actor: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

const select = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  before: true,
  after: true,
  ip: true,
  userAgent: true,
  createdAt: true,
  actor: { select: { id: true, name: true, role: true } },
} satisfies Prisma.AuditLogSelect;

function shape(r: Prisma.AuditLogGetPayload<{ select: typeof select }>) {
  return {
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    ip: r.ip,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor ? { id: r.actor.id, name: r.actor.name, role: r.actor.role } : null,
  };
}

export type AuditEntry = ReturnType<typeof shape>;

/** One page of the log, newest first. The cursor is the last entry of the previous page. */
export async function auditPage(f: AuditFilters, cursor: string | null) {
  const rows = await db.auditLog.findMany({
    where: where(f),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select,
  });
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  return { entries: page.map(shape), next: more ? page[page.length - 1]!.id : null };
}

/** Up to 5,000 matching entries, for a CSV export. */
export async function auditForExport(f: AuditFilters) {
  const rows = await db.auditLog.findMany({
    where: where(f),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5000,
    select,
  });
  return rows.map(shape);
}

/** What the filter dropdowns can offer: people and areas that actually appear. */
export async function auditOptions() {
  const [actors, actions, entities] = await Promise.all([
    db.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } }, _count: true }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true } }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);
  const users = await db.user.findMany({
    where: { id: { in: actors.map((a) => a.actorId!) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return {
    actors: users,
    domains: [...new Set(actions.map((a) => domainOf(a.action)))].sort(),
    entities: entities.map((e) => e.entityType),
  };
}
