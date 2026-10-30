/**
 * Onboarding and offboarding: the two standard templates, a checklist for
 * everyone who joined or left in the last four months (older ones finished,
 * recent ones part way), a hire who starts soon, an open offer, and the
 * person serving notice.
 */
import {
  planTasks,
  type Assignee,
  type TemplateTask,
} from "../../src/features/lifecycle/logic/checklist";
import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  addDays,
  dbDate,
  instantAt,
  isoFromDbDate,
  isoWeekday,
  type ISODate,
} from "../../src/lib/tz";
import type { Rng } from "./rng";

const ONBOARDING: Omit<TemplateTask, "sortOrder">[] = [
  {
    title: "Send the offer letter and welcome pack",
    description: null,
    assigneeRole: "HR",
    dueOffsetDays: -14,
  },
  {
    title: "Sign the employment agreement",
    description: "Signed copy back to the people team.",
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: -10,
  },
  {
    title: "Collect ID, PAN and bank details",
    description: "Needed before payroll can include them.",
    assigneeRole: "HR",
    dueOffsetDays: -7,
  },
  {
    title: "Pick an onboarding buddy",
    description: "Someone outside the reporting line who has been here a year or more.",
    assigneeRole: "MANAGER",
    dueOffsetDays: -7,
  },
  { title: "Order and set up a laptop", description: null, assigneeRole: "IT", dueOffsetDays: -5 },
  {
    title: "Plan the first two weeks",
    description: "Intros, starter tasks and the first small thing to ship.",
    assigneeRole: "MANAGER",
    dueOffsetDays: -3,
  },
  {
    title: "Fill in personal and emergency details",
    description: null,
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: -3,
  },
  { title: "Add to payroll", description: null, assigneeRole: "HR", dueOffsetDays: -3 },
  {
    title: "Create email, Slack and tool accounts",
    description: null,
    assigneeRole: "IT",
    dueOffsetDays: -2,
  },
  {
    title: "First-day welcome and policy walkthrough",
    description: null,
    assigneeRole: "HR",
    dueOffsetDays: 0,
  },
  {
    title: "Welcome lunch with the team",
    description: null,
    assigneeRole: "MANAGER",
    dueOffsetDays: 0,
  },
  {
    title: "Security and access training",
    description: null,
    assigneeRole: "IT",
    dueOffsetDays: 2,
  },
  {
    title: "Read the employee handbook",
    description: null,
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: 3,
  },
  {
    title: "Set first-quarter goals together",
    description: null,
    assigneeRole: "MANAGER",
    dueOffsetDays: 14,
  },
  {
    title: "30-day check-in",
    description: "How is it going, honestly? What would make the next month better?",
    assigneeRole: "HR",
    dueOffsetDays: 30,
  },
];

const OFFBOARDING: Omit<TemplateTask, "sortOrder">[] = [
  {
    title: "Confirm last day and notice terms",
    description: null,
    assigneeRole: "HR",
    dueOffsetDays: -25,
  },
  {
    title: "Plan the knowledge handover",
    description: "Who takes over what, and by when.",
    assigneeRole: "MANAGER",
    dueOffsetDays: -20,
  },
  {
    title: "Write handover notes",
    description: null,
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: -10,
  },
  { title: "Reassign ongoing work", description: null, assigneeRole: "MANAGER", dueOffsetDays: -7 },
  { title: "Plan the device return", description: null, assigneeRole: "IT", dueOffsetDays: -5 },
  { title: "Exit interview", description: null, assigneeRole: "HR", dueOffsetDays: -3 },
  {
    title: "Farewell with the team",
    description: null,
    assigneeRole: "MANAGER",
    dueOffsetDays: -1,
  },
  {
    title: "Return laptop and ID card",
    description: null,
    assigneeRole: "EMPLOYEE",
    dueOffsetDays: 0,
  },
  { title: "Revoke accounts and access", description: null, assigneeRole: "IT", dueOffsetDays: 0 },
  { title: "Full and final settlement", description: null, assigneeRole: "HR", dueOffsetDays: 10 },
  {
    title: "Issue relieving and experience letters",
    description: null,
    assigneeRole: "HR",
    dueOffsetDays: 15,
  },
];

