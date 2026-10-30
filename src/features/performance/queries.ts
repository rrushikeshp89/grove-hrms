import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { isoFromDbDate, todayIn } from "@/lib/tz";
import { visibleEmployeeIds } from "@/server/authz";
import { actorOf, type CurrentUser } from "@/server/session";

import {
  QUESTIONS,
  canWriteReview,
  keyResultPercent,
  ratingGap,
  ratingSummary,
  resultsShared,
  type CycleStatus,
  type GoalStatus,
  type ReviewKind,
} from "./logic/goals";

const nameOf = (p: { firstName: string; lastName: string; preferredName?: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  designation: { select: { title: true } },
} as const;

type PersonRow = Prisma.EmployeeGetPayload<{ select: typeof personSelect }>;
const person = (p: PersonRow) => ({
  id: p.id,
  name: nameOf(p),
  avatarUrl: p.avatarUrl,
  title: p.designation.title,
});

/* ─── Goals ────────────────────────────────────────────────────────────── */

const goalSelect = {
  id: true,
  title: true,
  status: true,
  progress: true,
  dueDate: true,
  ownerId: true,
  owner: { select: personSelect },
  parent: { select: { id: true, title: true } },
  keyResults: { select: { startValue: true, targetValue: true, currentValue: true } },
  cycle: { select: { name: true } },
  _count: { select: { children: true } },
} satisfies Prisma.GoalSelect;

type GoalRow = Prisma.GoalGetPayload<{ select: typeof goalSelect }>;

const shapeGoal = (g: GoalRow) => ({
  id: g.id,
  title: g.title,
  status: g.status as GoalStatus,
  progress: g.progress,
  dueDate: g.dueDate ? isoFromDbDate(g.dueDate) : null,
  owner: g.owner ? person(g.owner) : null,
  parent: g.parent,
  keyResultCount: g.keyResults.length,
  keyResultsDone: g.keyResults.filter((k) => keyResultPercent(k) >= 100).length,
  alignedCount: g._count.children,
  cycle: g.cycle?.name ?? null,
});

export type GoalCard = ReturnType<typeof shapeGoal>;

export type GoalView = "mine" | "team" | "company";

/** Open goals first, soonest due first; finished goals trail behind. */
const byUrgency = (a: GoalCard, b: GoalCard) =>
  Number(a.status === "DONE") - Number(b.status === "DONE") ||
  (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
  a.title.localeCompare(b.title);

export async function goalsFor(user: CurrentUser, view: GoalView) {
  const me = user.employee?.id ?? "-";
  let where: Prisma.GoalWhereInput;
  if (view === "mine") where = { ownerId: me };
  else if (view === "company") where = { ownerId: null };
  else {
    const ids = await visibleEmployeeIds(user, "performance.read");
    where =
      ids === "all" ? { ownerId: { not: me } } : { ownerId: { in: ids.filter((i) => i !== me) } };
    if (ids !== "all" && ids.length <= 1) return [];
    where = { AND: [where, { ownerId: { not: null } }] };
  }
  const rows = await db.goal.findMany({ where, select: goalSelect, take: 200 });
  return rows.map(shapeGoal).sort(byUrgency);
}

/** A goal with its key results and history, or null when this person can't see it. */
export async function goalDetail(user: CurrentUser, id: string) {
  const g = await db.goal.findUnique({
    where: { id },
    select: {
      ...goalSelect,
      description: true,
      createdAt: true,
      keyResults: { orderBy: { createdAt: "asc" } },
      checkIns: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          progress: true,
          note: true,
          createdAt: true,
          author: { select: personSelect },
        },
      },
      children: {
        select: goalSelect,
        orderBy: { title: "asc" },
      },
    },
  });
  if (!g) return null;
  const actor = actorOf(user);
  const me = user.employee?.id ?? null;
  const manageCompany = can(actor, "performance.manageCycles");
  const ids = g.ownerId ? await visibleEmployeeIds(user, "performance.read") : "all";
  const visible = !g.ownerId || ids === "all" || g.ownerId === me || ids.includes(g.ownerId);
  if (!visible) return null;
  const mine = !!me && g.ownerId === me;
  return {
    ...shapeGoal(g),
    description: g.description,
    keyResults: g.keyResults.map((k) => ({
      id: k.id,
      title: k.title,
      startValue: k.startValue,
      targetValue: k.targetValue,
      currentValue: k.currentValue,
      unit: k.unit,
      percent: keyResultPercent(k),
    })),
    checkIns: g.checkIns.map((c) => ({
      id: c.id,
      progress: c.progress,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
      author: person(c.author),
    })),
    aligned: g.children.map(shapeGoal),
    startDate: isoFromDbDate(g.createdAt),
    canEdit: mine || (!g.ownerId && manageCompany),
    isCompany: !g.ownerId,
  };
}

