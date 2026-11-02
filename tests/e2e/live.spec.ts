import { expect, test } from "@playwright/test";

import { retryUntil, ROLES, signInAs, type DemoRole } from "./helpers";

/**
 * Smoke tests for a deployed site (see playwright.live.config.ts). They cover
 * what a local run can't: Secure cookies over HTTPS, the pooled database, PDF
 * rendering in a serverless function, and the real file store.
 */
test.describe("the live site", () => {
  test("is up, reaches its database and sends its security headers", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const page = await request.get("/login");
    const h = page.headers();
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("shares a proper preview", async ({ request }) => {
    const html = await (await request.get("/login")).text();
    const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(og, "an og:image tag").toBeTruthy();
    const image = await request.get(og!);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("scheduled jobs refuse anonymous callers", async ({ request }) => {
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  });

  test("private routes send signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/payroll");
    await expect(page).toHaveURL(/\/login\?next=%2Fpayroll$/);
  });

  for (const role of Object.keys(ROLES) as DemoRole[]) {
    test(`${role} signs in over HTTPS and stays signed in`, async ({ page, context, baseURL }) => {
      await signInAs(page, role);
      const cookies = await context.cookies(baseURL!);
      const session = cookies.find((c) => c.name.includes("session_token"));
      expect(session?.name).toMatch(/^__Secure-/);
      expect(session?.secure).toBe(true);
      expect(session?.httpOnly).toBe(true);

      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(ROLES[role].name);
    });
  }
});

test.describe("files and PDFs on the live site", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "writes to the file store; desktop runs it once");

  test("a policy PDF comes back from the file store", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents?view=policies");
    const link = page.getByRole("link", { name: /^Open / }).first();
    await expect(link).toBeVisible();
    const res = await page.request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("an upload reaches the file store, opens, and deletes cleanly", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/documents");
    const open = page.getByRole("button", { name: "Upload", exact: true }).first();
    const sheet = page.getByRole("dialog", { name: "Upload a document" });
    await retryUntil(
      () => open.click(),
      () => expect(sheet).toBeVisible({ timeout: 1000 }),
    );
    const title = `live check ${Date.now()}`;
    await sheet.getByLabel("File").setInputFiles({
      name: `${title.replaceAll(" ", "-")}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
    });
    await expect(sheet.getByLabel("Name")).toHaveValue(title);
    await sheet.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText("Document added")).toBeVisible();

    const link = page.getByRole("link", { name: `Open ${title}` });
    const href = (await link.getAttribute("href"))!;
    const res = await page.request.get(href);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Document deleted")).toBeVisible();
    expect((await page.request.get(href)).status()).toBe(404);
  });

  test("a payslip renders as a PDF in a serverless function", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/pay");
    const slip = page.locator('a[href^="/pay/"]').first();
    await expect(slip).toBeVisible();
    const res = await page.request.get(`${await slip.getAttribute("href")}/pdf`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("HR exports work, and stay closed to everyone else", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    const report = await page.request.get("/analytics/export?range=12m");
    expect(report.status()).toBe(200);
    expect((await report.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const people = await page.request.get("/people/export");
    expect(people.status()).toBe(200);
    expect(await people.text()).toContain("Employee ID");

    await signInAs(page, "EMPLOYEE");
    expect((await page.request.get("/analytics/export")).status()).toBe(403);
  });
});
