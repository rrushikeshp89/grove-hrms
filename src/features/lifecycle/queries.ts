import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can, scopeFor } from "@/lib/rbac";
import { isoFromDbDate, todayIn } from "@/lib/tz";
import { visibleEmployeeIds } from "@/server/authz";
import { actorOf, type CurrentUser } from "@/server/session";

import { canTick, checklistProgress, nextTask } from "./logic/checklist";

const person = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  status: true,
  joinDate: true,
  exitDate: true,
  exitReason: true,
  designation: { select: { title: true } },
  department: { select: { name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
} as const;

const nameOf = (p: { firstName: string; lastName: string; preferredName: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

/**
 * Which checklists this person may open: everything for the people team,
 * their reports' for managers, and always their own or any they hold a
 * task on.
 */
async function visibleWhere(user: CurrentUser): Promise<Prisma.ChecklistWhereInput> {
  const me = user.employee?.id ?? "-";
  const scope = scopeFor(actorOf(user), "lifecycle.read");
  if (scope === "all") return {};
  const mine: Prisma.ChecklistWhereInput[] = [
    { employeeId: me },
    { tasks: { some: { assigneeId: me } } },
  ];
  if (scope === "team") {
    const ids = await visibleEmployeeIds(user, "lifecycle.read");
    if (ids !== "all") mine.push({ employeeId: { in: ids } });
  }
  return { OR: mine };
}

export async function checklists(user: CurrentUser, view: "active" | "done") {
  const today = todayIn();
  const rows = await db.checklist.findMany({
    where: { ...(await visibleWhere(user)), completedAt: view === "active" ? null : { not: null } },
    orderBy: view === "active" ? { startDate: "asc" } : { completedAt: "desc" },
    take: view === "active" ? 100 : 30,
    select: {
      id: true,
      kind: true,
      startDate: true,
      completedAt: true,
      employee: { select: person },
      tasks: {
        select: {
          id: true,
          title: true,
          dueDate: true,
          completedAt: true,
          assigneeRole: true,
        },
      },
    },
  });
  return rows.map((c) => {
    const tasks = c.tasks.map((t) => ({
      ...t,
      dueDate: isoFromDbDate(t.dueDate),
      completedAt: t.completedAt?.toISOString() ?? null,
    }));
    return {
      id: c.id,
      kind: c.kind,
      startDate: isoFromDbDate(c.startDate),
      completedAt: c.completedAt?.toISOString() ?? null,
      person: {
        id: c.employee.id,
        name: nameOf(c.employee),
        avatarUrl: c.employee.avatarUrl,
        title: c.employee.designation.title,
        department: c.employee.department.name,
      },
      progress: checklistProgress(tasks, today),
      next: nextTask(tasks),
    };
  });
}

export type ChecklistSummary = Awaited<ReturnType<typeof checklists>>[number];

/** One checklist with its tasks, or null when this person may not see it. */
export async function checklistDetail(user: CurrentUser, id: string) {
  const c = await db.checklist.findFirst({
    where: { id, ...(await visibleWhere(user)) },
    select: {
      id: true,
      kind: true,
      startDate: true,
      completedAt: true,
      employee: { select: person },
      tasks: {
        orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          assigneeRole: true,
          dueDate: true,
          completedAt: true,
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              avatarUrl: true,
            },
          },
          completedById: true,
        },
      },
    },
  });
  if (!c) return null;
  const finisherIds = [
    ...new Set(c.tasks.flatMap((t) => (t.completedById ? [t.completedById] : []))),
  ];
  const finishers = new Map(
    (
      await db.employee.findMany({
        where: { id: { in: finisherIds } },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      })
    ).map((p) => [p.id, nameOf(p)]),
  );
  const actor = {
    employeeId: user.employee?.id ?? null,
    manage: can(actorOf(user), "lifecycle.manage"),
  };
  return {
    id: c.id,
    kind: c.kind,
    today: todayIn(),
    startDate: isoFromDbDate(c.startDate),
    completedAt: c.completedAt?.toISOString() ?? null,
    isMine: c.employee.id === actor.employeeId,
    person: {
      id: c.employee.id,
      name: nameOf(c.employee),
      avatarUrl: c.employee.avatarUrl,
      title: c.employee.designation.title,
      department: c.employee.department.name,
      manager: c.employee.manager ? nameOf(c.employee.manager) : null,
      status: c.employee.status,
      exitReason: c.employee.exitReason,
    },
    tasks: c.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeRole: t.assigneeRole,
      dueDate: isoFromDbDate(t.dueDate),
      completedAt: t.completedAt?.toISOString() ?? null,
      assignee: t.assignee
        ? { id: t.assignee.id, name: nameOf(t.assignee), avatarUrl: t.assignee.avatarUrl }
        : null,
      completedBy: t.completedById ? (finishers.get(t.completedById) ?? null) : null,
      canTick: canTick(actor, { assigneeId: t.assignee?.id ?? null }),
    })),
  };
}

export type ChecklistDetail = NonNullable<Awaited<ReturnType<typeof checklistDetail>>>;
export type ChecklistTaskRow = ChecklistDetail["tasks"][number];

/** Open tasks assigned to this person, soonest first, for the home screen. */
export async function myOpenTasks(employeeId: string, take = 4) {
  const where = { assigneeId: employeeId, completedAt: null, checklist: { completedAt: null } };
  const [rows, count] = await Promise.all([
    db.checklistTask.findMany({
      where,
      orderBy: { dueDate: "asc" },
      take,
      select: {
        id: true,
        title: true,
        dueDate: true,
        checklist: {
          select: {
            id: true,
            kind: true,
            employee: {
              select: { id: true, firstName: true, lastName: true, preferredName: true },
            },
          },
        },
      },
    }),
    db.checklistTask.count({ where }),
  ]);
  return {
    count,
    items: rows.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: isoFromDbDate(t.dueDate),
      checklistId: t.checklist.id,
      kind: t.checklist.kind,
      forSelf: t.checklist.employee.id === employeeId,
      person: nameOf(t.checklist.employee),
    })),
  };
}

export async function templates() {
  const rows = await db.checklistTemplate.findMany({
    orderBy: { kind: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      tasks: {
        orderBy: [{ dueOffsetDays: "asc" }, { sortOrder: "asc" }],
        select: { title: true, description: true, assigneeRole: true, dueOffsetDays: true },
      },
    },
  });
  return rows;
}

export type Template = Awaited<ReturnType<typeof templates>>[number];

/** People who could be offboarded: employed, and not already leaving. */
export async function offboardingOptions() {
  const rows = await db.employee.findMany({
    where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      designation: { select: { title: true } },
    },
  });
  return rows.map((r) => ({ id: r.id, name: nameOf(r), title: r.designation.title }));
}