export type GoalDetail = NonNullable<Awaited<ReturnType<typeof goalDetail>>>;

/** Goals someone could align a new goal to: company goals and their manager's. */
export async function parentOptions(user: CurrentUser) {
  const managerId = user.employee
    ? (
        await db.employee.findUnique({
          where: { id: user.employee.id },
          select: { managerId: true },
        })
      )?.managerId
    : null;
  const rows = await db.goal.findMany({
    where: {
      OR: [{ ownerId: null }, ...(managerId ? [{ ownerId: managerId }] : [])],
      status: { not: "DONE" },
    },
    orderBy: [{ ownerId: "asc" }, { title: "asc" }],
    select: { id: true, title: true, ownerId: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, company: !r.ownerId }));
}

/* ─── Cycles ───────────────────────────────────────────────────────────── */

export async function cycles() {
  const rows = await db.reviewCycle.findMany({
    orderBy: { periodStart: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      selfReviewDue: true,
      managerReviewDue: true,
      reviews: { select: { kind: true, status: true } },
    },
  });
  return rows.map((c) => {
    const count = (kind: ReviewKind) => {
      const r = c.reviews.filter((x) => x.kind === kind);
      return { done: r.filter((x) => x.status === "SUBMITTED").length, total: r.length };
    };
    return {
      id: c.id,
      name: c.name,
      status: c.status as CycleStatus,
      periodStart: isoFromDbDate(c.periodStart),
      periodEnd: isoFromDbDate(c.periodEnd),
      selfReviewDue: c.selfReviewDue ? isoFromDbDate(c.selfReviewDue) : null,
      managerReviewDue: c.managerReviewDue ? isoFromDbDate(c.managerReviewDue) : null,
      self: count("SELF"),
      manager: count("MANAGER"),
      peer: count("PEER"),
    };
  });
}

export type CycleRow = Awaited<ReturnType<typeof cycles>>[number];

/** The cycle people are working in now, if one is running. */
export async function runningCycle() {
  const c = await db.reviewCycle.findFirst({
    where: { status: { in: ["SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATION"] } },
    orderBy: { periodStart: "desc" },
    select: { id: true, name: true, status: true, selfReviewDue: true, managerReviewDue: true },
  });
  return c
    ? {
        id: c.id,
        name: c.name,
        status: c.status as CycleStatus,
        selfReviewDue: c.selfReviewDue ? isoFromDbDate(c.selfReviewDue) : null,
        managerReviewDue: c.managerReviewDue ? isoFromDbDate(c.managerReviewDue) : null,
      }
    : null;
}

/* ─── Reviews ──────────────────────────────────────────────────────────── */

/** Everything this person has been asked to write, in cycles that are still running. */
export async function myReviewTasks(user: CurrentUser) {
  const me = user.employee?.id;
  if (!me) return [];
  const rows = await db.review.findMany({
    where: {
      reviewerId: me,
      cycle: { status: { in: ["SELF_REVIEW", "MANAGER_REVIEW", "CALIBRATION"] } },
    },
    select: {
      id: true,
      kind: true,
      status: true,
      cycle: { select: { name: true, status: true, selfReviewDue: true, managerReviewDue: true } },
      reviewee: { select: personSelect },
      feedback: { select: { status: true } },
    },
  });
  const order = { SELF: 0, MANAGER: 1, PEER: 2 } as const;
  return rows
    .filter((r) => r.feedback?.status !== "DECLINED")
    .map((r) => ({
      id: r.id,
      kind: r.kind as ReviewKind,
      status: r.status,
      cycle: r.cycle.name,
      cycleStatus: r.cycle.status as CycleStatus,
      due:
        r.kind === "MANAGER"
          ? r.cycle.managerReviewDue
            ? isoFromDbDate(r.cycle.managerReviewDue)
            : null
          : r.cycle.selfReviewDue
            ? isoFromDbDate(r.cycle.selfReviewDue)
            : null,
      writable:
        canWriteReview(r.kind as ReviewKind, r.cycle.status as CycleStatus) &&
        r.status !== "SUBMITTED",
      reviewee: person(r.reviewee),
      isSelf: r.kind === "SELF",
    }))
    .sort(
      (a, b) => order[a.kind] - order[b.kind] || a.reviewee.name.localeCompare(b.reviewee.name),
    );
}

