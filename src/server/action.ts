import "server-only";

import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { db, type Prisma } from "@/lib/db";
import { can, type Permission } from "@/lib/rbac";

import { ActionError, type ActionResult } from "./action-error";
import { actorOf, getCurrentUser, type CurrentUser } from "./session";

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export type ActionContext<I> = {
  input: I;
  user: CurrentUser;
  tx: Prisma.TransactionClient;
  /** Queue an audit entry; it's written in the same transaction. */
  audit: (entry: AuditEntry) => void;
};

const GENERIC_ERROR = "Something went wrong on our side and nothing was saved. Please try again.";

/**
 * Every mutation goes through here, in this order:
 *   1. authenticate   2. validate with the shared Zod schema
 *   3. authorize (role-level; handlers add record-level checks with assertCan)
 *   4. run the handler and its audit entries in one transaction
 * Results are typed so forms can show field errors without try/catch.
 */
export function createAction<S extends z.ZodType, T>(opts: {
  schema: S;
  permission?: Permission;
  handler: (ctx: ActionContext<z.output<S>>) => Promise<T>;
}) {
  return async function action(input: z.input<S>): Promise<ActionResult<T>> {
    try {
      const user = await getCurrentUser();
      if (!user) return { ok: false, error: "Your session has ended. Sign in again to continue." };

      const parsed = opts.schema.safeParse(input);
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        return {
          ok: false,
          error: flat.formErrors[0] ?? "Some fields need another look.",
          fieldErrors: flat.fieldErrors as Record<string, string[]>,
        };
      }

      if (opts.permission && !can(actorOf(user), opts.permission)) {
        return { ok: false, error: "You don't have access to do that." };
      }

      const h = await headers();
      const meta = {
        actorId: user.id,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent"),
      };

      const data = await db.$transaction(async (tx) => {
        const pending: AuditEntry[] = [];
        const result = await opts.handler({
          input: parsed.data,
          user,
          tx,
          audit: (entry) => pending.push(entry),
        });
        if (pending.length) {
          await tx.auditLog.createMany({ data: pending.map((e) => ({ ...e, ...meta })) });
        }
        return result;
      });
      return { ok: true, data };
    } catch (error) {
      // Let Next's redirect()/notFound() through.
      unstable_rethrow(error);
      if (error instanceof ActionError) {
        return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
      }
      console.error("[action]", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  };
}
