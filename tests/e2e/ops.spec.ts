import { expect, test } from "@playwright/test";

test.describe("operations", () => {
  test("the health check reaches the database without a sign-in", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("the reminders job never runs for an anonymous caller", async ({ request }) => {
    // No CRON_SECRET in the test environment: the job is off, not open.
    const none = await request.get("/api/cron/reminders");
    expect(none.status()).toBe(503);
    const guess = await request.get("/api/cron/reminders", {
      headers: { Authorization: "Bearer let-me-in-please-0123456789" },
    });
    expect([401, 503]).toContain(guess.status());
  });

  test("every page carries the security headers", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