export type ReviewTask = Awaited<ReturnType<typeof myReviewTasks>>[number];

/** Results about me from closed cycles, with peer feedback unattributed. */
export async function resultsAboutMe(user: CurrentUser) {
  const me = user.employee?.id;
  if (!me) return [];
  const rows = await db.review.findMany({
    where: { revieweeId: me, status: "SUBMITTED", cycle: { status: "CLOSED" } },
    orderBy: { cycle: { periodEnd: "desc" } },
    select: {
      id: true,
      kind: true,
      answers: true,
      overallRating: true,
      cycle: { select: { id: true, name: true, periodEnd: true } },
      reviewer: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });
  const byCycle = new Map<
    string,
    {
      cycle: string;
      end: string;
      self: number | null;
      manager: number | null;
      managerName: string | null;
      managerAnswers: Record<string, string> | null;
      peers: { id: string; answers: Record<string, string>; rating: number | null }[];
      selfId: string | null;
    }
  >();
  for (const r of rows) {
    const c = byCycle.get(r.cycle.id) ?? {
      cycle: r.cycle.name,
      end: isoFromDbDate(r.cycle.periodEnd),
      self: null,
      manager: null,
      managerName: null,
      managerAnswers: null,
      peers: [],
      selfId: null,
    };
    const answers = (r.answers ?? {}) as Record<string, string>;
    if (r.kind === "SELF") {
      c.self = r.overallRating;
      c.selfId = r.id;
    } else if (r.kind === "MANAGER") {
      c.manager = r.overallRating;
      c.managerName = nameOf(r.reviewer);
      c.managerAnswers = answers;
    } else c.peers.push({ id: r.id, answers, rating: r.overallRating });
    byCycle.set(r.cycle.id, c);
  }
  return [...byCycle.values()].map((c) => ({ ...c, gap: ratingGap(c.self, c.manager) }));
}

export type CycleResult = Awaited<ReturnType<typeof resultsAboutMe>>[number];

/** One review, shaped for the form or the read-only view, or null when it isn't this person's to see. */
export async function reviewDetail(user: CurrentUser, id: string) {
  const r = await db.review.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      status: true,
      answers: true,
      overallRating: true,
      submittedAt: true,
      reviewerId: true,
      revieweeId: true,
      cycle: { select: { id: true, name: true, status: true } },
      reviewee: { select: { ...personSelect, managerId: true } },
      reviewer: { select: personSelect },
      feedback: { select: { status: true } },
    },
  });
  if (!r) return null;
  const me = user.employee?.id ?? null;
  const actor = actorOf(user);
  const status = r.cycle.status as CycleStatus;
  const kind = r.kind as ReviewKind;
  const isReviewer = !!me && r.reviewerId === me;
  const isSubject = !!me && r.revieweeId === me;
  const hr = can(actor, "performance.manageCycles");
  const ids = await visibleEmployeeIds(user, "performance.read");
  const manages = !isSubject && ids !== "all" && ids.includes(r.revieweeId);
  const submitted = r.status === "SUBMITTED";
  const beyondWriting = status === "CALIBRATION" || status === "CLOSED";
  // Who can read it: the author always; the subject once results are shared (their own self review any time);
  // managers and the people team once it's submitted and the cycle has moved on.
  const canRead =
    isReviewer ||
    (isSubject && kind === "SELF") ||
    (isSubject && resultsShared(status) && submitted) ||
    ((hr || manages || ids === "all") &&
      submitted &&
      (beyondWriting || (kind === "SELF" && status === "MANAGER_REVIEW")));
  if (!canRead) return null;
  const editable = isReviewer && !submitted && canWriteReview(kind, status);
  return {
    id: r.id,
    kind,
    status: r.status,
    cycle: r.cycle.name,
    cycleStatus: status,
    editable,
    reviewee: person(r.reviewee),
    reviewer: person(r.reviewer),
    isSubject,
    // Peer feedback shown to its subject doesn't say who wrote it.
    anonymous: kind === "PEER" && isSubject,
    answers: (r.answers ?? {}) as Record<string, string>,
    rating: r.overallRating,
    questions: QUESTIONS[kind],
    submittedAt: r.submittedAt?.toISOString() ?? null,
  };
}

