import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs, type DemoRole } from "./helpers";

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

test.describe("analytics", () => {
  test("HR sees every report, charted by month for a year by default", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/analytics");
    for (const name of ["People", "Attrition", "Time off", "Attendance", "Hiring"])
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.getByText(/charted by month/)).toBeVisible();
    await expect(page.getByText("Hiring funnel")).toBeVisible();
    await expect(page.getByText("When people arrive")).toBeVisible();
  });

  test("a shorter range switches to weeks and lives in the URL", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/analytics");
    const period = page.getByRole("radiogroup", { name: "Period" });
    await retryUntil(
      () => period.getByRole("radio", { name: "3 months" }).click(),
      () => expect(period.getByRole("radio", { name: "3 months" })).toBeChecked({ timeout: 1000 }),
    );
    await expect(page).toHaveURL(/range=3m/, { timeout: 20_000 });
    await expect(page.getByText(/charted by week/)).toBeVisible();
    await page.reload();
    await expect(period.getByRole("radio", { name: "3 months" })).toBeChecked();
  });

  test("filtering to one department narrows every report", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/analytics");
    await retryUntil(
      () => page.getByRole("combobox", { name: "Department" }).click(),
      () =>
        expect(page.getByRole("option", { name: "Engineering" })).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("option", { name: "Engineering" }).click();
    await expect(page).toHaveURL(/dept=ENG/, { timeout: 20_000 });
    await expect(page.getByText(/· Engineering · charted/)).toBeVisible();
    // With one department, the breakdown switches from departments to roles.
    await expect(page.getByRole("heading", { name: "By role" })).toBeVisible();
  });

  test("every chart can be read as a table", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/analytics");
    const headcount = page.locator("section", {
      has: page.getByRole("heading", { name: "People" }),
    });
    await retryUntil(
      () => headcount.getByRole("button", { name: "Show as table" }).first().click(),
      () =>
        expect(headcount.getByRole("table", { name: "Headcount" })).toBeVisible({ timeout: 1000 }),
    );
    await expect(
      headcount
        .getByRole("table", { name: "Headcount" })
        .getByRole("columnheader", { name: "Joined" }),
    ).toBeVisible();
  });

  for (const role of ["EMPLOYEE", "TEAM_MANAGER"] as const) {
    test(`${role} can't open analytics, even by URL`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto("/analytics");
      await expect(
        page.getByRole("heading", { name: "This page isn't part of your role" }),
      ).toBeVisible();
    });
  }
});

test.describe("home", () => {
  test("managers see who's waiting on them and their team's day", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Your team today" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Team view" })).toBeVisible();
  });

  test("HR's home links through to analytics", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.locator("main").getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/analytics$/);
  });
});

test.describe("accessibility", () => {
  for (const [role, path] of [
    ["HR_MANAGER", "/analytics"],
    ["EMPLOYEE", "/home"],
    ["TEAM_MANAGER", "/home"],
    ["HR_MANAGER", "/home"],
  ] as [DemoRole, string][]) {
    test(`${path} as ${role} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
