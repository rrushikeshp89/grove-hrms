/**
 * Performance history: company, team and personal goals with key results and
 * check-ins; a closed H1 2026 cycle with every review submitted; and H2 2026
 * part way through its self-review phase, so there's real work to do.
 */
import { randomUUID } from "node:crypto";

import {
  QUESTIONS,
  goalProgress,
  suggestStatus,
  type ReviewKind,
} from "../../src/features/performance/logic/goals";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { addDays, dbDate, instantAt, isoFromDbDate, type ISODate } from "../../src/lib/tz";
import type { Rng } from "./rng";

type KR = { title: string; start: number; target: number; unit: string | null };
type Template = { title: string; why: string; krs: KR[] };

const COMPANY: (Template & { dept: string[] })[] = [
  {
    title: "Reach 99.9% platform uptime",
    why: "Customers judge us by the days things break. Fewer, shorter incidents buys trust.",
    dept: ["ENG"],
    krs: [
      { title: "Monthly uptime", start: 99.2, target: 99.9, unit: "%" },
      { title: "Incidents over 30 minutes per month", start: 5, target: 1, unit: null },
    ],
  },
  {
    title: "Grow annual recurring revenue by 30%",
    why: "Growth pays for everything else we want to do, including the hiring plan.",
    dept: ["SAL", "CS", "PRD", "FIN"],
    krs: [
      { title: "ARR", start: 42, target: 55, unit: "₹ cr" },
      { title: "New enterprise customers", start: 0, target: 12, unit: null },
    ],
  },
  {
    title: "Make Grove the best place to grow",
    why: "People who grow here stay here, and bring their friends.",
    dept: ["PPL", "DES", "LDR"],
    krs: [
      { title: "Employee NPS", start: 32, target: 50, unit: null },
      { title: "Roles filled by internal moves", start: 8, target: 15, unit: "%" },
      { title: "Regretted attrition", start: 14, target: 8, unit: "%" },
    ],
  },
];

