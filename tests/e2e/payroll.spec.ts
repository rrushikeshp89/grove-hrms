import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs } from "./helpers";

async function seriousViolations(page: Page) {
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

test.describe("a pay run, start to finish", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  let month = "";
  let payslipHref = "";

  test("HR prepares a draft run for the latest month and sends it for review", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/payroll");
    await expect(page.getByText(/Payroll in Grove is a simulation/)).toBeVisible();
    const picker = page.getByRole("combobox", { name: "Month to run" });
    await expect(picker).toBeVisible();
    // The selected month renders once the control has hydrated.
    await expect(picker).toContainText(/\d{4}/);
    month = ((await picker.textContent()) ?? "").trim();
    expect(month).toMatch(/^[A-Z][a-z]+ \d{4}$/);

    await retryUntil(
      () => page.getByRole("button", { name: "Start run" }).click(),
      () => expect(page).toHaveURL(/\/payroll\/\w+/, { timeout: 15_000 }),
      45_000,
    );
    await expect(page.getByRole("heading", { level: 1, name: month })).toBeVisible();
    await expect(page.getByText("A draft. Check the changes below")).toBeVisible();
    await expect(page.getByText("People paid")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Compared with/ })).toBeVisible();

    // The table can be searched.
    await page.getByRole("searchbox", { name: "Search this run" }).fill("Arjun");
    await expect(page.getByRole("link", { name: /Arjun Mehta/ })).toBeVisible();

    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByText("Sent for review")).toBeVisible();
    await expect(page.getByText(/Waiting for someone other than the preparer/)).toBeVisible();
  });

  test("the person who prepared it can't finalize it", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/payroll");
    await page.getByRole("link", { name: month }).click();
    await expect(page.getByRole("button", { name: "Finalize" })).toBeDisabled();
    await expect(
      page.getByText("You prepared this run, so someone else needs to finalize it."),
    ).toBeVisible();
  });

  test("an unfinished run's payslips stay private to payroll staff", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/payroll");
    await page.getByRole("link", { name: month }).click();
    await page.getByRole("searchbox", { name: "Search this run" }).fill("Arjun");
    payslipHref = (await page.getByRole("link", { name: /Arjun Mehta/ }).getAttribute("href"))!;
    await signInAs(page, "EMPLOYEE");
    await page.goto(payslipHref);
    await expect(page.getByRole("heading", { name: "This page isn't here" })).toBeVisible();
    const pdf = await page.request.get(`${payslipHref}/pdf`);
    expect(pdf.status()).toBe(404);
  });

  test("a second person finalizes it, and payslips go out", async ({ page }) => {
    await signInAs(page, "SUPER_ADMIN");
    await page.goto("/payroll");
    await page.getByRole("link", { name: month }).click();
    await retryUntil(
      () => page.getByRole("button", { name: "Finalize" }).click(),
      () =>
        expect(page.getByRole("dialog", { name: `Finalize ${month}?` })).toBeVisible({
          timeout: 1000,
        }),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Finalize" }).click();
    await expect(page.getByText(`${month} is final`)).toBeVisible();
    await expect(page.getByText("Final. Payslips are visible")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalize" })).toHaveCount(0);
  });

  test("employees then see their payslip and can download it as a PDF", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/pay");
    await expect(page.getByRole("link", { name: new RegExp(month) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(month) }).click();
    await expect(page.getByRole("heading", { level: 1, name: month })).toBeVisible();
    await expect(page.getByText("Gross earnings")).toBeVisible();
    await expect(page.getByText("Total deductions")).toBeVisible();

    const href = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toMatch(/payslip-\d{4}-\d{2}-GRV-\d+\.pdf/);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("and a colleague still can't open it", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    const res = await page.request.get(`${payslipHref}/pdf`);
    expect(res.status()).toBe(404);
  });

  test("HR revises a salary: a paid month is protected, a future date is fine", async ({
    page,
  }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/payroll/structures");
    await page.getByRole("searchbox", { name: "Search people" }).fill("Arjun Mehta");
    await retryUntil(
      () => page.getByRole("button", { name: "Revise salary for Arjun Mehta" }).click(),
      () =>
        expect(page.getByRole("dialog", { name: "Revise salary" })).toBeVisible({ timeout: 1000 }),
    );
    const sheet = page.getByRole("dialog", { name: "Revise salary" });
    await sheet.getByLabel("Yearly CTC (₹)").fill("2400000");
    // The preview updates as you type: 24 lakh is 2 lakh a month, gross.
    await expect(sheet.getByText("A full month would look like")).toBeVisible();
    await sheet.getByLabel("Effective from").fill("2020-01-01");
    await sheet.getByRole("button", { name: "Save revision" }).click();
    await expect(sheet.getByText("Pick a date after the last finalized month")).toBeVisible();
    await sheet.getByLabel("Effective from").fill("2031-01-01");
    await sheet.getByRole("button", { name: "Save revision" }).click();
    await expect(page.getByText("Salary revised")).toBeVisible();
  });
});

test.describe("who can see pay", () => {
  test("only the people team opens payroll", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    for (const path of ["/payroll", "/payroll/structures"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "This page isn't part of your role" }),
      ).toBeVisible();
    }
  });

  test("everyone sees a plain statement that payroll is simulated", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/pay");
    await expect(page.getByText("Simulated payroll").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payslips" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your package" })).toBeVisible();
  });
});

test.describe("accessibility", () => {
  for (const [role, path] of [
    ["EMPLOYEE", "/pay"],
    ["HR_MANAGER", "/payroll"],
    ["HR_MANAGER", "/payroll/structures"],
  ] as const) {
    test(`${path} as ${role} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
