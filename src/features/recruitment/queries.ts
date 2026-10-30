import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, type CurrentUser } from "@/server/session";

import { PIPELINE, stageCounts, textFromDoc, type Stage } from "./logic/pipeline";

const nameOf = (p: { firstName: string; lastName: string; preferredName?: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

/** Whether this person may change a job's pipeline: recruiters, or its hiring manager. */
export function mayRecruit(user: CurrentUser, job: { hiringManagerId: string }) {
  return (
    can(actorOf(user), "recruitment.manage") || job.hiringManagerId === (user.employee?.id ?? "-")
  );
}

export type JobView = "open" | "on_hold" | "draft" | "closed";
const VIEW_STATUS = { open: "OPEN", on_hold: "ON_HOLD", draft: "DRAFT", closed: "CLOSED" } as const;

export async function jobs(view: JobView) {
  const [rows, counts, statusCounts] = await Promise.all([
    db.jobPosting.findMany({
      where: { status: VIEW_STATUS[view] },
      orderBy: view === "closed" ? { closedAt: "desc" } : { openedAt: "asc" },
      take: view === "closed" ? 40 : 100,
      select: {
        id: true,
        title: true,
        status: true,
        openings: true,
        openedAt: true,
        closedAt: true,
        createdAt: true,
        employmentType: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
        hiringManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            avatarUrl: true,
          },
        },
      },
    }),
    db.candidate.groupBy({ by: ["jobId", "stage"], _count: true }),
    db.jobPosting.groupBy({ by: ["status"], _count: true }),
  ]);
  const byJob = new Map<string, Record<Stage, number>>();
  for (const c of counts) {
    const m = byJob.get(c.jobId) ?? stageCounts([]);
    m[c.stage as Stage] = c._count;
    byJob.set(c.jobId, m);
  }
  return {
    counts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Partial<
      Record<(typeof VIEW_STATUS)[JobView], number>
    >,
    jobs: rows.map((j) => {
      const stages = byJob.get(j.id) ?? stageCounts([]);
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        openings: j.openings,
        openedAt: (j.openedAt ?? j.createdAt).toISOString(),
        closedAt: j.closedAt?.toISOString() ?? null,
        employmentType: j.employmentType,
        department: j.department.name,
        location: j.location.name,
        hiringManager: { name: nameOf(j.hiringManager), avatarUrl: j.hiringManager.avatarUrl },
        stages,
        active: PIPELINE.filter((s) => s !== "HIRED").reduce((n, s) => n + stages[s], 0),
      };
    }),
  };
}

export type JobCard = Awaited<ReturnType<typeof jobs>>["jobs"][number];

const jobSelect = {
  id: true,
  title: true,
  status: true,
  openings: true,
  openedAt: true,
  closedAt: true,
  createdAt: true,
  employmentType: true,
  description: true,
  departmentId: true,
  locationId: true,
  hiringManagerId: true,
  department: { select: { name: true } },
  location: { select: { name: true } },
  hiringManager: { select: { firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.JobPostingSelect;

/** A job with its candidates, shaped for the board. */
export async function jobBoard(jobId: string) {
  const job = await db.jobPosting.findUnique({ where: { id: jobId }, select: jobSelect });
  if (!job) return null;
  const candidates = await db.candidate.findMany({
    where: { jobId },
    orderBy: [{ stageOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      source: true,
      stage: true,
      stageOrder: true,
      rating: true,
      createdAt: true,
      _count: { select: { notes: true } },
      stageHistory: { orderBy: { at: "desc" }, take: 1, select: { at: true, to: true } },
    },
  });
  return {
    job: {
      id: job.id,
      title: job.title,
      status: job.status,
      openings: job.openings,
      openedAt: (job.openedAt ?? job.createdAt).toISOString(),
      closedAt: job.closedAt?.toISOString() ?? null,
      employmentType: job.employmentType,
      department: job.department.name,
      location: job.location.name,
      hiringManager: nameOf(job.hiringManager),
      hiringManagerId: job.hiringManagerId,
      descriptionText: textFromDoc(job.description),
      form: {
        id: job.id,
        title: job.title,
        departmentId: job.departmentId,
        locationId: job.locationId,
        employmentType: job.employmentType,
        hiringManagerId: job.hiringManagerId,
        openings: job.openings,
        status: job.status,
        description: textFromDoc(job.description),
      },
    },
    candidates: candidates.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      source: c.source,
      stage: c.stage as Stage,
      order: c.stageOrder,
      rating: c.rating,
      notes: c._count.notes,
      appliedAt: c.createdAt.toISOString(),
      stageSince: (c.stageHistory[0]?.at ?? c.createdAt).toISOString(),
    })),
  };
}

export type Board = NonNullable<Awaited<ReturnType<typeof jobBoard>>>;
export type BoardCandidate = Board["candidates"][number];

export async function candidateDetail(id: string) {
  const c = await db.candidate.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      source: true,
      stage: true,
      rating: true,
      createdAt: true,
      hiredEmployee: { select: { id: true, employeeCode: true, joinDate: true } },
      job: {
        select: {
          id: true,
          title: true,
          status: true,
          hiringManagerId: true,
          department: { select: { name: true } },
          location: { select: { name: true } },
        },
      },
      stageHistory: {
        orderBy: { at: "asc" },
        select: {
          id: true,
          from: true,
          to: true,
          at: true,
          by: { select: { firstName: true, lastName: true, preferredName: true } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          rating: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    source: c.source,
    stage: c.stage as Stage,
    rating: c.rating,
    appliedAt: c.createdAt.toISOString(),
    hiredEmployee: c.hiredEmployee
      ? {
          id: c.hiredEmployee.id,
          code: c.hiredEmployee.employeeCode,
          joinDate: c.hiredEmployee.joinDate.toISOString().slice(0, 10),
        }
      : null,
    job: {
      id: c.job.id,
      title: c.job.title,
      status: c.job.status,
      hiringManagerId: c.job.hiringManagerId,
      department: c.job.department.name,
      location: c.job.location.name,
    },
    history: c.stageHistory.map((e) => ({
      id: e.id,
      from: e.from as Stage | null,
      to: e.to as Stage,
      at: e.at.toISOString(),
      by: e.by ? nameOf(e.by) : null,
    })),
    notes: c.notes.map((n) => ({
      id: n.id,
      body: n.body,
      rating: n.rating,
      createdAt: n.createdAt.toISOString(),
      author: { id: n.author.id, name: nameOf(n.author), avatarUrl: n.author.avatarUrl },
    })),
  };
}

export type CandidateDetail = NonNullable<Awaited<ReturnType<typeof candidateDetail>>>;

/** Choices for the job form and the hire dialog. */
export async function recruitmentOptions() {
  const [departments, locations, managers, emails] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Anyone who leads people, plus department heads: the usual hiring managers.
    db.employee.findMany({
      where: {
        status: { not: "EXITED" },
        OR: [{ reports: { some: {} } }, { headOf: { isNot: null } }],
      },
      orderBy: { firstName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        designation: { select: { title: true } },
      },
    }),
    db.employee.findMany({ select: { workEmail: true } }),
  ]);
  return {
    departments,
    locations,
    managers: managers.map((m) => ({ id: m.id, name: nameOf(m), title: m.designation.title })),
    takenEmails: emails.map((e) => e.workEmail),
  };
}

export type RecruitmentOptions = Awaited<ReturnType<typeof recruitmentOptions>>;
