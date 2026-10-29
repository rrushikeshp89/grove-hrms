import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { CurrentUser } from "./session";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
  },
}));

const auditCreateMany = vi.fn();
const tx = { auditLog: { createMany: auditCreateMany } };
vi.mock("@/lib/db", () => ({
  db: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) },
}));

let currentUser: CurrentUser | null = null;
vi.mock("./session", () => ({
  getCurrentUser: async () => currentUser,
  actorOf: (u: CurrentUser) => ({ role: u.role, employeeId: u.employee?.id ?? null }),
}));

const { createAction } = await import("./action");
const { ActionError } = await import("./action-error");

function user(role: CurrentUser["role"]): CurrentUser {
  return {
    id: "usr_1",
    name: "Priya Raman",
    email: "priya.raman@northwindgrove.in",
    role,
    isDemo: false,
    themePref: "SYSTEM",
    densityPref: "COMFORTABLE",
    sessionId: "ses_1",
    employee: {
      id: "emp_1",
      code: "GRV-0007",
      firstName: "Priya",
      preferredName: null,
      lastName: "Raman",
      avatarUrl: null,
      designation: "Engineering Manager",
      department: "Engineering",
    },
  };
}

const schema = z.object({ days: z.number().min(0.5, "At least half a day") });

describe("createAction", () => {
  beforeEach(() => {
    currentUser = user("TEAM_MANAGER");
    auditCreateMany.mockReset();
  });

  it("rejects signed-out callers before doing anything", async () => {
    currentUser = null;
    const handler = vi.fn();
    const result = await createAction({ schema, handler })({ days: 1 });
    expect(result).toEqual({
      ok: false,
      error: "Your session has ended. Sign in again to continue.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns field errors from the shared schema", async () => {
    const handler = vi.fn();
    const result = await createAction({ schema, handler })({ days: 0 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.days).toEqual(["At least half a day"]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks the permission after validation and before the handler", async () => {
    currentUser = user("EMPLOYEE");
    const handler = vi.fn();
    const result = await createAction({ schema, permission: "leave.approve", handler })({
      days: 1,
    });
    expect(result).toEqual({ ok: false, error: "You don't have access to do that." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler and writes queued audit entries with request metadata", async () => {
    const result = await createAction({
      schema,
      permission: "leave.approve",
      handler: async ({ input, audit }) => {
        audit({
          action: "leave.approve",
          entityType: "Request",
          entityId: "req_1",
          after: { days: input.days },
        });
        return input.days * 2;
      },
    })({ days: 1.5 });
    expect(result).toEqual({ ok: true, data: 3 });
    expect(auditCreateMany).toHaveBeenCalledWith({
      data: [
        {
          action: "leave.approve",
          entityType: "Request",
          entityId: "req_1",
          after: { days: 1.5 },
          actorId: "usr_1",
          ip: "203.0.113.7",
          userAgent: "vitest",
        },
      ],
    });
  });

  it("shows ActionError messages and hides unexpected ones", async () => {
    const friendly = await createAction({
      schema,
      handler: async () => {
        throw new ActionError("Those dates overlap a request you already made.");
      },
    })({ days: 1 });
    expect(friendly).toEqual({
      ok: false,
      error: "Those dates overlap a request you already made.",
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const hidden = await createAction({
      schema,
      handler: async () => {
        throw new Error("connection reset by peer");
      },
    })({ days: 1 });
    expect(hidden.ok).toBe(false);
    expect(!hidden.ok && hidden.error).not.toContain("connection reset");
    spy.mockRestore();
  });

  it("lets Next redirects propagate", async () => {
    const redirecting = createAction({
      schema,
      handler: async () => {
        throw new Error("NEXT_REDIRECT");
      },
    });
    await expect(redirecting({ days: 1 })).rejects.toThrow("NEXT_REDIRECT");
  });
});
