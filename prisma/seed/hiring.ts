/**
 * Recruitment history: a closed posting behind every hire of the last ~14
 * months (the hired candidate is linked to the employee), the other
 * candidates each posting saw, and a handful of roles still open today.
 * Stage events carry real timestamps, so the hiring funnel and time-to-hire
 * come straight from them.
 */
import { fakerEN_IN as faker } from "@faker-js/faker";

import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { addDays, dbDate, instantAt, type ISODate } from "../../src/lib/tz";
import type { Rng } from "./rng";

type Stage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED";
const FLOW = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;

const SOURCES = [
  ["LinkedIn", 34],
  ["Referral", 20],
  ["Careers page", 20],
  ["Naukri", 14],
  ["Campus", 6],
  ["Agency", 6],
] as const;

const OPEN_ROLES = [
  { title: "Senior Backend Engineer", department: "ENG", openings: 2, status: "OPEN" },
  { title: "Frontend Engineer", department: "ENG", openings: 1, status: "OPEN" },
  { title: "Product Designer", department: "DES", openings: 1, status: "OPEN" },
  { title: "Account Executive", department: "SAL", openings: 2, status: "OPEN" },
  { title: "Customer Success Manager", department: "CS", openings: 1, status: "OPEN" },
  { title: "Data Analyst", department: "PRD", openings: 1, status: "ON_HOLD" },
  { title: "Finance Associate", department: "FIN", openings: 1, status: "DRAFT" },
] as const;

const NOTES = [
  "Clear communicator; walked through trade-offs without being prompted.",
  "Strong fundamentals. Would like to see more ownership examples.",
  "Great culture add. Asked thoughtful questions about how we work.",
  "Solid on the take-home, a little rushed in the live exercise.",
  "Experience lines up well with what the team needs this year.",
  "Not quite the depth we need for this level; could fit a junior role.",
  "References were glowing. Keen to move quickly.",
];

function weighted<T extends string>(rng: Rng, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [v, w] of options) if ((r -= w) < 0) return v;
  return options[0]![0];
}

const daysBetween = (a: ISODate, b: ISODate) =>
  Math.round((dbDate(b).getTime() - dbDate(a).getTime()) / 864e5);

function description(title: string, department: string) {
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  return {
    type: "doc",
    content: [
      p(
        `We're hiring a ${title} to join ${department} at Northwind Grove. You'll work with a small, senior team that ships often and cares about the details.`,
      ),
      p(
        "You'll own meaningful problems end to end, from understanding what people need to seeing it work in the real world.",
      ),
      p(
        "We offer flexible hours, a hybrid Bengaluru office or remote within India, 24 days of earned leave, and a learning budget.",
      ),
    ],
  };
}

