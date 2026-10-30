import "server-only";

import { db } from "@/lib/db";

const active = { status: { not: "EXITED" as const } };

export async function getDepartments() {
  const departments = await db.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      colorToken: true,
      head: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          avatarUrl: true,
          designation: { select: { title: true } },
        },
      },
      _count: { select: { employees: { where: active } } },
      designations: {
        orderBy: [{ level: "desc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          level: true,
          _count: { select: { employees: { where: active } } },
        },
      },
      employees: {
        where: active,
        orderBy: { joinDate: "asc" },
        take: 5,
        select: { id: true, firstName: true, lastName: true, preferredName: true, avatarUrl: true },
      },
    },
  });
  return departments.map((d) => ({
    ...d,
    headcount: d._count.employees,
    designations: d.designations.map((g) => ({
      id: g.id,
      title: g.title,
      level: g.level,
      headcount: g._count.employees,
    })),
  }));
}

export type DepartmentRow = Awaited<ReturnType<typeof getDepartments>>[number];
