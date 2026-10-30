import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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

const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

async function openRole(page: Page, title: string) {
  await page.goto("/hiring");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** The name on the first card in a column. */
async function firstName(col: Locator) {
  const text = await col.getByRole("listitem").first().getByRole("link").first().textContent();
  return text!.trim();
}

async function openMenu(page: Page, name: string) {
  await retryUntil(
    () => page.getByRole("button", { name: `Actions for ${name}` }).click(),
    () => expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 }),
  );
}

test.describe("hiring and lifecycle", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("the menu moves a candidate between stages, and it sticks", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openRole(page, "Senior Backend Engineer");
    const name = await firstName(column(page, "Applied"));
    await openMenu(page, name);
    await page.getByRole("menuitem", { name: "Interview" }).click();
    await expect(column(page, "Interview").getByRole("link", { name })).toBeVisible();
    await page.reload();
    await expect(column(page, "Interview").getByRole("link", { name })).toBeVisible();
    await expect(column(page, "Applied").getByRole("link", { name })).toHaveCount(0);
  });

  test("a keyboard user can move a candidate to the next stage", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openRole(page, "Senior Backend Engineer");
    const name = await firstName(column(page, "Applied"));
    const handle = page.getByRole("button", { name: `Move ${name}` });
    await retryUntil(
      async () => {
        await handle.focus();
        await page.keyboard.press("Space");
      },
      () => expect(handle).toHaveAttribute("aria-pressed", "true", { timeout: 1000 }),
    );
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.press("Space");
    await expect(column(page, "Screening").getByRole("link", { name })).toBeVisible();
    await page.reload();
    await expect(column(page, "Screening").getByRole("link", { name })).toBeVisible();
  });

  test("passing on someone needs a reason, and they can come back", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openRole(page, "Senior Backend Engineer");
    const name = await firstName(column(page, "Screening"));
    await openMenu(page, name);
    await page.getByRole("menuitem", { name: "Not moving forward" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Not moving forward" }).click();
    await expect(dialog.getByText("Add a short reason")).toBeVisible();
    await dialog.getByLabel("Why not?").fill("Looking for deeper distributed systems experience");
    await dialog.getByRole("button", { name: "Not moving forward" }).click();
    await expect(page.getByText(`${name} won't move forward`)).toBeVisible();
    await expect(column(page, "Screening").getByRole("link", { name })).toHaveCount(0);

    await page.getByRole("button", { name: /^Not moving forward/ }).click();
    await page.getByRole("button", { name: `Bring back ${name}` }).click();
    await expect(page.getByText(`${name} is back in`)).toBeVisible();
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  });

  test("notes and ratings build up on a candidate's profile", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await openRole(page, "Senior Backend Engineer");
    await page.getByRole("link", { name: await firstName(column(page, "Interview")) }).click();
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    await page.getByLabel("Add a note").fill("Thought clearly about failure modes in the design");
    await page.getByRole("radio", { name: "4 out of 5" }).click();
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Note added")).toBeVisible();
    await expect(page.getByText("Thought clearly about failure modes")).toBeVisible();
    await expect(page.getByText("out of 5").first()).toBeVisible();
  });

  test("a new candidate starts in Applied", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openRole(page, "Product Designer");
    await retryUntil(
      () => page.getByRole("button", { name: "Add candidate" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("First name").fill("Tara");
    await dialog.getByLabel("Last name").fill("Fernandes");
    await dialog.getByLabel("Email").fill("tara.fernandes@example.com");
    await dialog.getByRole("button", { name: "Add candidate" }).click();
    await expect(page.getByText("Candidate added")).toBeVisible();
    await expect(
      column(page, "Applied").getByRole("link", { name: "Tara Fernandes" }),
    ).toBeVisible();
  });

  test("converting an offer creates the employee and starts onboarding", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openRole(page, "Senior Backend Engineer");
    const name = await firstName(column(page, "Offer"));
    await page.getByRole("link", { name }).click();
    await retryUntil(
      () => page.getByRole("button", { name: "Convert to employee" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Work email")).toHaveValue(/@northwindgrove\.in$/);
    await dialog.getByRole("button", { name: "Complete hire" }).click();
    await expect(page).toHaveURL(/\/lifecycle\/\w+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("0 of 15 done")).toBeVisible();

    await page.goto("/people");
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("link", { name }).first()).toBeVisible();
  });

  test("finishing every task completes onboarding, with a celebration", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/lifecycle");
    await page.getByRole("link", { name: "Prerna Sinha" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Prerna Sinha");
    const open = page.getByRole("checkbox", { checked: false, disabled: false });
    await expect(open.first()).toBeVisible();
    while ((await open.count()) > 0) {
      const before = await open.count();
      await open.first().click();
      await expect(open).toHaveCount(before - 1);
    }
    await expect(page.getByText("is fully onboarded")).toBeVisible();
    await expect(page.getByText("All done")).toBeVisible();
    await page.reload();
    await expect(page.getByText("All done")).toBeVisible();
    await page.goto("/lifecycle?view=done");
    await expect(page.getByRole("link", { name: "Prerna Sinha" })).toBeVisible();
  });

  test("offboarding moves someone to notice and hands out tasks", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/lifecycle");
    await retryUntil(
      () => page.getByRole("button", { name: "Start offboarding" }).click(),
      () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 }),
    );
    const dialog = page.getByRole("dialog", { name: "Start offboarding" });
    await dialog.getByRole("combobox", { name: "Who's leaving" }).click();
    await page.getByPlaceholder("Search people").fill("Mehul Shah");
    await expect(page.getByRole("option", { name: /Mehul Shah/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("combobox", { name: "Who's leaving" })).toContainText(
      "Mehul Shah",
    );
    await dialog.getByRole("combobox", { name: "Reason" }).click();
    await page.getByRole("option", { name: "Higher studies" }).click();
    await dialog.getByRole("button", { name: "Start offboarding" }).click();
    await expect(page).toHaveURL(/\/lifecycle\/\w+/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Mehul Shah" })).toBeVisible();
    await expect(page.getByText("Higher studies")).toBeVisible();
  });

  test("saved template changes persist", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/lifecycle/templates");
    const card = page.locator("form").filter({ hasText: "Save template" }).first();
    await retryUntil(
      () => card.getByRole("button", { name: "Add a task" }).click(),
      () => expect(card.getByRole("group", { name: "Task 16" })).toBeVisible({ timeout: 1000 }),
    );
    await card
      .getByRole("group", { name: "Task 16" })
      .getByLabel("Task", { exact: true })
      .fill("Team photo");
    await card.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText("Template saved")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Task" }).last()).toBeVisible();
    // The fields take their values at hydration, so poll rather than read once.
    await expect
      .poll(() =>
        page
          .getByRole("textbox", { name: "Task", exact: true })
          .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value)),
      )
      .toContain("Team photo");
  });
});