const BY_DEPT: Record<string, Template[]> = {
  ENG: [
    {
      title: "Cut p95 page load below one second",
      why: "Slow pages are the top complaint in support.",
      krs: [
        { title: "p95 page load", start: 2400, target: 1000, unit: "ms" },
        { title: "Pages over budget", start: 18, target: 3, unit: null },
      ],
    },
    {
      title: "Raise test coverage on core services",
      why: "Fewer regressions, faster releases.",
      krs: [
        { title: "Line coverage", start: 52, target: 75, unit: "%" },
        { title: "Flaky tests", start: 40, target: 5, unit: null },
      ],
    },
    {
      title: "Ship the new billing API",
      why: "Unblocks usage-based pricing for sales.",
      krs: [
        { title: "Endpoints migrated", start: 0, target: 14, unit: null },
        { title: "Billing errors per week", start: 22, target: 4, unit: null },
      ],
    },
    {
      title: "Make on-call humane",
      why: "Burnout is a reliability risk.",
      krs: [
        { title: "Pages per week", start: 14, target: 4, unit: null },
        { title: "Runbooks written", start: 3, target: 20, unit: null },
      ],
    },
  ],
  PRD: [
    {
      title: "Launch self-serve onboarding",
      why: "Sales shouldn't be a gate for small teams.",
      krs: [
        { title: "Launch milestones done", start: 0, target: 6, unit: null },
        { title: "Week-4 activation", start: 31, target: 45, unit: "%" },
      ],
    },
    {
      title: "Talk to customers every week",
      why: "Roadmaps get better when they meet the people they're for.",
      krs: [{ title: "Customer interviews", start: 0, target: 24, unit: null }],
    },
    {
      title: "Retire three low-value features",
      why: "Every feature costs support and design time.",
      krs: [
        { title: "Features retired", start: 0, target: 3, unit: null },
        { title: "Support tickets on retired areas", start: 120, target: 20, unit: null },
      ],
    },
  ],
  DES: [
    {
      title: "Ship design system v2",
      why: "One set of components saves every team weeks.",
      krs: [
        { title: "Components shipped", start: 0, target: 40, unit: null },
        { title: "Screens using the system", start: 35, target: 90, unit: "%" },
      ],
    },
    {
      title: "Make the product easier to learn",
      why: "First-run confusion costs us trials.",
      krs: [
        { title: "Usability score (SUS)", start: 68, target: 80, unit: null },
        { title: "Usability sessions", start: 0, target: 15, unit: null },
      ],
    },
  ],
  PPL: [
    {
      title: "Fill the open roles with great people",
      why: "Teams are stretched until these seats are filled.",
      krs: [
        { title: "Hires made", start: 0, target: 8, unit: null },
        { title: "Time to hire", start: 52, target: 35, unit: "days" },
      ],
    },
    {
      title: "Make the first month unforgettable",
      why: "New joiners decide in weeks whether they belong.",
      krs: [
        { title: "Onboarding satisfaction", start: 3.9, target: 4.6, unit: "/5" },
        { title: "Checklists done on time", start: 70, target: 95, unit: "%" },
      ],
    },
    {
      title: "Run a fair, light review cycle",
      why: "Reviews should help people, not burden them.",
      krs: [{ title: "Reviews on time", start: 60, target: 95, unit: "%" }],
    },
  ],
  SAL: [
    {
      title: "Close new enterprise customers",
      why: "Larger accounts anchor the revenue plan.",
      krs: [
        { title: "Deals closed", start: 0, target: 12, unit: null },
        { title: "Pipeline coverage", start: 2.1, target: 3.5, unit: "x" },
      ],
    },
    {
      title: "Shorten the sales cycle",
      why: "Every extra week is a customer we might lose.",
      krs: [{ title: "Average cycle", start: 74, target: 55, unit: "days" }],
    },
  ],
  CS: [
    {
      title: "Answer customers faster",
      why: "Speed is the first thing customers notice.",
      krs: [
        { title: "First response time", start: 6, target: 2, unit: "h" },
        { title: "CSAT", start: 88, target: 94, unit: "%" },
      ],
    },
    {
      title: "Grow revenue from existing customers",
      why: "Keeping customers is cheaper than finding them.",
      krs: [
        { title: "Net revenue retention", start: 98, target: 110, unit: "%" },
        { title: "Expansion deals", start: 0, target: 10, unit: null },
      ],
    },
  ],
  FIN: [
    {
      title: "Close the books faster",
      why: "Leaders decide better with last month's numbers.",
      krs: [{ title: "Working days to close", start: 9, target: 5, unit: "days" }],
    },
    {
      title: "Automate invoice matching",
      why: "Manual matching is slow and error-prone.",
      krs: [
        { title: "Invoices matched automatically", start: 0, target: 80, unit: "%" },
        { title: "Payment errors", start: 12, target: 2, unit: null },
      ],
    },
  ],
  LDR: [
    {
      title: "Keep everyone pulling the same way",
      why: "A company this size lives or dies on shared priorities.",
      krs: [
        { title: "All-hands held", start: 0, target: 2, unit: null },
        { title: "Teams with written goals", start: 40, target: 100, unit: "%" },
      ],
    },
  ],
};

const NOTES = [
  "Good movement this month. On pace for the target.",
  "Slipped a little: waiting on a dependency from another team.",
  "Finished the hard part. What's left is rollout and measuring.",
  "Re-planned after a reprioritisation, but the goal still stands.",
  "Ahead of where I expected, mostly thanks to help from the team.",
  "Behind. Two weeks of incident work ate the time I'd set aside.",
  "Steady progress; nothing surprising to report.",
  "Hit a snag with data quality, now sorted.",
];