const withOrder = (tasks: Omit<TemplateTask, "sortOrder">[]) =>
  tasks.map((t, i) => ({ ...t, sortOrder: i }));

/** The next Monday at least `days` away. */
function mondayAfter(today: ISODate, days: number): ISODate {
  let d = addDays(today, days);
  while (isoWeekday(d) !== 1) d = addDays(d, 1);
  return d;
}

function weekdayAfter(today: ISODate, days: number): ISODate {
  let d = addDays(today, days);
  while (isoWeekday(d) > 5) d = addDays(d, 1);
  return d;
}

export async function seedLifecycle(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; ids: Map<string, string>; hrId: string },
) {
  const { today, ids } = opts;
  const onboarding = await db.checklistTemplate.create({
    data: {
      name: "Standard onboarding",
      kind: "ONBOARDING",
      tasks: { create: withOrder(ONBOARDING) },
    },
    include: { tasks: true },
  });
  const offboarding = await db.checklistTemplate.create({
    data: {
      name: "Standard offboarding",
      kind: "OFFBOARDING",
      tasks: { create: withOrder(OFFBOARDING) },
    },
    include: { tasks: true },
  });

  const itAdmin = await db.employee.findFirst({
    where: { designation: { title: "IT Administrator" }, status: { not: "EXITED" } },
    select: { id: true },
  });
  const itId = itAdmin?.id ?? ids.get("fin")!;

  // ── A hire who starts soon, on Priya's team ───────────────────────────
  const priya = ids.get("em_web")!;
  const frontend = await db.jobPosting.findFirstOrThrow({
    where: { title: "Frontend Engineer", status: "OPEN" },
  });
  await db.jobPosting.update({ where: { id: frontend.id }, data: { hiringManagerId: priya } });
  const active = (jobId: string) =>
    db.candidate.findMany({
      where: { jobId, stage: { in: ["INTERVIEW", "SCREENING", "APPLIED"] } },
      orderBy: [{ stage: "desc" }, { rating: "desc" }],
    });
  const [hire, frontendOffer] = await active(frontend.id);
  const joinDate = mondayAfter(today, 7);
  const feTitle =
    (await db.designation.findFirst({
      where: { title: "Frontend Engineer", departmentId: frontend.departmentId },
      select: { id: true, departmentId: true },
    })) ??
    (await db.designation.create({
      data: { title: "Frontend Engineer", level: 2, departmentId: frontend.departmentId },
      select: { id: true, departmentId: true },
    }));
  const last = await db.employee.findFirst({
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  const code = `GRV-${String(Number(last!.employeeCode.replace(/\D/g, "")) + 1).padStart(4, "0")}`;
  const newJoiner = await db.employee.create({
    data: {
      employeeCode: code,
      firstName: hire!.firstName,
      lastName: hire!.lastName,
      workEmail:
        `${hire!.firstName}.${hire!.lastName}`.toLowerCase().replace(/[^a-z.]/g, "") +
        "@northwindgrove.in",
      personalEmail: hire!.email,
      phone: hire!.phone,
      designationId: feTitle!.id,
      departmentId: feTitle!.departmentId!,
      locationId: frontend.locationId,
      managerId: priya,
      joinDate: dbDate(joinDate),
      status: "ONBOARDING",
      skills: ["React", "TypeScript", "CSS"],
    },
  });
  const offerOn = addDays(today, -9);
  const hiredOn = addDays(today, -5);
  await db.candidate.update({
    where: { id: hire!.id },
    data: { stage: "HIRED", hiredEmployeeId: newJoiner.id },
  });
  await db.candidateStageEvent.createMany({
    data: [
      {
        candidateId: hire!.id,
        from: hire!.stage,
        to: "OFFER",
        byId: priya,
        at: instantAt(offerOn, "16:10"),
      },
      {
        candidateId: hire!.id,
        from: "OFFER",
        to: "HIRED",
        byId: opts.hrId,
        at: instantAt(hiredOn, "11:30"),
      },
    ],
  });

  // ── Open offers waiting to be converted ───────────────────────────────
  const backend = await db.jobPosting.findFirstOrThrow({
    where: { title: "Senior Backend Engineer", status: "OPEN" },
  });
  const offers = [frontendOffer, (await active(backend.id))[0]].filter((c) => !!c);
  for (const c of offers) {
    await db.candidate.update({ where: { id: c!.id }, data: { stage: "OFFER", stageOrder: 0 } });
    await db.candidateStageEvent.create({
      data: {
        candidateId: c!.id,
        from: c!.stage,
        to: "OFFER",
        byId: opts.hrId,
        at: instantAt(addDays(today, -2), "15:00"),
      },
    });
  }

  // ── Someone serving notice ────────────────────────────────────────────
  const leaving = await db.employee.findFirst({
    where: { status: "NOTICE" },
    select: { id: true },
  });
  if (leaving) {
    await db.employee.update({
      where: { id: leaving.id },
      data: { exitDate: dbDate(weekdayAfter(today, 18)), exitReason: "Joined another company" },
    });
  }

  // ── Checklists ────────────────────────────────────────────────────────
  const since = addDays(today, -120);
  const people = await db.employee.findMany({
    where: {
      OR: [
        { joinDate: { gte: dbDate(since) }, status: { not: "EXITED" } },
        { exitDate: { gte: dbDate(since) } },
      ],
    },
    select: { id: true, joinDate: true, exitDate: true, status: true, managerId: true },
  });

  let created = 0;
  let running = 0;
  for (const p of people) {
    const leavingSoon = p.exitDate && (p.status === "NOTICE" || p.status === "EXITED");
    const kind = leavingSoon ? "OFFBOARDING" : "ONBOARDING";
    const start = isoFromDbDate(leavingSoon ? p.exitDate! : p.joinDate);
    const template = kind === "ONBOARDING" ? onboarding : offboarding;
    const assignees: Record<Assignee, string | null> = {
      HR: opts.hrId,
      IT: itId,
      MANAGER: p.managerId,
      EMPLOYEE: p.id,
    };
    const planned = planTasks(template.tasks, start, assignees);
    // Most past-due tasks are done; a few slip, as they do. Lists that
    // ended over five weeks ago are finished.
    const finished = addDays(start, 35) < today;
    const tasks = planned.map((t) => {
      const done =
        finished ||
        (t.dueDate < today ? rng.chance(0.88) : t.dueDate <= addDays(today, 3) && rng.chance(0.2));
      const doneOn = t.dueDate < today ? addDays(t.dueDate, -rng.int(0, 2)) : today;
      return {
        ...t,
        dueDate: dbDate(t.dueDate),
        completedAt: done ? instantAt(doneOn, `${rng.int(10, 17)}:${rng.int(10, 59)}`) : null,
        completedById: done ? t.assigneeId : null,
      };
    });
    const complete = tasks.every((t) => t.completedAt);
    const lastDone = tasks.reduce<Date | null>(
      (m, t) => (t.completedAt && (!m || t.completedAt > m) ? t.completedAt : m),
      null,
    );
    await db.checklist.create({
      data: {
        employeeId: p.id,
        templateId: template.id,
        kind,
        startDate: dbDate(start),
        completedAt: complete ? lastDone : null,
        createdAt: instantAt(addDays(start, kind === "ONBOARDING" ? -15 : -26), "10:00"),
        tasks: { create: tasks },
      },
    });
    created++;
    if (!complete) running++;
    // People still working through onboarding show as Onboarding in the directory.
    if (kind === "ONBOARDING" && !complete && p.status === "ACTIVE") {
      await db.employee.update({ where: { id: p.id }, data: { status: "ONBOARDING" } });
    }
  }

  return {
    checklists: created,
    running,
    newJoiner: `${newJoiner.firstName} ${newJoiner.lastName}`,
    joinDate,
  };
}