test.describe("who can do what", () => {
  test("employees don't see hiring or onboarding", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    for (const path of ["/hiring", "/lifecycle", "/lifecycle/templates"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "This page isn't part of your role" }),
      ).toBeVisible();
    }
  });

  test("a hiring manager can work their own role but not complete a hire", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await openRole(page, "Frontend Engineer");
    await expect(page.getByRole("button", { name: /^Move / }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit role" })).toHaveCount(0);
    const name = await firstName(column(page, "Offer"));
    await openMenu(page, name);
    await expect(page.getByRole("menuitem", { name: "Not moving forward" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Convert to employee" })).toHaveCount(0);
  });

  test("other managers can read a role but not change it", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await openRole(page, "Account Executive");
    await expect(page.getByRole("region", { name: "Applied", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add candidate" })).toHaveCount(0);
  });

  test("managers see tasks for their new joiner on home", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Your tasks" })).toBeVisible();
    await expect(main.getByText("Ojaswini Mishra's onboarding").first()).toBeVisible();
  });

  test("a manager can only tick their own tasks", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await page.goto("/lifecycle");
    await page.getByRole("link", { name: "Ojaswini Mishra" }).click();
    await expect(page.getByRole("checkbox", { name: "Order and set up a laptop" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "Plan the first two weeks" })).toBeEnabled();
  });
});

test.describe("accessibility", () => {
  test("hiring pages have no serious axe violations", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, "HR_MANAGER");
    await page.goto("/hiring");
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Account Executive", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page
      .getByRole("region", { name: "Applied", exact: true })
      .getByRole("link")
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Journey" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("onboarding pages have no serious axe violations", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, "HR_MANAGER");
    await page.goto("/lifecycle");
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("link", { name: "Ojaswini Mishra" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto("/lifecycle/templates");
    expect(await seriousViolations(page)).toEqual([]);
  });
});
