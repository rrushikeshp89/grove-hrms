import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Actor, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isDemo: boolean;
  themePref: "SYSTEM" | "LIGHT" | "DARK";
  densityPref: "COMFORTABLE" | "COMPACT";
  sessionId: string;
  employee: {
    id: string;
    code: string;
    firstName: string;
    preferredName: string | null;
    lastName: string;
    avatarUrl: string | null;
    designation: string;
    department: string;
  } | null;
};

/**
 * The Data Access Layer's front door. Reads the session cookie, then loads
 * role and employee fresh from the database so a role change applies on the
 * next request rather than when the cookie cache expires. Deduplicated per
 * request with React's cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isDemo: true,
      themePref: true,
      densityPref: true,
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          preferredName: true,
          lastName: true,
          avatarUrl: true,
          status: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
        },
      },
    },
  });
  // A deleted user, or someone who has left, no longer gets in.
  if (!user || user.employee?.status === "EXITED") return null;
  const e = user.employee;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isDemo: user.isDemo,
    themePref: user.themePref,
    densityPref: user.densityPref,
    sessionId: session.session.id,
    employee: e
      ? {
          id: e.id,
          code: e.employeeCode,
          firstName: e.firstName,
          preferredName: e.preferredName,
          lastName: e.lastName,
          avatarUrl: e.avatarUrl,
          designation: e.designation.title,
          department: e.department.name,
        }
      : null,
  };
});

export function actorOf(user: Pick<CurrentUser, "role" | "employee">): Actor {
  return { role: user.role, employeeId: user.employee?.id ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Page guard: renders app/forbidden.tsx when the role lacks the permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(actorOf(user), permission)) forbidden();
  return user;
}