export async function seedHiring(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; fakerSeed: number },
) {
  faker.seed(opts.fakerSeed);
  const today = opts.today;
  const since = addDays(today, -420);

  const [departments, employees, hr] = await Promise.all([
    db.department.findMany({ select: { id: true, code: true, name: true, headId: true } }),
    db.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personalEmail: true,
        phone: true,
        joinDate: true,
        status: true,
        departmentId: true,
        locationId: true,
        employmentType: true,
        managerId: true,
        designation: { select: { title: true } },
      },
    }),
    db.employee.findFirst({
      where: { user: { role: "HR_MANAGER" } },
      orderBy: { joinDate: "asc" },
      select: { id: true },
    }),
  ]);
  const recruiters = employees
    .filter((e) => e.designation.title === "Talent Acquisition Specialist" && e.status !== "EXITED")
    .map((e) => e.id);
  if (hr) recruiters.push(hr.id);
  const officeId = employees.find((e) => e.status !== "EXITED")!.locationId;
  const deptByCode = new Map(departments.map((d) => [d.code, d]));
  const deptById = new Map(departments.map((d) => [d.id, d]));

  const jobs: Prisma.JobPostingCreateManyInput[] = [];
  const candidates: {
    id: string;
    jobId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    source: string;
    stage: Stage;
    stageOrder: number;
    rating: number | null;
    hiredEmployeeId: string | null;
    createdAt: Date;
  }[] = [];
  const events: {
    candidateId: string;
    from: Stage | null;
    to: Stage;
    byId: string | null;
    at: Date;
  }[] = [];
  const notes: {
    candidateId: string;
    authorId: string;
    body: string;
    rating: number;
    createdAt: Date;
  }[] = [];
  let n = 0;

  const at = (day: ISODate) =>
    instantAt(
      day,
      `${String(rng.int(10, 17)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}`,
    );
  const usedEmails = new Set<string>();
  const person = () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let email = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
    email = `${email}${rng.int(1, 999)}@${rng.pick(["gmail.com", "outlook.com", "yahoo.in", "proton.me"])}`;
    while (usedEmails.has(email)) email = `x${email}`;
    usedEmails.add(email);
    return { firstName, lastName, email, phone: `+91 9${rng.int(100000000, 999999999)}` };
  };

  /**
   * Walks a candidate from APPLIED towards `furthest`, one event per step,
   * optionally ending in rejection. Days are clamped to `latest`.
   */
  function walk(
    candidateId: string,
    applied: ISODate,
    furthest: (typeof FLOW)[number],
    rejected: boolean,
    latest: ISODate,
    people: { recruiter: string; manager: string },
  ) {
    const gaps = { SCREENING: [2, 6], INTERVIEW: [4, 10], OFFER: [5, 12], HIRED: [2, 7] } as const;
    let day = applied;
    let prev: Stage | null = null;
    const path: { stage: Stage; day: ISODate }[] = [];
    for (const stage of FLOW) {
      if (stage !== "APPLIED") {
        const [lo, hi] = gaps[stage];
        const next = addDays(day, rng.int(lo, hi));
        if (next > latest) break;
        day = next;
      }
      const by =
        stage === "APPLIED" ? null : stage === "SCREENING" ? people.recruiter : people.manager;
      events.push({ candidateId, from: prev, to: stage, byId: by, at: at(day) });
      path.push({ stage, day });
      prev = stage;
      if (stage === furthest) break;
    }
    if (rejected && prev !== "HIRED") {
      const next = addDays(day, rng.int(1, 6));
      if (next <= latest) {
        events.push({
          candidateId,
          from: prev,
          to: "REJECTED",
          byId: people.recruiter,
          at: at(next),
        });
        return { stage: "REJECTED" as Stage, path };
      }
    }
    return { stage: prev!, path };
  }

  function addNotes(candidateId: string, path: { stage: Stage; day: ISODate }[], manager: string) {
    const interview = path.find((p) => p.stage === "INTERVIEW");
    if (!interview) return null;
    const count = rng.int(1, 2);
    const ratings: number[] = [];
    for (let i = 0; i < count; i++) {
      const rating = rng.int(2, 5);
      ratings.push(rating);
      notes.push({
        candidateId,
        authorId: i === 0 ? manager : rng.pick(recruiters),
        body: rng.pick(NOTES),
        rating,
        createdAt: at(addDays(interview.day, i)),
      });
    }
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  }

  // ── Closed postings behind each recent hire ───────────────────────────
  const hires = employees.filter((e) => {
    const join = e.joinDate.toISOString().slice(0, 10);
    return join >= since && join <= today;
  });
  for (const e of hires) {
    const join = e.joinDate.toISOString().slice(0, 10);
    const dept = deptById.get(e.departmentId)!;
    const manager = e.managerId ?? dept.headId ?? hr!.id;
    const recruiter = rng.pick(recruiters);
    const hiredOn = addDays(join, -rng.int(14, 45));
    const offer = addDays(hiredOn, -rng.int(2, 7));
    const interview = addDays(offer, -rng.int(5, 12));
    const screening = addDays(interview, -rng.int(4, 9));
    const applied = addDays(screening, -rng.int(2, 6));
    const opened = addDays(applied, -rng.int(3, 15));
    const jobId = `job_${++n}`;
    jobs.push({
      id: jobId,
      title: e.designation.title,
      departmentId: e.departmentId,
      locationId: e.locationId,
      employmentType: e.employmentType,
      description: description(e.designation.title, dept.name),
      status: "CLOSED",
      hiringManagerId: manager,
      openings: 1,
      openedAt: instantAt(opened, "10:00"),
      closedAt: instantAt(hiredOn, "18:00"),
      createdAt: instantAt(opened, "09:30"),
    });

    const hiredId = `cand_${++n}`;
    const steps: [Stage, ISODate, string | null][] = [
      ["APPLIED", applied, null],
      ["SCREENING", screening, recruiter],
      ["INTERVIEW", interview, manager],
      ["OFFER", offer, manager],
      ["HIRED", hiredOn, manager],
    ];
    steps.forEach(([to, day, by], i) =>
      events.push({
        candidateId: hiredId,
        from: i ? steps[i - 1]![0] : null,
        to,
        byId: by,
        at: at(day),
      }),
    );
    const rating = addNotes(
      hiredId,
      steps.map(([stage, day]) => ({ stage, day })),
      manager,
    );
    candidates.push({
      id: hiredId,
      jobId,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.personalEmail ?? person().email,
      phone: e.phone,
      source: weighted(rng, [["Referral", 35], ...SOURCES.filter(([s]) => s !== "Referral")]),
      stage: "HIRED",
      stageOrder: 0,
      rating: rating ? Math.max(rating, 4) : 4,
      hiredEmployeeId: e.id,
      createdAt: at(applied),
    });

    const others = rng.int(8, 18);
    for (let i = 0; i < others; i++) {
      const id = `cand_${++n}`;
      // Applications arrive while the role is open, tailing off before the hire.
      const appliedOn = addDays(opened, rng.int(1, Math.max(2, daysBetween(opened, hiredOn) - 8)));
      const furthest = weighted(rng, [
        ["APPLIED", 52],
        ["SCREENING", 27],
        ["INTERVIEW", 16],
        ["OFFER", 5],
      ] as const);
      const res = walk(id, appliedOn, furthest, true, hiredOn, { recruiter, manager });
      const r = addNotes(id, res.path, manager);
      const c = person();
      candidates.push({
        id,
        jobId,
        ...c,
        source: weighted(rng, SOURCES),
        stage: "REJECTED",
        stageOrder: i,
        rating: r,
        hiredEmployeeId: null,
        createdAt: at(appliedOn),
      });
      // Anyone the walk couldn't finish before the role closed is rejected on close.
      if (res.stage !== "REJECTED")
        events.push({
          candidateId: id,
          from: res.stage,
          to: "REJECTED",
          byId: recruiter,
          at: instantAt(hiredOn, "18:30"),
        });
    }
  }

  // ── Roles open today ──────────────────────────────────────────────────
  for (const role of OPEN_ROLES) {
    const dept = deptByCode.get(role.department)!;
    const jobId = `job_${++n}`;
    const opened = addDays(today, -rng.int(12, 55));
    const manager = dept.headId ?? hr!.id;
    jobs.push({
      id: jobId,
      title: role.title,
      departmentId: dept.id,
      locationId: officeId,
      employmentType: "FULL_TIME",
      description: description(role.title, dept.name),
      status: role.status,
      hiringManagerId: manager,
      openings: role.openings,
      openedAt: role.status === "DRAFT" ? null : instantAt(opened, "10:00"),
      createdAt: instantAt(addDays(opened, -3), "09:30"),
    });
    if (role.status === "DRAFT") continue;
    const recruiter = rng.pick(recruiters);
    const order = new Map<Stage, number>();
    for (let i = 0, count = rng.int(10, 22); i < count; i++) {
      const id = `cand_${++n}`;
      const appliedOn = addDays(opened, rng.int(0, Math.max(1, daysBetween(opened, today) - 1)));
      const furthest = weighted(rng, [
        ["APPLIED", 40],
        ["SCREENING", 28],
        ["INTERVIEW", 24],
        ["OFFER", 8],
      ] as const);
      const res = walk(id, appliedOn, furthest, rng.chance(0.3), today, { recruiter, manager });
      const r = addNotes(id, res.path, manager);
      const stageOrder = order.get(res.stage) ?? 0;
      order.set(res.stage, stageOrder + 1);
      candidates.push({
        id,
        jobId,
        ...person(),
        source: weighted(rng, SOURCES),
        stage: res.stage,
        stageOrder,
        rating: r,
        hiredEmployeeId: null,
        createdAt: at(appliedOn),
      });
    }
  }

  await db.jobPosting.createMany({ data: jobs });
  await db.candidate.createMany({ data: candidates });
  for (let i = 0; i < events.length; i += 2000)
    await db.candidateStageEvent.createMany({ data: events.slice(i, i + 2000) });
  await db.candidateNote.createMany({ data: notes });

  return {
    jobs: jobs.length,
    open: OPEN_ROLES.filter((r) => r.status === "OPEN").length,
    candidates: candidates.length,
    hires: hires.length,
  };
}
