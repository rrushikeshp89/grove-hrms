import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can, scopeFor, type Permission, type Target } from "@/lib/rbac";

import { ActionError } from "./action-error";
import { actorOf, type CurrentUser } from "./session";

/**
 * Inside an action, pass the transaction client so checks read the same
 * snapshot and don't need a second connection from the pool.
 */
type Client = Prisma.TransactionClient;

/** Every manager above an employee, nearest first. */
export async function managerChain(employeeId: string, client: Client = db): Promise<string[]> {
  const rows = await client.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE chain AS (
      SELECT "managerId" AS id, 1 AS depth FROM "Employee" WHERE id = ${employeeId}
      UNION ALL
      SELECT e."managerId", c.depth + 1 FROM "Employee" e JOIN chain c ON e.id = c.id
      WHERE c.depth < 20
    )
    SELECT id FROM chain WHERE id IS NOT NULL ORDER BY depth`;
  return rows.map((r) => r.id);
}

/** Everyone who reports to an employee, directly or indirectly. */
export async function reportIds(employeeId: string, client: Client = db): Promise<string[]> {
  const rows = await client.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, 1 AS depth FROM "Employee" WHERE "managerId" = ${employeeId}
      UNION ALL
      SELECT e.id, t.depth + 1 FROM "Employee" e JOIN tree t ON e."managerId" = t.id
      WHERE t.depth < 20
    )
    SELECT id FROM tree`;
  return rows.map((r) => r.id);
}

export async function targetFor(ownerId: string, client: Client = db): Promise<Target> {
  return { ownerId, ownerManagerChain: await managerChain(ownerId, client) };
}

/** Throws a user-facing ActionError unless the user may act on this owner's record. */
export async function assertCan(
  user: CurrentUser,
  permission: Permission,
  ownerId: string,
  client: Client = db,
) {
  if (!can(actorOf(user), permission, await targetFor(ownerId, client))) {
    throw new ActionError("You don't have access to do that for this person.");
  }
}

/**
 * Employee ids a user may see for a permission, or "all". Queries use this to
 * filter in SQL so out-of-scope rows never leave the database.
 */
export async function visibleEmployeeIds(
  user: CurrentUser,
  permission: Permission,
): Promise<"all" | string[]> {
  const scope = scopeFor(actorOf(user), permission);
  const self = user.employee?.id;
  if (scope === "all") return "all";
  if (!scope || !self) return [];
  if (scope === "own") return [self];
  return [self, ...(await reportIds(self))];
}
