import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs } from "./helpers";

const IST = "Asia/Kolkata";

/** A weekday ~3 weeks out, as the label react-day-picker gives its button. */
function futureWeekday(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 864e5);
  while ([0, 6].includes(new Date(d.toLocaleString("en-US", { timeZone: IST })).getDay()))
    d.setTime(d.getTime() + 864e5);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { month: get("month"), day: Number(get("day")), year: get("year") };
}

async function pickDay(page: Page, when: { month: string; day: number; year: string }) {
  await page.getByRole("button", { name: /^Dates/ }).click();
  const day = page
    .getByRole("button", {
      name: new RegExp(`${when.month} ${when.day}(st|nd|rd|th)?, ${when.year}`),
    })
    .first();
  await day.click();
  await page.keyboard.press("Escape");
}

async function seriousViolations(page: Page) {
  await page.waitForTimeout(1000);
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

test.describe("time and approvals", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("clocking in is one confirmed action and survives a reload", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/attendance");
    const clockIn = page.getByRole("button", { name: "Clock in" });
    await retryUntil(
      async () => {
        await clockIn.focus();
        await page.keyboard.press("Enter");
      },
      () => expect(page.getByText(/^Clocked in at \d\d:\d\d$/)).toBeVisible({ timeout: 3000 }),
    );
    await expect(page.getByText(/In since/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Clock out" })).toBeVisible();
  });

  test("the apply form explains notice rules before sending", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/leave");
    await retryUntil(
      () => page.getByRole("button", { name: "Apply for leave" }).click(),
      () =>
        expect(page.getByRole("dialog", { name: "Apply for leave" })).toBeVisible({
          timeout: 1000,
        }),
    );
    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: /^Earned leave/ }).click();
    await pickDay(page, futureWeekday(2));
    await expect(page.getByText(/needs 7 days' notice/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  test("leave goes from request to approval to celebration", async ({ page }) => {
    const when = futureWeekday(23);
    await signInAs(page, "EMPLOYEE");
    await page.goto("/leave");
    await retryUntil(
      () => page.getByRole("button", { name: "Apply for leave" }).click(),
      () =>
        expect(page.getByRole("dialog", { name: "Apply for leave" })).toBeVisible({
          timeout: 1000,
        }),
    );
    await pickDay(page, when);
    await expect(page.getByText(/^1$/).first()).toBeVisible();
    await page.getByLabel("Reason").fill("Dentist in the morning, errands after");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Request sent")).toBeVisible();
    await expect(page.getByText("waiting on Priya Raman").first()).toBeVisible();

    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/approvals");
    const card = page
      .getByRole("listitem")
      .filter({ hasText: "Arjun Mehta" })
      .filter({ hasText: "Dentist in the morning" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /^Approve/ }).click();
    await expect(page.getByText("1 approved")).toBeVisible();
    await expect(card).toHaveCount(0);

    await signInAs(page, "EMPLOYEE");
    await page.goto("/leave");
    await expect(page.getByText("Your leave is approved")).toBeVisible();
    await expect(page.getByText(/Approved by Priya Raman/).first()).toBeVisible();
  });

  test("a missed clock-out can be corrected through approvals", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/attendance");
    await page
      // An older day: today's clock-in can be later than the clock-out this test types.
      .getByRole("button", { name: /^Correct / })
      .last()
      .click();
    const sheet = page.getByRole("dialog", { name: "Correct a day" });
    await sheet.getByLabel("Clocked out at").fill("19:05");
    await sheet.getByLabel("What happened?").fill("Forgot to clock out after the release");
    await sheet.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByText("Correction sent")).toBeVisible();
    await expect(page.getByText("Correction pending").first()).toBeVisible();
  });

  test("declining needs a note", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/approvals");
    await page
      .getByRole("button", { name: /^Decline .*request/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: /Decline this request/ });
    await dialog.getByRole("button", { name: "Decline" }).click();
    await expect(dialog.getByText("Add a short note so they know why")).toBeVisible();
    await dialog
      .getByLabel("Note")
      .fill("That week is our release; could you move it by one week?");
    await dialog.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText(/1 declined/)).toBeVisible();
  });

  test("a manager can approve everything at once", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/approvals");
    await page.getByRole("checkbox", { name: "Select all requests" }).click();
    const bar = page.getByRole("region", { name: "Bulk actions" });
    await bar.getByRole("button", { name: "Approve all" }).click();
    await expect(page.getByText(/approved/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "You're all caught up" })).toBeVisible();
  });

  test("long leave goes on to HR after the manager", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/approvals");
    await expect(page.getByText(/Step 2 of 2/).first()).toBeVisible();
  });
});

test.describe("time screens", () => {
  test("managers see their team's day", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/attendance/team");
    await expect(page.getByRole("link", { name: /Fatima Shaikh/ })).toBeVisible();
  });

  test("employees can't open the team view", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/attendance/team");
    await expect(
      page.getByRole("heading", { name: "This page isn't part of your role" }),
    ).toBeVisible();
  });

  test("holidays show the next one coming up", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/holidays");
    await expect(page.getByText("Next holiday")).toBeVisible();
  });

  for (const [role, path] of [
    ["EMPLOYEE", "/attendance"],
    ["EMPLOYEE", "/leave"],
    ["TEAM_MANAGER", "/leave/calendar"],
    ["EMPLOYEE", "/holidays"],
    ["HR_MANAGER", "/approvals"],
    ["TEAM_MANAGER", "/attendance/team"],
  ] as const) {
    test(`${path} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
