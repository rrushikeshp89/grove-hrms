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

const ANSWER = "Shipped the migration without a single customer-facing incident.";

async function writeReview(page: Page, rowText: string, rating: number) {
  await page.goto("/performance?view=reviews");
  const row = page.getByRole("listitem").filter({ hasText: rowText });
  await row.getByRole("link", { name: /Write|Continue/ }).click();
  await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();
  for (const box of await page.getByRole("textbox").all()) await box.fill(ANSWER);
  await page.getByRole("radio", { name: `${rating} out of 5` }).click();
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Review submitted")).toBeVisible();
}

test.describe("goals", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("an employee sets a goal with a key result, then checks in", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance");
    await retryUntil(
      () => page.getByRole("button", { name: "New goal" }).click(),
      () => expect(page.getByRole("dialog", { name: "New goal" })).toBeVisible({ timeout: 1000 }),
    );
    const sheet = page.getByRole("dialog", { name: "New goal" });
    await sheet
      .getByLabel("Goal", { exact: true })
      .fill("Make directory search find people on the first try");
    await sheet.getByRole("button", { name: "Add a key result" }).click();
    const kr = sheet.getByRole("group", { name: "Key result 1" });
    await kr.getByLabel("What's measured").fill("Searches that end in a click");
    await kr.getByLabel("Start").fill("40");
    await kr.getByLabel("Now").fill("40");
    await kr.getByLabel("Target").fill("70");
    await sheet.getByRole("button", { name: "Create goal" }).click();

    await expect(page).toHaveURL(/\/performance\/goals\//, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Make directory search");
    await expect(page.getByText("0 of 1 key results done")).toBeVisible();

    await page.getByRole("button", { name: "Check in" }).click();
    const dialog = page.getByRole("dialog", { name: "Check in" });
    await dialog.getByLabel("Searches that end in a click").fill("55");
    await expect(dialog.getByText("This puts the goal at 50%.")).toBeVisible();
    await dialog
      .getByLabel("What changed?")
      .fill("Shipped the new ranking; early numbers look good.");
    await dialog.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.getByText("Check-in saved")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Overall progress: 50%" })).toBeVisible();
    await expect(page.getByText("Shipped the new ranking; early numbers look good.")).toBeVisible();
  });

  test("a check-in needs a note", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance");
    await page.getByRole("link", { name: /Make directory search/ }).click();
    await page.getByRole("button", { name: "Check in" }).click();
    const dialog = page.getByRole("dialog", { name: "Check in" });
    await dialog.getByRole("button", { name: "Save check-in" }).click();
    await expect(dialog.getByText("Add a line about what changed")).toBeVisible();
  });

  test("managers see their team's goals, employees don't get that tab", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/performance?view=team");
    await expect(page.getByRole("link", { name: /Make directory search/ })).toBeVisible();
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance");
    await expect(page.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
  });
});

test.describe("a review cycle", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("people write their self review; manager reviews stay locked until HR opens them", async ({
    page,
  }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance?view=reviews");
    await expect(page.getByText("H2 2026 is in self reviews")).toBeVisible();
    await expect(page.getByText("Peer feedback for Fatima Shaikh")).toBeVisible();
    // Submitting needs real answers and a rating; the form says what's missing.
    await page
      .getByRole("listitem")
      .filter({ hasText: "Your self review" })
      .getByRole("link", { name: "Write" })
      .click();
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Choose a rating")).toBeVisible();
    await expect(page.getByText("Write a little more (at least a sentence)").first()).toBeVisible();
    for (const box of await page.getByRole("textbox").all()) await box.fill(ANSWER);
    await page.getByRole("radio", { name: "4 out of 5" }).click();
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Review submitted")).toBeVisible();
    await expect(page).toHaveURL(/view=reviews/);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Your self review" }).getByText("Submitted"),
    ).toBeVisible();

    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/performance?view=reviews");
    await expect(page.getByText(/Opens with manager reviews/).first()).toBeVisible();
  });

  test("HR opens manager reviews, and the manager writes one", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/performance/cycles");
    await page.getByRole("link", { name: "H2 2026" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "H2 2026" })).toBeVisible();
    await retryUntil(
      () => page.getByRole("button", { name: "Open manager reviews" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Open manager reviews" }).click();
    await expect(page.getByText("Now in manager reviews")).toBeVisible();

    await signInAs(page, "TEAM_MANAGER");
    await writeReview(page, "Manager review for Arjun Mehta", 4);
  });

  test("managers can ask colleagues for peer feedback, who then see the request", async ({
    page,
  }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/performance");
    await page.getByRole("link", { name: "Your team's reviews" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "H2 2026" })).toBeVisible();
    await retryUntil(
      () => page.getByRole("button", { name: "Ask for feedback about Arjun Mehta" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("searchbox", { name: "Search colleagues" }).fill("Zainab");
    await dialog.getByRole("checkbox").first().click();
    await dialog.getByRole("button", { name: /^Send to 1/ }).click();
    await expect(page.getByText("Asked 1 person")).toBeVisible();
  });

  test("HR moves it to calibration, sees the spread, then closes it", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/performance/cycles");
    await page.getByRole("link", { name: "H2 2026" }).click();
    await retryUntil(
      () => page.getByRole("button", { name: "Move to calibration" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Move to calibration" }).click();
    await expect(page.getByRole("heading", { name: "Rating spread" })).toBeVisible();
    await expect(page.getByText(/rated · average/).first()).toBeVisible();

    await retryUntil(
      () => page.getByRole("button", { name: "Close and share results" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("dialog").getByRole("button", { name: "Close and share results" }).click();
    await expect(page.getByText("Now in closed")).toBeVisible();
  });

  test("once it closes, people see their results, with colleague feedback unattributed", async ({
    page,
  }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance?view=reviews");
    await expect(page.getByRole("heading", { name: "H2 2026 results" })).toBeVisible();
    await expect(page.getByText("You rated yourself").first()).toBeVisible();
    await expect(page.getByText(/Priya Raman rated you/).first()).toBeVisible();
  });
});

test.describe("who can see what", () => {
  test("only the people team manages cycles", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/performance/cycles");
    await expect(
      page.getByRole("heading", { name: "This page isn't part of your role" }),
    ).toBeVisible();
    await page.goto("/performance");
    await expect(page.getByRole("link", { name: "Review cycles" })).toHaveCount(0);
  });

  test("the people team can open any goal a manager can see", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/performance?view=team");
    const href = await page
      .getByRole("link", { name: /Ship the new billing API|Cut p95|Raise test|Make on-call/ })
      .first()
      .getAttribute("href");
    await signInAs(page, "HR_MANAGER");
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("accessibility", () => {
  for (const [role, path] of [
    ["EMPLOYEE", "/performance"],
    ["EMPLOYEE", "/performance?view=reviews"],
    ["TEAM_MANAGER", "/performance?view=team"],
    ["HR_MANAGER", "/performance/cycles"],
  ] as const) {
    test(`${path} as ${role} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