const ANSWERS: Record<ReviewKind, Record<string, string[]>> = {
  SELF: {
    proud: [
      "Led the migration we'd been putting off for a year and finished it without a single customer-facing incident.",
      "Took on a messy cross-team project nobody owned and got it to the point where others could run with it.",
      "Mentored two newer teammates, and watched both ship their first features independently.",
      "Cut the time our weekly reporting takes from a day to under an hour, which freed the team for better work.",
    ],
    learned: [
      "I took on too much at once and some things slipped. I'm learning to say no earlier and to ask for help sooner.",
      "I underestimated how long the integration would take. Next time I'll break it down and check my assumptions with someone first.",
      "I was slow to give hard feedback. It cost us a quarter. I'm working on being direct sooner and kinder about it.",
    ],
    next: [
      "Deepen my ownership of the core platform and start sharing more of what I know through short write-ups.",
      "Move from doing the work to shaping it: better planning, clearer priorities, and fewer surprises for the team.",
      "Build my skills in the area where our team is thinnest, so we're less dependent on one or two people.",
    ],
  },
  MANAGER: {
    strengths: [
      "Consistently reliable and thoughtful. Their design for the new service was the clearest I saw this period, and it shaped how the whole team built.",
      "Great with customers and colleagues alike. They turn a vague request into a plan and then follow through.",
      "Calm under pressure. During the two incidents this half they kept the team focused and communicated well.",
    ],
    grow: [
      "Would benefit from delegating more and trusting others to carry work forward, so they can focus on the hardest problems.",
      "Needs to speak up earlier in planning. They often have the right concern, but we hear it after the decision.",
      "A bit more visibility beyond the team would help their career: writing up wins and presenting them.",
    ],
    impact: [
      "Raised the bar for the people around them. Two teammates picked up their review habits and quality improved visibly.",
      "Steady positive presence. The team is more willing to take risks when they're in the room.",
      "Good for the team's pace and morale, and a dependable partner to other departments.",
    ],
  },
  PEER: {
    well: [
      "Explains complicated things simply and is generous with their time when you're stuck.",
      "Dependable. If they say it'll be done, it's done, and they flag problems early.",
      "Brings a calm, practical view to messy discussions and keeps the group moving.",
    ],
    different: [
      "Could share work in progress sooner, so others can help before it's polished.",
      "Sometimes takes on too much themselves. Letting others in would speed things up.",
      "Would be even better to work with if they wrote down decisions after meetings.",
    ],
  },
};

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!;

/** Ratings that look like real ones: most people meet expectations, a few stand out. */
function managerRating(rng: Rng): number {
  const r = rng.next();
  return r < 0.02 ? 1 : r < 0.1 ? 2 : r < 0.55 ? 3 : r < 0.9 ? 4 : 5;
}
const selfRating = (rng: Rng, manager: number) =>
  Math.max(1, Math.min(5, manager + (rng.chance(0.55) ? 1 : rng.chance(0.2) ? -1 : 0)));

function answersFor(rng: Rng, kind: ReviewKind) {
  return Object.fromEntries(QUESTIONS[kind].map((q) => [q.id, pick(rng, ANSWERS[kind][q.id]!)]));
}

type Period = { name: string; start: ISODate; end: ISODate };
const H1: Period = { name: "H1 2026", start: "2026-01-01", end: "2026-06-30" };
const H2: Period = { name: "H2 2026", start: "2026-07-01", end: "2026-12-31" };

