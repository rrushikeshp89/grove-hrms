import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { retryUntil, signInAs } from "./helpers";

/** Shortcuts attach after hydration, so retry the keys until the app answers. */
async function pressUntil(page: Page, keys: string[], done: () => Promise<void>) {
  await expect(async () => {
    for (const k of keys) await page.keyboard.press(k);
    await done();
  }).toPass({ timeout: 10_000, intervals: [250, 500, 1000] });
}

async function seriousViolations(page: Page) {
  await page.waitForTimeout(1200);
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

function lines(text: string) {
  return text.split(/\r?\n/).filter(Boolean);
}

test.describe("notifications", () => {
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("the bell shows what's unread and marks it read", async ({ page }) => {
    await signInAs(page, "TEAM_MANAGER");
    const bell = page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
    await expect(bell).toBeVisible();

    await retryUntil(
      () => bell.click(),
      () =>
        expect(page.getByRole("button", { name: "Mark all read" })).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  });

  test("the page lists everything and lets you mark one unread again", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await expect(page.getByText("Find anything with the command palette")).toBeVisible();

    const toggle = page.getByRole("button", {
      name: 'Mark "Find anything with the command palette" as unread',
    });
    await retryUntil(
      () => toggle.click(),
      () =>
        expect(
          page.getByRole("button", {
            name: 'Mark "Find anything with the command palette" as read',
          }),
        ).toBeVisible({ timeout: 1500 }),
    );
  });
});

test.describe("audit log", () => {
  test("only a super admin can open it", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/audit");
    await expect(
      page.getByRole("heading", { name: "This page isn't part of your role" }),
    ).toBeVisible();
    const res = await page.request.get("/audit/export");
    expect(res.status()).toBe(403);
  });

  test("filters narrow the log and a row opens to show its details", async ({ page }) => {
    await signInAs(page, "SUPER_ADMIN");
    await page.goto("/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();

    const rows = page.locator("ol button[aria-expanded]");
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-expanded", "true");

    const search = page.getByRole("searchbox", { name: "Search the log" });
    await search.fill("zzz-nothing-matches");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=zzz-nothing-matches/);
    await expect(rows).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rows.first()).toBeVisible();
  });

  test("the export is a CSV of the log", async ({ page }) => {
    await signInAs(page, "SUPER_ADMIN");
    const res = await page.request.get("/audit/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(lines(await res.text()).length).toBeGreaterThan(1);
  });
});

test.describe("settings", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("tabs follow what the role may change", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/settings");
    const tabs = page.getByRole("navigation", { name: "Settings sections" });
    await expect(tabs.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Company" })).toHaveCount(0);
    await expect(tabs.getByRole("link", { name: "Holidays" })).toHaveCount(0);

    await signInAs(page, "HR_MANAGER");
    await page.goto("/settings");
    await expect(tabs.getByRole("link", { name: "Holidays" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Leave types" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Company" })).toHaveCount(0);
  });

  test("a super admin renames the company and puts it back", async ({ page }) => {
    await signInAs(page, "SUPER_ADMIN");
    await page.goto("/settings/company");
    const name = page.getByLabel("Company name");
    // The field fills in at hydration.
    await expect(name).not.toHaveValue("");
    const original = await name.inputValue();

    async function rename(to: string) {
      await name.fill(to);
      await retryUntil(
        () => page.getByRole("button", { name: "Save details" }).click(),
        () => expect(page.getByText("Company details saved")).toBeVisible({ timeout: 2500 }),
      );
    }
    await rename(`${original} Test`);
    await page.reload();
    await expect(page.getByLabel("Company name")).toHaveValue(`${original} Test`);
    await rename(original);
    await page.reload();
    await expect(page.getByLabel("Company name")).toHaveValue(original);
  });

  test("HR adds a holiday and removes it", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/settings/holidays");
    await retryUntil(
      () => page.getByRole("button", { name: "Add a holiday" }).click(),
      () => expect(page.getByLabel("Name")).toBeVisible({ timeout: 1000 }),
    );
    await page.getByLabel("Name").fill("Founders Day");
    await page.getByLabel("Date").fill("2026-12-18");
    await page.getByRole("button", { name: "Add holiday", exact: true }).click();
    await expect(page.getByText("Holiday added")).toBeVisible();
    await expect(page.getByText("Founders Day")).toBeVisible();

    await page.getByRole("button", { name: "Remove Founders Day" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("Holiday removed")).toBeVisible();
    await expect(page.getByText("Founders Day")).toHaveCount(0);
  });

  test("roles change for a non-demo person, and the safeguards hold", async ({ page }) => {
    await signInAs(page, "SUPER_ADMIN");
    await page.goto("/settings/roles");
    await expect(page.getByRole("table", { name: "People and their roles" })).toBeVisible();

    // Demo accounts and your own row are locked.
    const demoRow = page.getByRole("combobox", { name: "Role for Aditya Banerjee" });
    await expect(demoRow).toBeDisabled();

    const trigger = page
      .locator('[role="combobox"][aria-label^="Role for "]:not([disabled])')
      .filter({ hasText: "Employee" })
      .first();
    await expect(trigger).toBeVisible();
    const label = (await trigger.getAttribute("aria-label"))!;
    const person = label.replace("Role for ", "");

    await trigger.click();
    await page.getByRole("option", { name: "Team Manager" }).click();
    await expect(page.getByText(`${person} is now Team Manager`)).toBeVisible();

    // The change is in the audit log, with before and after.
    await page.goto("/audit?q=role");
    const first = page.locator("ol button[aria-expanded]").first();
    await first.click();
    await expect(page.getByText("Before", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("After", { exact: true }).first()).toBeVisible();

    // Put it back.
    await page.goto("/settings/roles");
    await page.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: "Employee" }).click();
    await expect(page.getByText(`${person} is now Employee`)).toBeVisible();
  });
});

