import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  { path: "/design", heading: "Foundations" },
  { path: "/design/components", heading: "Components" },
  { path: "/design/data", heading: "Data & charts" },
  { path: "/design/patterns", heading: "Patterns" },
];

/**
 * Keyboard shortcuts attach after hydration. The static HTML is usable
 * before that, so retry the key press until the app responds.
 */
async function pressUntil(page: Page, keys: string[], done: () => Promise<void>) {
  await expect(async () => {
    for (const k of keys) await page.keyboard.press(k);
    await done();
  }).toPass({ timeout: 10_000, intervals: [250, 500, 1000] });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test.describe("design system pages", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("the root redirects to the design system", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/design$/);
  });
});

test.describe("accessibility", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const { path } of PAGES) {
      test(`${path} has no serious axe violations (${theme})`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("grove.theme", t), theme);
        await page.goto(path);
        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
        // let count-ups, rings and chart entrances settle
        await page.waitForTimeout(1200);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const serious = results.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map(
            (v) =>
              `${v.id}: ${v.nodes
                .map((n) => n.target.join(" "))
                .slice(0, 3)
                .join(" | ")}`,
          );
        expect(serious).toEqual([]);
      });
    }
  }
});

test.describe("shell", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard shortcuts are a desktop affordance");

  test("command palette opens with the keyboard and navigates", async ({ page }) => {
    await page.goto("/design");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await pressUntil(page, ["ControlOrMeta+k"], () =>
      expect(palette).toBeVisible({ timeout: 500 }),
    );
    await page.keyboard.type("comp");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/design\/components$/);
    await expect(palette).toBeHidden();
  });

  test("g then p jumps to Patterns, ? opens the shortcut sheet", async ({ page }) => {
    await page.goto("/design");
    await pressUntil(page, ["g", "p"], () =>
      expect(page).toHaveURL(/\/design\/patterns$/, { timeout: 1500 }),
    );
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await pressUntil(page, ["Shift+?"], () => expect(sheet).toBeVisible({ timeout: 500 }));
  });

  test("single-key shortcuts pause while typing", async ({ page }) => {
    await page.goto("/design/data");
    const filter = page.getByRole("textbox", { name: "Filter people" });
    await filter.fill("");
    await filter.pressSequentially("gp");
    await expect(page).toHaveURL(/\/design\/data$/);
    await expect(filter).toHaveValue("gp");
  });

  test("theme and density survive a reload without flashing", async ({ page }) => {
    await page.goto("/design");
    const html = page.locator("html");
    const before = (await html.getAttribute("class")) ?? "";
    const wantDark = !before.includes("dark");
    await pressUntil(page, ["Shift+D"], () =>
      wantDark
        ? expect(html).toHaveClass(/dark/, { timeout: 500 })
        : expect(html).not.toHaveClass(/dark/, { timeout: 500 }),
    );
    await page.keyboard.press("Shift+C");
    await expect(html).toHaveAttribute("data-density", "compact");
    await page.reload();
    // set by the inline head script, before React hydrates
    if (wantDark) await expect(html).toHaveClass(/dark/);
    else await expect(html).not.toHaveClass(/dark/);
    await expect(html).toHaveAttribute("data-density", "compact");
  });

  test("sidebar collapses with [ and remembers it", async ({ page }) => {
    await page.goto("/design");
    await pressUntil(page, ["["], () =>
      expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed", { timeout: 500 }),
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  });
});

test.describe("components", () => {
  test("the leave form validates with the shared schema", async ({ page }) => {
    await page.goto("/design/components");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Choose a leave type")).toBeVisible();
    await expect(page.getByText("Pick the days you'll be away")).toBeVisible();
    await expect(page.getByText("Add a few words so your manager has context")).toBeVisible();
  });

  test("selecting table rows reveals bulk actions", async ({ page }) => {
    await page.goto("/design/data");
    const rows = page.getByRole("checkbox", { name: "Select row" });
    await rows.nth(0).click();
    await rows.nth(1).click();
    const bar = page.getByRole("region", { name: "Bulk actions" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Send reminder" }).click();
    await expect(page.getByText("Reminder sent to 2 people")).toBeVisible();
    await expect(bar).toBeHidden();
  });

  test("filtering to nothing shows a helpful empty state", async ({ page }) => {
    await page.goto("/design/data");
    await page.getByRole("textbox", { name: "Filter people" }).fill("zzz");
    await expect(page.getByText("No one matches “zzz”")).toBeVisible();
    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(page.getByRole("checkbox", { name: "Select row" }).first()).toBeVisible();
  });

  test("approving optimistically removes the row and undo restores it", async ({ page }) => {
    await page.goto("/design/patterns");
    const list = page.locator("li", { hasText: "Arjun Mehta" });
    await list.getByRole("button", { name: "Approve" }).click();
    await expect(list).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("li", { hasText: "Arjun Mehta" })).toHaveCount(1);
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-only layout");

  test("navigation lives in a sheet", async ({ page }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const sheet = page.getByRole("dialog", { name: "Navigation" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Patterns" }).click();
    await expect(page).toHaveURL(/\/design\/patterns$/);
    await expect(sheet).toBeHidden();
  });

  test("pages don't scroll sideways", async ({ page }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
