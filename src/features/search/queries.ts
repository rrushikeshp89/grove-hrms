import "server-only";

import { inAudience, type Audience } from "@/features/announcements/logic/content";
import { canSeeDocument, type Visibility } from "@/features/documents/logic/rules";
import { searchPeople } from "@/features/people/queries";
import { db, type Prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { visibleEmployeeIds } from "@/server/authz";
import { actorOf, type CurrentUser } from "@/server/session";

export type HitKind = "person" | "job" | "candidate" | "announcement" | "policy" | "goal";

export type SearchHit = {
  kind: HitKind;
  id: string;
  title: string;
  detail: string;
  href: string;
  /** People only. */
  code?: string;
  avatarUrl?: string | null;
};

const PER_KIND = 4;

/** Up to five words, each of which has to turn up somewhere in the record. */
const words = (q: string) => q.trim().slice(0, 60).split(/\s+/).filter(Boolean).slice(0, 5);

const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

const nameOf = (p: { firstName: string; lastName: string; preferredName?: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

async function jobs(user: CurrentUser, terms: string[]): Promise<SearchHit[]> {
  if (!can(actorOf(user), "recruitment.read")) return [];
  const rows = await db.jobPosting.findMany({
    where: {
      AND: terms.map((t) => ({
        OR: [
          { title: { contains: t, mode: "insensitive" } },
          { department: { name: { contains: t, mode: "insensitive" } } },
        ],
      })),
    },
    orderBy: { updatedAt: "desc" },
    take: PER_KIND,
    select: { id: true, title: true, status: true, department: { select: { name: true } } },
  });
  return rows.map((j) => ({
    kind: "job",
    id: j.id,
    title: j.title,
    detail: `${j.department.name} · ${sentence(j.status)}`,
    href: `/hiring/${j.id}`,
  }));
}

async function candidates(user: CurrentUser, terms: string[]): Promise<SearchHit[]> {
  if (!can(actorOf(user), "recruitment.read")) return [];
  const rows = await db.candidate.findMany({
    where: {
      AND: terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: "insensitive" } },
          { lastName: { contains: t, mode: "insensitive" } },
          { email: { contains: t, mode: "insensitive" } },
          { job: { title: { contains: t, mode: "insensitive" } } },
        ],
      })),
    },
    orderBy: { updatedAt: "desc" },
    take: PER_KIND,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stage: true,
      job: { select: { title: true } },
    },
  });
  return rows.map((c) => ({
    kind: "candidate",
    id: c.id,
    title: `${c.firstName} ${c.lastName}`,
    detail: `${c.job.title} · ${sentence(c.stage)}`,
    href: `/hiring/candidates/${c.id}`,
  }));
}

async function announcements(user: CurrentUser, terms: string[]): Promise<SearchHit[]> {
  const publisher = can(actorOf(user), "announcements.publish");
  const me = user.employee?.id;
  const person = me
    ? await db.employee.findUnique({
        where: { id: me },
        select: { departmentId: true, locationId: true },
      })
    : null;
  if (!publisher && !person) return [];
  const rows = await db.announcement.findMany({
    where: {
      publishedAt: { not: null, lte: new Date() },
      AND: terms.map((t) => ({
        OR: [
          { title: { contains: t, mode: "insensitive" } },
          { bodyText: { contains: t, mode: "insensitive" } },
        ],
      })),
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    // Audience is a JSON rule, so over-fetch a little and filter here.
    take: PER_KIND * 3,
    select: {
      id: true,
      title: true,
      audience: true,
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  return rows
    .filter((r) => {
      if (publisher) return true;
      const a = r.audience;
      const audience: Audience =
        a && typeof a === "object" && !Array.isArray(a) ? (a as Audience) : null;
      return person ? inAudience(person, audience) : false;
    })
    .slice(0, PER_KIND)
    .map((r) => ({
      kind: "announcement",
      id: r.id,
      title: r.title,
      detail: `Announcement · ${nameOf(r.author)}`,
      href: `/announcements#a-${r.id}`,
    }));
}

async function policies(user: CurrentUser, terms: string[]): Promise<SearchHit[]> {
  const rows = await db.document.findMany({
    where: {
      ownerEmployeeId: null,
      category: "POLICY",
      AND: terms.map((t) => ({ title: { contains: t, mode: "insensitive" } })),
    },
    orderBy: { title: "asc" },
    take: PER_KIND * 2,
    select: { id: true, title: true, visibility: true, uploadedById: true },
  });
  const viewer = {
    employeeId: user.employee?.id ?? null,
    manage: can(actorOf(user), "documents.manage"),
  };
  return rows
    .filter((r) =>
      canSeeDocument(viewer, {
        ownerEmployeeId: null,
        visibility: r.visibility as Visibility,
        uploadedById: r.uploadedById,
      }),
    )
    .slice(0, PER_KIND)
    .map((r) => ({
      kind: "policy",
      id: r.id,
      title: r.title,
      detail: "Company policy",
      href: "/documents?view=policies",
    }));
}

async function goals(user: CurrentUser, terms: string[]): Promise<SearchHit[]> {
  if (!can(actorOf(user), "performance.read")) return [];
  const me = user.employee?.id ?? null;
  const ids = await visibleEmployeeIds(user, "performance.read");
  // The same rule as opening a goal: company goals, your own, and your reports'.
  const visible: Prisma.GoalWhereInput =
    ids === "all" ? {} : { OR: [{ ownerId: null }, { ownerId: { in: me ? [...ids, me] : ids } }] };
  const rows = await db.goal.findMany({
    where: {
      AND: [
        visible,
        ...terms.map((t) => ({ title: { contains: t, mode: "insensitive" } as const })),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: PER_KIND,
    select: {
      id: true,
      title: true,
      progress: true,
      owner: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  return rows.map((g) => ({
    kind: "goal",
    id: g.id,
    title: g.title,
    detail: `${g.owner ? nameOf(g.owner) : "Company goal"} · ${g.progress}%`,
    href: `/performance/goals/${g.id}`,
  }));
}

/**
 * One search across what this person can open: colleagues, hiring, news,
 * policies and goals. Each source applies the same visibility rule as its own
 * page, so a hit never reveals a record the page would refuse.
 */
export async function searchAll(user: CurrentUser, q: string): Promise<SearchHit[]> {
  const terms = words(q);
  if (terms.length === 0 || terms.join(" ").length < 2) return [];
  const [people, j, c, a, p, g] = await Promise.all([
    searchPeople(terms.join(" "), 5),
    jobs(user, terms),
    candidates(user, terms),
    announcements(user, terms),
    policies(user, terms),
    goals(user, terms),
  ]);
  const hits: SearchHit[] = people.map((e) => ({
    kind: "person",
    id: e.id,
    title: nameOf(e),
    detail: `${e.designation.title} · ${e.department.name}`,
    href: `/people/${e.id}`,
    code: e.employeeCode,
    avatarUrl: e.avatarUrl,
  }));
  return [...hits, ...j, ...c, ...a, ...g, ...p];
}
