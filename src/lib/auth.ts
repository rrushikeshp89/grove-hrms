import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "./db";
import { DEMO_RESET_EXAMPLE } from "./env";

/** Endpoints that would let one visitor lock everyone else out of a demo account. */
const DEMO_LOCKED = new Set([
  "/change-password",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/set-password",
]);

const DEMO_LOCKED_MESSAGE =
  "Demo accounts keep their password so everyone can sign in. " +
  `To try the reset flow, use another employee, for example ${DEMO_RESET_EXAMPLE}.`;

export const auth = betterAuth({
  appName: "Grove",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),

  emailAndPassword: {
    enabled: true,
    // Accounts are created by HR (Phase 3) or the seed, never self-serve.
    disableSignUp: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // Mail is queued in the outbox. In demo mode the reset screen reads it
      // back so visitors can finish the flow without an inbox.
      await db.emailOutbox.create({
        data: {
          to: user.email,
          kind: "password-reset",
          subject: "Reset your Grove password",
          link: url,
          body: `Someone asked to reset the password for ${user.email}. The link works for one hour: ${url}`,
        },
      });
    },
  },

  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "EMPLOYEE" },
      employeeId: { type: "string", required: false, input: false },
      isDemo: { type: "boolean", input: false, defaultValue: false },
      themePref: { type: "string", input: false, defaultValue: "SYSTEM" },
      densityPref: { type: "string", input: false, defaultValue: "COMFORTABLE" },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Signed copy of the session in a cookie, so most requests skip the DB.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // Per-IP limits on the endpoints worth guessing at. On by default in
  // production; AUTH_RATE_LIMIT=off disables them for end-to-end tests.
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT ? process.env.AUTH_RATE_LIMIT !== "off" : undefined,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/request-password-reset") {
        const email = String(
          (ctx.body as { email?: unknown } | undefined)?.email ?? "",
        ).toLowerCase();
        const user = await db.user.findUnique({ where: { email }, select: { isDemo: true } });
        if (user?.isDemo) throw new APIError("FORBIDDEN", { message: DEMO_LOCKED_MESSAGE });
      }
      if (DEMO_LOCKED.has(ctx.path)) {
        const session = await getSessionFromCtx(ctx);
        if ((session?.user as { isDemo?: boolean } | undefined)?.isDemo) {
          throw new APIError("FORBIDDEN", { message: DEMO_LOCKED_MESSAGE });
        }
      }
    }),
  },

  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Auditing a sign-in must never be the reason a sign-in fails.
          await db.auditLog
            .create({
              data: {
                actorId: session.userId,
                action: "auth.sign_in",
                entityType: "Session",
                entityId: session.id,
                ip: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
              },
            })
            .catch((error: unknown) => console.error("[audit] sign-in not recorded", error));
        },
      },
    },
  },

  // Must be last: copies Set-Cookie headers onto Server Action responses.
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