test.describe("import and export", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.skip(({ isMobile }) => isMobile, "changes shared data; desktop runs the flow once");

  test("HR previews a file, sees the problem row, and imports the rest", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    const template = await page.request.get("/people/import/template");
    expect(template.status()).toBe(200);
    const header = lines(await template.text())[0]!;

    const csv = [
      header,
      "Isha,Kulkarni,isha.kulkarni@northwindgrove.in,Engineering,Software Engineer,Bengaluru office,aditya.banerjee@northwindgrove.in,Full time,2026-12-01",
      "Dev,Menon,dev.menon@northwindgrove.in,Design,Product Designer,Remote (India),aditya.banerjee@northwindgrove.in,Contract,2026-12-07",
      "Nora,Quinn,nora.quinn@northwindgrove.in,Underwater Basket Weaving,Software Engineer,Bengaluru office,,Full time,2026-12-01",
    ].join("\r\n");

    await page.goto("/people/import");
    // The file input answers after hydration, so offer the file until the preview appears.
    await retryUntil(
      () =>
        page.getByLabel("CSV file").setInputFiles({
          name: "new-joiners.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv),
        }),
      () => expect(page.getByText("rows are ready")).toBeVisible({ timeout: 3000 }),
      30_000,
    );
    await expect(page.getByText("1 with problems will be skipped")).toBeVisible();

    const importButton = page.getByRole("button", { name: /^Import 2 people$/ });
    await retryUntil(
      () => importButton.click(),
      () =>
        expect(page.getByRole("heading", { name: "2 people added" })).toBeVisible({
          timeout: 4000,
        }),
    );

    await page.goto("/people?q=Isha");
    await expect(page.getByRole("link", { name: /Isha Kulkarni/ }).first()).toBeVisible();
  });

  test("files that aren't CSV are refused with a reason", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/people/import");
    await retryUntil(
      () =>
        page.getByLabel("CSV file").setInputFiles({
          name: "photo.png",
          mimeType: "image/png",
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        }),
      () => expect(page.getByText("Choose a .csv file.")).toBeVisible({ timeout: 2000 }),
    );
    await expect(page.getByText("rows are ready")).toHaveCount(0);
  });

  test("the directory exports what's filtered, with a spreadsheet-safe file", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    const res = await page.request.get("/people/export?q=fatima");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain("people-");
    const body = await res.text();
    expect(body).toContain("Employee ID");
    expect(body).toContain("Fatima Shaikh");
    expect(body).not.toContain("Isha Kulkarni");
    // Nothing from the private part of a profile.
    expect(body).not.toMatch(/emergency|date of birth|address/i);
  });

  test("leave exports are limited to who you can see", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    const mine = lines(await (await page.request.get("/leave/export")).text());
    await signInAs(page, "HR_MANAGER");
    const everyone = lines(await (await page.request.get("/leave/export")).text());
    expect(mine[0]).toContain("Leave type");
    expect(everyone.length).toBeGreaterThan(mine.length);
  });

  test("payroll and analytics exports are for the people who can see those pages", async ({
    page,
  }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/payroll");
    const href = await page
      .locator('a[href^="/payroll/"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.getAttribute("href"))
          .find((h) => /^\/payroll\/[a-z0-9]{20,}$/.test(h ?? "")),
      );
    expect(href, "a pay run link on the payroll page").toBeTruthy();
    const run = await page.request.get(`${href}/export`);
    expect(run.status()).toBe(200);
    const runCsv = await run.text();
    expect(runCsv).toContain("Net pay (INR)");
    expect(lines(runCsv).length).toBeGreaterThan(10);

    const report = await page.request.get("/analytics/export?range=12m");
    expect(report.status()).toBe(200);
    expect(report.headers()["content-type"]).toBe("application/pdf");
    expect((await report.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await signInAs(page, "EMPLOYEE");
    expect((await page.request.get(`${href}/export`)).status()).toBe(403);
    expect((await page.request.get("/analytics/export")).status()).toBe(403);
  });

  test("export buttons are on the pages they belong to", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/people");
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      "/people/export",
    );
    await expect(page.getByRole("link", { name: "Import" })).toHaveAttribute(
      "href",
      "/people/import",
    );
    await page.goto("/analytics?range=6m");
    await expect(page.getByRole("link", { name: "Export PDF" })).toHaveAttribute(
      "href",
      /\/analytics\/export\?range=6m/,
    );
  });
});

