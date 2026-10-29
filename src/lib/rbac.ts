import type { Role } from "./roles";

/**
 * Role-based access control. Pure and dependency-free so the same rules run
 * on the server (authoritative) and in the UI (to hide what you can't do).
 *
 * A grant is a permission plus a scope:
 *   own  → only records about yourself
 *   team → yourself and everyone who reports to you, directly or indirectly
 *   all  → everyone
 */
export type Scope = "own" | "team" | "all";

export const PERMISSIONS = {
  "employee.read": "View people and profiles",
  "employee.readSensitive": "View personal details (DOB, address, emergency contacts)",
  "employee.update": "Edit profiles",
  "employee.create": "Add and import employees",
  "org.manage": "Manage departments and designations",
  "attendance.read": "View attendance",
  "attendance.clock": "Clock in and out",
  "leave.apply": "Apply for leave",
  "leave.read": "View leave and balances",
  "leave.approve": "Approve leave and regularization",
  "leave.configure": "Configure leave types, policies and holidays",
  "payroll.read": "View payslips",
  "payroll.run": "Run payroll",
  "performance.read": "View goals and reviews",
  "performance.review": "Write manager reviews",
  "performance.manageCycles": "Run review cycles",
  "recruitment.read": "View jobs and candidates",
  "recruitment.manage": "Manage jobs and move candidates",
  "documents.read": "View documents",
  "documents.manage": "Upload and manage documents",
  "announcements.publish": "Publish announcements",
  "analytics.read": "View company analytics",
  "audit.read": "View the audit log",
  "settings.company": "Edit company settings",
  "roles.read": "View roles and access",
  "roles.assign": "Change someone's role",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const EVERYONE = {
  "employee.read": "all",
  "employee.readSensitive": "own",
  "employee.update": "own",
  "attendance.read": "own",
  "attendance.clock": "own",
  "leave.apply": "own",
  "leave.read": "own",
  "payroll.read": "own",
  "performance.read": "own",
  "documents.read": "own",
} as const satisfies Partial<Record<Permission, Scope>>;

export const GRANTS: Record<Role, Partial<Record<Permission, Scope>>> = {
  EMPLOYEE: { ...EVERYONE },
  TEAM_MANAGER: {
    ...EVERYONE,
    "employee.readSensitive": "team",
    "attendance.read": "team",
    "leave.read": "team",
    "leave.approve": "team",
    "performance.read": "team",
    "performance.review": "team",
    "recruitment.read": "all",
    "documents.read": "team",
  },
  HR_MANAGER: {
    ...EVERYONE,
    "employee.readSensitive": "all",
    "employee.update": "all",
    "employee.create": "all",
    "org.manage": "all",
    "attendance.read": "all",
    "leave.read": "all",
    "leave.approve": "all",
    "leave.configure": "all",
    "payroll.read": "all",
    "payroll.run": "all",
    "performance.read": "all",
    "performance.review": "team",
    "performance.manageCycles": "all",
    "recruitment.read": "all",
    "recruitment.manage": "all",
    "documents.read": "all",
    "documents.manage": "all",
    "announcements.publish": "all",
    "analytics.read": "all",
    "roles.read": "all",
  },
  SUPER_ADMIN: Object.fromEntries(
    (Object.keys(PERMISSIONS) as Permission[]).map((p) => [p, "all" as Scope]),
  ),
};

/** The subject of a check: who is acting. */
export type Actor = { role: Role; employeeId: string | null };

/**
 * The record being acted on, described by its owner. `ownerManagerChain`
 * lists every manager above the owner (direct manager first), which is how
 * "team" scope is decided without a database call here.
 */
export type Target = { ownerId: string; ownerManagerChain: readonly string[] };

const RANK: Record<Scope, number> = { own: 0, team: 1, all: 2 };

export function scopeFor(actor: Actor, permission: Permission): Scope | null {
  return GRANTS[actor.role][permission] ?? null;
}

/**
 * Without a target: "may this person ever do this?" (used for navigation and
 * route guards). With a target: "may they do it to this record?".
 */
export function can(actor: Actor, permission: Permission, target?: Target): boolean {
  const scope = scopeFor(actor, permission);
  if (!scope) return false;
  if (!target || scope === "all") return true;
  if (!actor.employeeId) return false;
  if (target.ownerId === actor.employeeId) return true;
  return scope === "team" && target.ownerManagerChain.includes(actor.employeeId);
}

/** Whether role `a` has at least the reach of role `b` for a permission. */
export function covers(a: Scope | null, b: Scope | null): boolean {
  if (b === null) return true;
  if (a === null) return false;
  return RANK[a] >= RANK[b];
}