export type ReviewDetail = NonNullable<Awaited<ReturnType<typeof reviewDetail>>>;

/* ─── A cycle across people ────────────────────────────────────────────── */

/**
 * One row per person this viewer can see in a cycle, with where each of
 * their reviews stands. Ratings follow the visibility rules: managers see
 * their own and their reports' self ratings once submitted; the people team
 * sees everything from calibration onward.
 */
export async function cycleOverview(user: CurrentUser, cycleId: string) {
  const cycle = await db.reviewCycle.findUnique({
    where: { id: cycleId },
    select: {
      id: true,
      name: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      selfReviewDue: true,
      managerReviewDue: true,
    },
  });
  if (!cycle) return null;
  const me = user.employee?.id ?? null;
  const hr = can(actorOf(user), "performance.manageCycles");
  const ids = await visibleEmployeeIds(user, "performance.read");
  const status = cycle.status as CycleStatus;
  const scope: Prisma.ReviewWhereInput =
    ids === "all" ? {} : { revieweeId: { in: ids.filter((i) => i !== me) } };
  const reviews = await db.review.findMany({
    where: { cycleId, ...scope },
    select: {
      id: true,
      kind: true,
      status: true,
      overallRating: true,
      revieweeId: true,
      reviewer: { select: { firstName: true, lastName: true, preferredName: true } },
      reviewee: { select: { ...personSelect, department: { select: { name: true } } } },
    },
  });
  const people = new Map<
    string,
    {
      person: ReturnType<typeof person> & { department: string };
      self?: { id: string; status: string; rating: number | null };
      manager?: { id: string; status: string; rating: number | null; reviewer: string };
      peers: { id: string; status: string }[];
    }
  >();
  for (const r of reviews) {
    const p = people.get(r.revieweeId) ?? {
      person: { ...person(r.reviewee), department: r.reviewee.department.name },
      peers: [],
    };
    const submitted = r.status === "SUBMITTED";
    if (r.kind === "SELF") {
      const showRating = submitted && (hr || status !== "SELF_REVIEW");
      p.self = { id: r.id, status: r.status, rating: showRating ? r.overallRating : null };
    } else if (r.kind === "MANAGER") {
      const showRating =
        submitted && (hr ? status === "CALIBRATION" || status === "CLOSED" : false);
      p.manager = {
        id: r.id,
        status: r.status,
        rating: showRating ? r.overallRating : null,
        reviewer: nameOf(r.reviewer),
      };
    } else p.peers.push({ id: r.id, status: r.status });
    people.set(r.revieweeId, p);
  }
  const rows = [...people.entries()]
    .map(([id, p]) => ({
      id,
      ...p,
      gap: ratingGap(p.self?.rating ?? null, p.manager?.rating ?? null),
    }))
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
  const shown = hr && (status === "CALIBRATION" || status === "CLOSED");
  return {
    id: cycle.id,
    name: cycle.name,
    status,
    periodStart: isoFromDbDate(cycle.periodStart),
    periodEnd: isoFromDbDate(cycle.periodEnd),
    selfReviewDue: cycle.selfReviewDue ? isoFromDbDate(cycle.selfReviewDue) : null,
    managerReviewDue: cycle.managerReviewDue ? isoFromDbDate(cycle.managerReviewDue) : null,
    manageCycle: hr,
    rows,
    ratings: shown
      ? {
          self: ratingSummary(rows.map((r) => r.self?.rating ?? null)),
          manager: ratingSummary(rows.map((r) => r.manager?.rating ?? null)),
        }
      : null,
    today: todayIn(),
  };
}

export type CycleOverview = NonNullable<Awaited<ReturnType<typeof cycleOverview>>>;
export type OverviewRow = CycleOverview["rows"][number];

/** Everyone currently employed, for picking who to ask for peer feedback. */
export async function colleagues() {
  const rows = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    orderBy: { firstName: "asc" },
    select: personSelect,
  });
  return rows.map(person);
}
