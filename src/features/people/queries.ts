import "server-only";

import { notFound } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { scopeFor } from "@/lib/rbac";
import { targetFor } from "@/server/authz";
import { actorOf, type CurrentUser } from "@/server/session";

import { profileAccess } from "./access";
import type { DirectoryFilters } from "./filters";

const seesFormer = (user: CurrentUser) => scopeFor(actorOf(user), "employee.update") === "all";

const cardSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  status: true,
  employmentType: true,
  joinDate: true,
  workEmail: true,
  designation: { select: { title: true } },
  department: { select: { name: true, code: true, colorToken: true } },
  location: { select: { name: true, isRemote: true } },
  manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.EmployeeSelect;

export type DirectoryPerson = Prisma.EmployeeGetPayload<{ select: typeof cardSelect }>;

/** Every word must match some field, so "priya eng" finds Priya in Engineering. */
function searchWhere(q: string): Prisma.EmployeeWhereInput[] {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return terms.map((t) => ({
    OR: [
      { firstName: { contains: t, mode: "insensitive" } },
      { lastName: { contains: t, mode: "insensitive" } },
      { preferredName: { contains: t, mode: "insensitive" } },
      { employeeCode: { contains: t, mode: "insensitive" } },
      { workEmail: { contains: t, mode: "insensitive" } },
      { designation: { title: { contains: t, mode: "insensitive" } } },
      { department: { name: { contains: t, mode: "insensitive" } } },
      { skills: { has: t } },
    ],
  }));
}

export async function listPeople(user: CurrentUser, f: DirectoryFilters) {
  const status = f.status === "EXITED" && !seesFormer(user) ? null : f.status;
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      status ? { status } : { status: { not: "EXITED" } },
      ...(f.department ? [{ department: { code: f.department } }] : []),
      ...(f.location ? [{ locationId: f.location }] : []),
      ...(f.type ? [{ employmentType: f.type }] : []),
      ...searchWhere(f.q),
    ],
  };
  const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
    f.sort === "joined-desc"
      ? [{ joinDate: "desc" }]
      : f.sort === "joined-asc"
        ? [{ joinDate: "asc" }]
        : f.sort === "department"
          ? [{ department: { name: "asc" } }, { firstName: "asc" }]
          : [{ firstName: "asc" }, { lastName: "asc" }];

  const [people, total] = await Promise.all([
    db.employee.findMany({ where, orderBy, select: cardSelect }),
    db.employee.count({ where: { status: { not: "EXITED" } } }),
  ]);
  return { people, total };
}

export async function getDirectoryOptions(user: CurrentUser) {
  const [departments, locations] = await Promise.all([
    db.department.findMany({
      orderBy: { name: "asc" },
      select: {
        code: true,
        name: true,
        _count: { select: { employees: { where: { status: { not: "EXITED" } } } } },
      },
    }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    departments: departments.map((d) => ({
      code: d.code,
      name: d.name,
      count: d._count.employees,
    })),
    locations,
    canSeeFormer: seesFormer(user),
  };
}

const personRef = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  avatarUrl: true,
  status: true,
  designation: { select: { title: true } },
} satisfies Prisma.EmployeeSelect;

export type PersonRef = Prisma.EmployeeGetPayload<{ select: typeof personRef }>;

export async function getProfile(user: CurrentUser, id: string) {
  const employee = await db.employee.findUnique({
    where: { id },
    select: {
      ...personRef,
      employeeCode: true,
      pronouns: true,
      bio: true,
      skills: true,
      workEmail: true,
      employmentType: true,
      joinDate: true,
      exitDate: true,
      exitReason: true,
      departmentId: true,
      designationId: true,
      locationId: true,
      managerId: true,
      department: { select: { id: true, name: true, code: true, colorToken: true } },
      designation: { select: { title: true, level: true } },
      location: { select: { id: true, name: true, isRemote: true } },
      manager: { select: personRef },
      reports: {
        where: { status: { not: "EXITED" } },
        orderBy: { firstName: "asc" },
        select: personRef,
      },
      user: { select: { role: true } },
    },
  });
  if (!employee) notFound();

  const target = await targetFor(employee.id);
  const access = profileAccess(actorOf(user), target);
  if (employee.status === "EXITED" && !access.seeFormer) notFound();

  const [privateDetails, chain, peers, activity] = await Promise.all([
    access.seePrivate
      ? db.employee.findUnique({
          where: { id },
          select: {
            phone: true,
            personalEmail: true,
            dateOfBirth: true,
            address: true,
            emergencyContacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
          },
        })
      : null,
    db.employee.findMany({
      where: { id: { in: [...target.ownerManagerChain] } },
      select: personRef,
    }),
    employee.managerId
      ? db.employee.findMany({
          where: { managerId: employee.managerId, id: { not: id }, status: { not: "EXITED" } },
          orderBy: { firstName: "asc" },
          take: 12,
          select: personRef,
        })
      : [],
    // Change history can include private fields, so it follows private access.
    access.seePrivate
      ? db.auditLog.findMany({
          where: { entityType: "Employee", entityId: id },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            action: true,
            before: true,
            after: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
        })
      : [],
  ]);

  // Order the chain from the top of the company down to the direct manager.
  const byId = new Map(chain.map((c) => [c.id, c]));
  const reportingLine = [...target.ownerManagerChain]
    .reverse()
    .flatMap((cid) => byId.get(cid) ?? []);

  return {
    employee,
    access,
    privateDetails,
    reportingLine,
    peers,
    activity,
    isSelf: user.employee?.id === id,
  };
}

export type Profile = Awaited<ReturnType<typeof getProfile>>;

/** Choices for the job and new-employee forms. */
export async function getJobOptions() {
  const [departments, designations, locations, managers] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.designation.findMany({
      orderBy: [{ department: { name: "asc" } }, { level: "desc" }, { title: "asc" }],
      select: { id: true, title: true, level: true, departmentId: true },
    }),
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.employee.findMany({
      where: { status: { not: "EXITED" } },
      orderBy: { firstName: "asc" },
      select: personRef,
    }),
  ]);
  return { departments, designations, locations, managers };
}

export type JobOptions = Awaited<ReturnType<typeof getJobOptions>>;

/** Command palette and quick finders: a handful of best matches. */
export async function searchPeople(q: string, take = 8) {
  const query = q.trim().slice(0, 60);
  if (query.length < 2) return [];
  return db.employee.findMany({
    where: { AND: [{ status: { not: "EXITED" } }, ...searchWhere(query)] },
    orderBy: [{ firstName: "asc" }],
    take,
    select: { ...personRef, employeeCode: true, department: { select: { name: true } } },
  });
}

export async function getOrgNodes() {
  return db.employee.findMany({
    where: { status: { not: "EXITED" } },
    orderBy: [{ firstName: "asc" }],
    select: {
      ...personRef,
      managerId: true,
      employeeCode: true,
      department: { select: { name: true, colorToken: true } },
      location: { select: { isRemote: true } },
    },
  });
}

export type OrgNodeRow = Awaited<ReturnType<typeof getOrgNodes>>[number];
