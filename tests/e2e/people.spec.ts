import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs } from "./helpers";

async function openProfile(page: Page, name: string) {
  await page.goto(`/people?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("link", { name: new RegExp(`^${name},`) })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
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

test.describe("directory", () => {
  test("search narrows results and lives in the URL", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/people");
    const search = page.getByRole("searchbox", { name: "Search people" });
    await retryUntil(
      async () => {
        await search.fill("");
        await search.fill("kashyap");
      },
      () => expect(page).toHaveURL(/q=kashyap/, { timeout: 2000 }),
    );
    await expect(page.getByRole("link", { name: /^Siddharth Kashyap,/ })).toBeVisible();
    await expect(page.getByText("1 person matching")).toBeVisible();
  });

  test("filters and the table view can be shared as a link", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/people?department=DES&view=table");
    const table = page.getByRole("table", { name: "People directory" });
    await expect(table).toBeVisible();
    // Every row is a designer (other tests may add people, so don't count).
    await expect(table.locator("tbody tr").first()).toBeVisible();
    await expect(table.locator("tbody tr").filter({ hasNotText: "Design" })).toHaveCount(0);
    await table.getByRole("row", { name: /^Malini Rajagopal/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Malini Rajagopal" })).toBeVisible();
  });

  test("an unknown search explains what to try", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/people?q=zzzz");
    await expect(page.getByRole("heading", { name: "No one matches “zzzz”" })).toBeVisible();
  });

  test("former employees are hidden from everyone but HR", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/people?status=EXITED");
    await expect(page.getByText("Former employee")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Siddharth Kashyap,/ })).toBeVisible();
  });

  test("HR can list former employees", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/people?status=EXITED");
    await expect(page.getByText(/^9\s+people$/)).toBeVisible();
    await expect(page.getByText("Former employee").first()).toBeVisible();
  });
});

test.describe("profiles", () => {
  test.skip(({ isMobile }) => isMobile, "edits shared data; desktop runs it once");

  test("people edit their own profile and see it in their history", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await openProfile(page, "Arjun Mehta");
    await page.getByRole("button", { name: "Edit: About" }).click();
    await page
      .getByRole("textbox", { name: /^About/ })
      .fill("Frontend for the leave and attendance screens.");
    const skills = page.getByRole("textbox", { name: /^Skills/ });
    await skills.fill("Accessibility");
    await skills.press("Enter");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated")).toBeVisible();
    await expect(page.getByText("Frontend for the leave and attendance screens.")).toBeVisible();
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByText(/Updated bio and skills/)).toBeVisible();
  });

  test("colleagues see the public profile only", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await openProfile(page, "Fatima Shaikh");
    await expect(page.getByRole("tab", { name: "Personal" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Activity" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
    await expect(page.getByText(/Private details and history are visible to Fatima/)).toBeVisible();
  });

  test("managers can read but not change their reports' private details", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    await openProfile(page, "Arjun Mehta");
    await page.getByRole("tab", { name: "Personal" }).click();
    await expect(page.getByRole("region", { name: "Private details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit: Private details" })).toHaveCount(0);
  });

  test("HR changes a designation and it shows in the timeline", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openProfile(page, "Fatima Shaikh");
    await page.getByRole("button", { name: "Edit: Job" }).click();
    await page.getByRole("combobox", { name: "Designation" }).click();
    await page.getByRole("option", { name: "Senior Backend Engineer" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Job details updated")).toBeVisible();
    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(page.getByText("Backend Engineer → Senior Backend Engineer")).toBeVisible();
  });

  test("HR can't create a reporting loop", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openProfile(page, "Priya Raman");
    await page.getByRole("button", { name: "Edit: Job" }).click();
    await page.getByRole("combobox", { name: "Reports to" }).click();
    await page.getByPlaceholder("Search by name or role").fill("Arjun Mehta");
    await expect(page.getByRole("option", { name: /Arjun Mehta/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("This person already reports to them, directly or indirectly"),
    ).toBeVisible();
  });

  test("HR adds a new employee", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/people");
    await page.getByRole("button", { name: "Add employee" }).click();
    const sheet = page.getByRole("dialog", { name: "Add an employee" });
    await sheet.getByLabel("First name").fill("Meenakshi");
    await sheet.getByLabel("Last name").fill("Sundaram");
    await expect(sheet.getByLabel("Work email")).toHaveValue(
      "meenakshi.sundaram@northwindgrove.in",
    );
    await sheet.getByRole("combobox", { name: "Department" }).click();
    await page.getByRole("option", { name: "Design" }).click();
    await sheet.getByRole("combobox", { name: "Designation" }).click();
    await page.getByRole("option", { name: "Product Designer" }).click();
    await sheet.getByRole("combobox", { name: "Reports to" }).click();
    await page.getByPlaceholder("Search by name or role").fill("Malini");
    await expect(page.getByRole("option", { name: /Malini Rajagopal/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await sheet.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Meenakshi Sundaram" })).toBeVisible();
    await expect(page.getByText(/GRV-0\d{3}/).first()).toBeVisible();
  });
});

test.describe("departments", () => {
  test("HR creates a department and adds a title", async ({ page, isMobile }) => {
    test.skip(isMobile, "edits shared data; desktop runs it once");
    await signInAs(page, "HR_MANAGER");
    await page.goto("/departments");
    await page.getByRole("button", { name: "New department" }).click();
    const sheet = page.getByRole("dialog", { name: "New department" });
    await sheet.getByLabel("Name").fill("Research");
    await sheet.getByLabel("Code").fill("res");
    await sheet.getByRole("button", { name: "Create department" }).click();
    await expect(page.getByText("Department created")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Research/ })).toBeVisible();

    await page.getByRole("button", { name: "Edit Research" }).click();
    await page.getByRole("button", { name: "Add a title" }).click();
    await page.getByLabel("Title", { exact: true }).fill("Research Scientist");
    await page.getByRole("button", { name: "Save title" }).click();
    await expect(page.getByText("Title added")).toBeVisible();
  });

  test("everyone else sees departments read-only", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/departments");
    await expect(page.getByRole("heading", { name: /Engineering/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "New department" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  });
});

test.describe("org chart", () => {
  test("opens a preview from a node and links to the profile", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/org");
    const ceo = page.getByRole("treeitem", { name: /^Kavya Menon/ });
    await retryUntil(
      () => ceo.click(),
      () =>
        expect(page.getByRole("dialog", { name: "Kavya Menon" })).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("link", { name: "Open full profile" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kavya Menon" })).toBeVisible();
  });

  test("walks the tree with the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard navigation is a desktop affordance");
    await signInAs(page, "EMPLOYEE");
    await page.goto("/org");
    const ceo = page.getByRole("treeitem", { name: /^Kavya Menon/ });
    await ceo.focus();
    await retryUntil(
      () => page.keyboard.press("ArrowDown"),
      () =>
        expect(page.getByRole("treeitem", { name: /^Aditya Banerjee/ })).toBeFocused({
          timeout: 500,
        }),
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("treeitem", { level: 2 }).nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(ceo).toBeFocused();
  });

  test("a profile's org chart link focuses that person", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await openProfile(page, "Arjun Mehta");
    await page.getByRole("link", { name: "Org chart" }).last().click();
    await expect(page).toHaveURL(/\/org\?focus=/);
    const preview = page.getByRole("dialog", { name: "Arjun Mehta" });
    await expect(preview).toBeVisible();
    // The preview is modal; close it to reach the chart behind.
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await expect(page.getByRole("treeitem", { name: /^Arjun Mehta/ })).toBeVisible();
  });
});

test.describe("command palette", () => {
  test("finds people by name", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcut");
    await signInAs(page, "EMPLOYEE");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await retryUntil(
      () => page.keyboard.press("ControlOrMeta+k"),
      () => expect(palette).toBeVisible({ timeout: 500 }),
    );
    await page.keyboard.type("fatima");
    await expect(palette.getByRole("option", { name: /Fatima Shaikh/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Fatima Shaikh" })).toBeVisible();
  });
});

test.describe("accessibility (people)", () => {
  for (const path of ["/people", "/people?view=table", "/departments", "/org"]) {
    test(`${path} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, "HR_MANAGER");
      await page.goto(path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("a full profile has no serious axe violations", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await openProfile(page, "Priya Raman");
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole("tab", { name: "Personal" }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
