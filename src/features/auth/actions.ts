"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_MODE, DEMO_PASSWORD } from "@/lib/env";
import { ActionError, type ActionResult } from "@/server/action-error";
import { createAction } from "@/server/action";

import {
  changePasswordSchema,
  demoSignInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  safeNext,
  signInSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
} from "./schemas";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const WRONG_CREDENTIALS =
  "That email and password don't match. Check for typos, or reset your password.";

export async function signIn(input: SignInInput, next?: string): Promise<ActionResult<never>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Some fields need another look.",
      fieldErrors: fieldErrors(parsed.error),
    };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError) {
      if (e.status === "TOO_MANY_REQUESTS") {
        return { ok: false, error: "Too many attempts. Wait a minute, then try again." };
      }
      return { ok: false, error: WRONG_CREDENTIALS };
    }
    throw e;
  }
  // Someone who has left still has a credential row; don't let them in.
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { employee: { select: { status: true } } },
  });
  if (user?.employee?.status === "EXITED") {
    await auth.api.signOut({ headers: await headers() });
    return {
      ok: false,
      error: "This account is no longer active. Contact HR if you think that's a mistake.",
    };
  }
  redirect(safeNext(next));
}

export async function signInAsDemo(input: { role: string }): Promise<ActionResult<never>> {
  if (!DEMO_MODE) return { ok: false, error: "Demo sign-in is turned off on this deployment." };
  const parsed = demoSignInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick one of the demo roles." };

  const user = await db.user.findFirst({
    where: { isDemo: true, role: parsed.data.role },
    select: { email: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "The demo accounts haven't been created yet. Run npm run db:seed, then try again.",
    };
  }
  const h = await headers();
  // Switching roles from inside the app: end the current session first.
  if (await auth.api.getSession({ headers: h })) {
    await auth.api.signOut({ headers: h });
  }
  try {
    await auth.api.signInEmail({
      body: { email: user.email, password: DEMO_PASSWORD },
      headers: h,
    });
  } catch (e) {
    if (e instanceof APIError)
      return { ok: false, error: "Demo sign-in didn't work. The demo data may need reseeding." };
    throw e;
  }
  redirect("/home");
}

export type ForgotPasswordResult = {
  /** Only in demo mode: the link the email would have contained. */
  demoLink: string | null;
};

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ActionResult<ForgotPasswordResult>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Some fields need another look.",
      fieldErrors: fieldErrors(parsed.error),
    };

  const startedAt = new Date();
  try {
    await auth.api.requestPasswordReset({
      body: { email: parsed.data.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError && e.status === "FORBIDDEN") return { ok: false, error: e.message };
    if (e instanceof APIError && e.status === "TOO_MANY_REQUESTS") {
      return { ok: false, error: "Too many reset requests. Wait a minute, then try again." };
    }
    throw e;
  }

  if (!DEMO_MODE) return { ok: true, data: { demoLink: null } };
  const mail = await db.emailOutbox.findFirst({
    where: { to: parsed.data.email, kind: "password-reset", createdAt: { gte: startedAt } },
    orderBy: { createdAt: "desc" },
  });
  return { ok: true, data: { demoLink: mail?.link ?? null } };
}

export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult<never>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Some fields need another look.",
      fieldErrors: fieldErrors(parsed.error),
    };
  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) {
      return {
        ok: false,
        error: "This reset link has expired or was already used. Request a new one and try again.",
      };
    }
    throw e;
  }
  redirect("/login?reset=1");
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export const changePassword = createAction({
  schema: changePasswordSchema,
  handler: async ({ input, user, audit }) => {
    if (user.isDemo) {
      throw new ActionError("Demo accounts keep their password so every visitor can sign in.");
    }
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.password,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (e) {
      if (e instanceof APIError) {
        throw new ActionError("Your current password isn't right.", {
          currentPassword: ["Your current password isn't right."],
        });
      }
      throw e;
    }
    audit({ action: "auth.change_password", entityType: "User", entityId: user.id });
    return true;
  },
}) satisfies (input: ChangePasswordInput) => Promise<ActionResult<boolean>>;

export const revokeSession = createAction({
  schema: z.object({ sessionId: z.string().min(1) }),
  handler: async ({ input, user, tx, audit }) => {
    // Look the token up ourselves so a user can only revoke their own sessions.
    const session = await tx.session.findFirst({ where: { id: input.sessionId, userId: user.id } });
    if (!session) return false;
    await tx.session.delete({ where: { id: session.id } });
    audit({ action: "auth.revoke_session", entityType: "Session", entityId: session.id });
    return true;
  },
});

export const revokeOtherSessions = createAction({
  schema: z.object({}),
  handler: async ({ user, tx, audit }) => {
    const { count } = await tx.session.deleteMany({
      where: { userId: user.id, id: { not: user.sessionId } },
    });
    audit({
      action: "auth.revoke_other_sessions",
      entityType: "User",
      entityId: user.id,
      after: { count },
    });
    return count;
  },
});