test.describe("search and quick actions", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard shortcuts");

  test("the palette finds policies and marks why they matched", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await pressUntil(page, ["/"], () => expect(palette).toBeVisible({ timeout: 500 }));
    await page.keyboard.type("remote");
    const hit = palette.getByRole("option", { name: /Remote and Hybrid Work Policy/ });
    await expect(hit).toBeVisible();
    await expect(hit.locator("mark").first()).toHaveText(/remote/i);
    await hit.click();
    await expect(page).toHaveURL(/\/documents\?view=policies/);
  });

  test("hiring results only appear for people who can see hiring", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await pressUntil(page, ["ControlOrMeta+k"], () =>
      expect(palette).toBeVisible({ timeout: 500 }),
    );
    await page.keyboard.type("backend");
    await expect(
      palette.getByRole("option", { name: /^Senior Backend Engineer Engineering · Open/ }),
    ).toBeVisible();
    await expect(palette.getByText("Jobs", { exact: true })).toBeVisible();

    await signInAs(page, "EMPLOYEE");
    await pressUntil(page, ["ControlOrMeta+k"], () =>
      expect(palette).toBeVisible({ timeout: 500 }),
    );
    await page.keyboard.type("backend");
    // Colleagues with that title still match, but hiring isn't theirs to see.
    await expect(palette.getByRole("option").first()).toBeVisible();
    await expect(palette.getByText("Jobs", { exact: true })).toHaveCount(0);
    await expect(palette.getByText("Candidates", { exact: true })).toHaveCount(0);
  });

  test("n then l starts a leave request from anywhere", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await pressUntil(page, ["n", "l"], () =>
      expect(page.getByRole("dialog", { name: "Apply for leave" })).toBeVisible({ timeout: 2500 }),
    );
    // The trigger is consumed so a refresh doesn't reopen it.
    await expect(page).toHaveURL(/\/leave$/);
  });

  test("quick actions follow permissions", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await pressUntil(page, ["n", "e"], async () => {
      await page.waitForTimeout(300);
    });
    await expect(page).toHaveURL(/\/home$/);

    await signInAs(page, "HR_MANAGER");
    await pressUntil(page, ["n", "e"], () =>
      expect(page.getByRole("dialog", { name: "Add an employee" })).toBeVisible({ timeout: 2500 }),
    );
  });

  test("the shortcut sheet lists the quick actions", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await pressUntil(page, ["Shift+?"], () =>
      expect(page.getByRole("dialog", { name: /shortcuts/i })).toBeVisible({ timeout: 500 }),
    );
    const sheet = page.getByRole("dialog", { name: /shortcuts/i });
    await expect(sheet.getByText("New leave request")).toBeVisible();
    await expect(sheet.getByText("New announcement")).toBeVisible();
  });
});

test.describe("accessibility (platform)", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const { role, path } of [
      { role: "EMPLOYEE", path: "/notifications" },
      { role: "SUPER_ADMIN", path: "/audit" },
      { role: "SUPER_ADMIN", path: "/settings/company" },
      { role: "SUPER_ADMIN", path: "/settings/roles" },
      { role: "HR_MANAGER", path: "/settings/leave" },
      { role: "HR_MANAGER", path: "/settings/holidays" },
      { role: "HR_MANAGER", path: "/people/import" },
    ] as const) {
      test(`${path} has no serious axe violations (${theme})`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("grove.theme", t), theme);
        await signInAs(page, role);
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }

  test("the palette with search results has no serious axe violations", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard shortcut");
    await signInAs(page, "HR_MANAGER");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await pressUntil(page, ["ControlOrMeta+k"], () =>
      expect(palette).toBeVisible({ timeout: 500 }),
    );
    await page.keyboard.type("engineer");
    await expect(palette.getByRole("option").first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
