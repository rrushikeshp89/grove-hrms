import { describe, expect, it } from "vitest";

import { changePasswordSchema, resetPasswordSchema, safeNext, signInSchema } from "./schemas";

describe("safeNext", () => {
  it.each([
    [undefined, "/home"],
    ["/settings", "/settings"],
    ["/people/emp_1?tab=job", "/people/emp_1?tab=job"],
    ["https://evil.example", "/home"],
    ["//evil.example", "/home"],
    ["/\\evil.example", "/home"],
    ["/login", "/home"],
    ["/api/auth/sign-out", "/home"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("auth schemas", () => {
  it("normalizes the sign-in email", () => {
    expect(
      signInSchema.parse({ email: "  Priya.Raman@NorthwindGrove.in ", password: "x" }).email,
    ).toBe("priya.raman@northwindgrove.in");
  });

  it("requires matching, long-enough new passwords", () => {
    const short = resetPasswordSchema.safeParse({
      token: "t",
      password: "short",
      confirm: "short",
    });
    expect(short.success).toBe(false);
    const mismatch = resetPasswordSchema.safeParse({
      token: "t",
      password: "long-enough-1",
      confirm: "long-enough-2",
    });
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirm"]);
  });

  it("rejects reusing the current password", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "same-password-1",
      password: "same-password-1",
      confirm: "same-password-1",
    });
    expect(r.error?.issues.map((i) => i.path[0])).toContain("password");
  });
});
