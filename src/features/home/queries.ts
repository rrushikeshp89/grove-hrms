import "server-only";

import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, type CurrentUser } from "@/server/session";

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  status: true,
  joinDate: true,
  designation: { select: { title: true } },
} as const;

/**
 * Everything the home screen shows, scoped to what this user may see.
 * Company-wide numbers are only loaded for roles with analytics access.
 */
export async function getHomeData(user: CurrentUser) {
  const employeeId = user.employee?.id;
  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const me = employeeId
    ? await db.employee.findUnique({
        where: { id: employeeId },
        select: {
          ...personSelect,
          employeeCode: true,
          workEmail: true,
          employmentType: true,
          department: { select: { name: true } },
          location: { select: { id: true, name: true } },
          manager: { select: personSelect },
          reports: {
            where: { status: { not: "EXITED" } },
            select: personSelect,
            orderBy: { firstName: "asc" },
          },
        },
      })
    : null;

  const teammates =
    me?.manager && me.reports.length === 0
      ? await db.employee.findMany({
          where: { managerId: me.manager.id, id: { not: me.id }, status: { not: "EXITED" } },
          select: personSelect,
          orderBy: { firstName: "asc" },
        })
      : [];

  const holidays = await db.holiday.findMany({
    where: {
      date: { gte: todayDate },
      OR: [{ locationId: null }, ...(me ? [{ locationId: me.location.id }] : [])],
    },
    orderBy: { date: "asc" },
    take: 4,
    select: { id: true, name: true, date: true, isOptional: true },
  });

  const company = can(actorOf(user), "analytics.read") ? await getCompanySnapshot(todayDate) : null;

  return { me, teammates, holidays, company };
}

async function getCompanySnapshot(today: Date) {
  const monthAgo = new Date(today.getTime() - 30 * 864e5);
  const [active, joiners, onNotice, byDepartment, recent] = await Promise.all([
    db.employee.count({ where: { status: { not: "EXITED" } } }),
    db.employee.count({ where: { status: { not: "EXITED" }, joinDate: { gte: monthAgo } } }),
    db.employee.count({ where: { status: "NOTICE" } }),
    db.department.findMany({
      select: {
        id: true,
        name: true,
        colorToken: true,
        _count: { select: { employees: { where: { status: { not: "EXITED" } } } } },
      },
    }),
    db.employee.findMany({
      where: { status: { not: "EXITED" } },
      orderBy: { joinDate: "desc" },
      take: 4,
      select: { ...personSelect, department: { select: { name: true } } },
    }),
  ]);
  return {
    active,
    joiners,
    onNotice,
    departments: byDepartment
      .map((d) => ({ id: d.id, name: d.name, colorToken: d.colorToken, count: d._count.employees }))
      .sort((a, b) => b.count - a.count),
    recent,
  };
}

export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
export type HomePerson = NonNullable<HomeData["me"]>["reports"][number];