export async function seedPerformance(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; demoIds: { arjun: string; priya: string; fatima: string; hr: string } },
) {
  const today = opts.today;
  const demo = opts.demoIds;
  const people = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: {
      id: true,
      joinDate: true,
      managerId: true,
      department: { select: { id: true, code: true, headId: true } },
    },
  });
  const byId = new Map(people.map((p) => [p.id, p]));

  const h1Cycle = await db.reviewCycle.create({
    data: {
      name: H1.name,
      status: "CLOSED",
      periodStart: dbDate(H1.start),
      periodEnd: dbDate(H1.end),
      selfReviewDue: dbDate("2026-07-15"),
      managerReviewDue: dbDate("2026-07-31"),
    },
  });
  const h2Cycle = await db.reviewCycle.create({
    data: {
      name: H2.name,
      status: "SELF_REVIEW",
      periodStart: dbDate(H2.start),
      periodEnd: dbDate(H2.end),
      selfReviewDue: dbDate("2026-11-20"),
      managerReviewDue: dbDate("2026-12-04"),
    },
  });

  /* ── Goals ────────────────────────────────────────────────────────── */
  const goals: Prisma.GoalCreateManyInput[] = [];
  const keyResults: Prisma.KeyResultCreateManyInput[] = [];
  const checkIns: Prisma.GoalCheckInCreateManyInput[] = [];

  /** Writes a goal, its key results and a plausible history of check-ins. */
  function addGoal(opts2: {
    t: Template;
    ownerId: string | null;
    parentId: string | null;
    period: Period;
    cycleId: string;
    /** 0–1: how far along the whole thing should be. */
    pace: number;
  }) {
    const id = randomUUID();
    const frac = Math.max(0, Math.min(1, opts2.pace + (rng.next() - 0.5) * 0.35));
    const krs = opts2.t.krs.map((k) => ({
      ...k,
      current:
        Math.round(
          (k.start + (k.target - k.start) * Math.min(1, frac * (0.8 + rng.next() * 0.4))) * 100,
        ) / 100,
    }));
    const progress =
      goalProgress(
        krs.map((k) => ({ startValue: k.start, targetValue: k.target, currentValue: k.current })),
      ) ?? 0;
    const status = suggestStatus({
      progress,
      start: opts2.period.start,
      due: opts2.period.end,
      today,
    });
    const created = addDays(opts2.period.start, rng.int(0, 20));
    goals.push({
      id,
      ownerId: opts2.ownerId,
      parentId: opts2.parentId,
      cycleId: opts2.cycleId,
      title: opts2.t.title,
      description: opts2.t.why,
      status,
      progress,
      dueDate: dbDate(opts2.period.end),
      createdAt: instantAt(created, "10:00"),
    });
    for (const k of krs) {
      keyResults.push({
        goalId: id,
        title: k.title,
        startValue: k.start,
        targetValue: k.target,
        currentValue: k.current,
        unit: k.unit,
      });
    }
    if (opts2.ownerId) {
      const last = today < opts2.period.end ? today : opts2.period.end;
      const n = rng.int(1, 3);
      for (let i = 1; i <= n; i++) {
        const at = addDays(created, Math.round((i / n) * (daysBetween(created, last) - 1) || 1));
        checkIns.push({
          goalId: id,
          authorId: opts2.ownerId,
          progress: Math.round((progress * i) / n),
          note: pick(rng, NOTES),
          createdAt: instantAt(at, `${rng.int(10, 17)}:${rng.int(10, 59)}`),
        });
      }
    }
    return id;
  }

  const elapsed = Math.min(
    1,
    Math.max(0, daysBetween(H2.start, today) / daysBetween(H2.start, H2.end)),
  );
  const companyGoals: { id: string; dept: string[] }[] = [];
  for (const c of COMPANY) {
    companyGoals.push({
      id: addGoal({
        t: c,
        ownerId: null,
        parentId: null,
        period: H2,
        cycleId: h2Cycle.id,
        pace: elapsed,
      }),
      dept: c.dept,
    });
  }
  // One team goal per department, owned by its head.
  const deptGoal = new Map<string, string>();
  const deptHeads = new Map<string, string>();
  for (const p of people) if (p.department.headId === p.id) deptHeads.set(p.department.code, p.id);
  for (const [code, headId] of deptHeads) {
    const templates = BY_DEPT[code] ?? BY_DEPT.LDR!;
    const parent = companyGoals.find((g) => g.dept.includes(code)) ?? companyGoals[2]!;
    deptGoal.set(
      code,
      addGoal({
        t: templates[0]!,
        ownerId: headId,
        parentId: parent.id,
        period: H2,
        cycleId: h2Cycle.id,
        pace: elapsed,
      }),
    );
  }
  // Everyone else: two goals now (one supporting their manager's or department's), one from last half.
  const ownerGoal = new Map<string, string>();
  for (const [code, headId] of deptHeads) ownerGoal.set(headId, deptGoal.get(code)!);
  const depth = (id: string): number => {
    const m = byId.get(id)?.managerId;
    return m && byId.has(m) ? 1 + depth(m) : 0;
  };
  const ordered = [...people].sort((a, b) => depth(a.id) - depth(b.id));
  for (const p of ordered) {
    const code = p.department.code;
    const pool = BY_DEPT[code] ?? BY_DEPT.LDR!;
    const parentGoal =
      (p.managerId && ownerGoal.get(p.managerId)) || deptGoal.get(code) || companyGoals[0]!.id;
    const count = rng.chance(0.35) ? 3 : 2;
    const mine = rng.shuffle(pool).slice(0, Math.min(count, pool.length));
    mine.forEach((t, i) => {
      // The head's own team goal already counts as their first.
      if (deptHeads.get(code) === p.id && i === 0) return;
      const id = addGoal({
        t,
        ownerId: p.id,
        parentId: i === 0 ? parentGoal : null,
        period: H2,
        cycleId: h2Cycle.id,
        pace: elapsed,
      });
      if (!ownerGoal.has(p.id)) ownerGoal.set(p.id, id);
    });
    if (isoFromDbDate(p.joinDate) < H1.end) {
      addGoal({
        t: rng.shuffle(pool)[0]!,
        ownerId: p.id,
        parentId: null,
        period: H1,
        cycleId: h1Cycle.id,
        pace: 0.85,
      });
    }
  }

  // Parents are inserted before children, so the foreign keys always resolve.
  const company = goals.filter((g) => g.ownerId === null);
  const heads = goals.filter(
    (g) =>
      g.ownerId &&
      [...deptHeads.values()].includes(g.ownerId as string) &&
      company.some((c) => c.id === g.parentId),
  );
  const rest = goals.filter((g) => !company.includes(g) && !heads.includes(g));
  for (const batch of [company, heads, rest]) await db.goal.createMany({ data: batch });
  await db.keyResult.createMany({ data: keyResults });
  await db.goalCheckIn.createMany({ data: checkIns });

  /* ── Reviews ──────────────────────────────────────────────────────── */
  const reviews: Prisma.ReviewCreateManyInput[] = [];
  const submittedAt = (due: ISODate, spread: number) =>
    instantAt(addDays(due, -rng.int(0, spread)), `${rng.int(10, 18)}:${rng.int(10, 59)}`);

  for (const p of people) {
    if (isoFromDbDate(p.joinDate) <= H1.end) {
      // The demo people get steady ratings, so their results read as a believable first impression.
      const demoPerson = p.id === demo.arjun || p.id === demo.priya || p.id === demo.hr;
      const manager = demoPerson ? 4 : managerRating(rng);
      reviews.push({
        cycleId: h1Cycle.id,
        revieweeId: p.id,
        reviewerId: p.id,
        kind: "SELF",
        status: "SUBMITTED",
        answers: answersFor(rng, "SELF"),
        overallRating: demoPerson ? 3 : selfRating(rng, manager),
        submittedAt: submittedAt("2026-07-15", 10),
      });
      if (p.managerId) {
        reviews.push({
          cycleId: h1Cycle.id,
          revieweeId: p.id,
          reviewerId: p.managerId,
          kind: "MANAGER",
          status: "SUBMITTED",
          answers: answersFor(rng, "MANAGER"),
          overallRating: manager,
          submittedAt: submittedAt("2026-07-31", 12),
        });
      }
    }
  }
  // Colleagues' feedback for a dozen people last half.
  const subjects = rng
    .shuffle(people.filter((p) => isoFromDbDate(p.joinDate) <= H1.end))
    .slice(0, 12);
  for (const s of subjects) {
    const from = rng
      .shuffle(people.filter((p) => p.id !== s.id && p.department.code === s.department.code))
      .slice(0, 2);
    for (const f of from) {
      reviews.push({
        cycleId: h1Cycle.id,
        revieweeId: s.id,
        reviewerId: f.id,
        kind: "PEER",
        status: "SUBMITTED",
        answers: answersFor(rng, "PEER"),
        overallRating: Math.min(5, managerRating(rng) + 1),
        submittedAt: submittedAt("2026-07-25", 8),
      });
    }
  }

  // H2: everyone has a self review waiting; most are done, the demo people mostly aren't.
  const notStarted = new Set([demo.arjun, demo.priya]);
  for (const p of people) {
    const done = !notStarted.has(p.id) && p.id !== demo.fatima && rng.chance(0.62);
    reviews.push({
      cycleId: h2Cycle.id,
      revieweeId: p.id,
      reviewerId: p.id,
      kind: "SELF",
      status: done ? "SUBMITTED" : p.id === demo.fatima ? "IN_PROGRESS" : "NOT_STARTED",
      answers: done
        ? answersFor(rng, "SELF")
        : p.id === demo.fatima
          ? { proud: pick(rng, ANSWERS.SELF.proud!) }
          : {},
      overallRating: done ? 3 + (rng.chance(0.5) ? 1 : 0) : null,
      submittedAt: done ? submittedAt("2026-11-20", 6) : null,
    });
    if (p.managerId) {
      reviews.push({
        cycleId: h2Cycle.id,
        revieweeId: p.id,
        reviewerId: p.managerId,
        kind: "MANAGER",
        status: "NOT_STARTED",
      });
    }
  }
  await db.review.createMany({ data: reviews });

  // Arjun has been asked for feedback about Fatima, and Priya for feedback about Arjun.
  const requests: [string, string][] = [
    [demo.fatima, demo.arjun],
    [demo.arjun, demo.hr],
  ];
  for (const [about, from] of requests) {
    const review = await db.review.create({
      data: { cycleId: h2Cycle.id, revieweeId: about, reviewerId: from, kind: "PEER" },
    });
    await db.feedbackRequest.create({
      data: { cycleId: h2Cycle.id, revieweeId: about, requestedFromId: from, reviewId: review.id },
    });
  }

  return {
    goals: goals.length,
    keyResults: keyResults.length,
    checkIns: checkIns.length,
    reviews: reviews.length + requests.length,
  };
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((dbDate(b).getTime() - dbDate(a).getTime()) / 864e5);
}
