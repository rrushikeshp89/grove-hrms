import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs, type DemoRole } from "./helpers";

/**
 * A pass over every screen, as the role that owns it: it renders a heading,
 * logs no errors, doesn't scroll sideways (the mobile project makes this the
 * responsive check), and has no serious axe violations in either theme.
 */
type Screen = { path: string; role: DemoRole };

const SCREENS: Screen[] = [
  ...[
    "/home",
    "/attendance",
    "/leave",
    "/leave/calendar",
    "/holidays",
    "/people",
    "/org",
    "/departments",
    "/performance",
    "/performance?view=reviews",
    "/pay",
    "/announcements",
    "/documents",
    "/documents?view=policies",
    "/notifications",
    "/settings",
  ].map((path) => ({ path, role: "EMPLOYEE" as const })),
  ...["/approvals", "/attendance/team", "/hiring", "/lifecycle"].map((path) => ({
    path,
    role: "TEAM_MANAGER" as const,
  })),
  ...[
    "/people/import",
    "/payroll",
    "/payroll/structures",
    "/analytics",
    "/performance/cycles",
    "/announcements/new",
    "/lifecycle/templates",
    "/settings/leave",
    "/settings/holidays",
    "/settings/roles",
  ].map((path) => ({ path, role: "HR_MANAGER" as const })),
  ...["/audit", "/settings/company"].map((path) => ({ path, role: "SUPER_ADMIN" as const })),
];

/** Detail pages are reached from their list, like a person would. */
const DETAILS: { from: string; role: DemoRole; link: RegExp; label: string }[] = [
  {
    from: "/people",
    role: "EMPLOYEE",
    link: /^\/people\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a profile",
  },
  {
    from: "/pay",
    role: "EMPLOYEE",
    link: /^\/pay\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a payslip",
  },
  { from: "/hiring", role: "HR_MANAGER", link: /^\/hiring\/job_[a-z0-9]+$/, label: "a job board" },
  {
    from: "/payroll",
    role: "HR_MANAGER",
    link: /^\/payroll\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a pay run",
  },
  {
    from: "/lifecycle",
    role: "HR_MANAGER",
    link: /^\/lifecycle\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a checklist",
  },
  {
    from: "/performance",
    role: "EMPLOYEE",
    link: /^\/performance\/goals\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a goal",
  },
  {
    from: "/performance/cycles",
    role: "HR_MANAGER",
    link: /^\/performance\/cycles\/(?!import|export|structures|templates|new)[A-Za-z0-9_-]{3,}$/,
    label: "a cycle",
  },
];

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

async function expectSound(page: Page, errors: string[], theme: "light" | "dark", where: string) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // Let count-ups, rings and chart entrances settle before measuring.
  await page.waitForTimeout(1000);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect.soft(overflow, `${where}: the page scrolls sideways`).toBeLessThanOrEqual(1);

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
  expect.soft(serious, `${where}: axe (${theme})`).toEqual([]);
  expect.soft(errors, `${where}: errors logged by the page`).toEqual([]);
}

test.describe("every screen", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const theme of ["light", "dark"] as const) {
    for (const role of ["EMPLOYEE", "TEAM_MANAGER", "HR_MANAGER", "SUPER_ADMIN"] as const) {
      const screens = SCREENS.filter((s) => s.role === role);
      test(`${role} screens are sound (${theme})`, async ({ page, isMobile }) => {
        test.skip(theme === "dark" && isMobile, "the dark theme is checked on desktop");
        test.setTimeout(60_000 + screens.length * 25_000);
        await page.addInitScript((t) => localStorage.setItem("grove.theme", t), theme);
        const errors = watchErrors(page);
        await signInAs(page, role);
        errors.length = 0;
        for (const { path } of screens) {
          await test.step(path, async () => {
            errors.length = 0;
            await page.goto(path);
            await expectSound(page, errors, theme, `${role} ${path}`);
          });
        }
      });
    }
  }

  test("detail pages are sound", async ({ page, isMobile }) => {
    test.skip(isMobile, "list-to-detail links are the same on desktop");
    test.setTimeout(60_000 + DETAILS.length * 40_000);
    const errors = watchErrors(page);
    for (const d of DETAILS) {
      await test.step(d.label, async () => {
        await signInAs(page, d.role);
        errors.length = 0;
        await page.goto(d.from);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        // Lists stream in after the heading, so wait for the link to appear.
        const findHref = () =>
          page.locator("a[href]").evaluateAll((els, pattern) => {
            const re = new RegExp(pattern);
            return els.map((e) => e.getAttribute("href") ?? "").find((h) => re.test(h)) ?? null;
          }, d.link.source);
        await expect.poll(findHref, { message: `a link to ${d.label} on ${d.from}` }).toBeTruthy();
        const href = await findHref();
        await page.goto(href!);
        await expectSound(page, errors, "light", d.label);
      });
    }
  });
});

test.describe("keyboard", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard navigation is a desktop concern");

  test("the first Tab stop skips to the content, and every stop shows where focus is", async ({
    page,
  }) => {
    await signInAs(page, "EMPLOYEE");
    for (const path of ["/home", "/people", "/leave"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}.*#main$`));

      // Walk a dozen stops: each focused control has a visible indicator.
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const visible = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return true; // wrapped past the end
          const s = getComputedStyle(el);
          const ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
          const shadow = s.boxShadow !== "none";
          return ring || shadow || s.borderColor !== "" || el.matches("input,textarea,select");
        });
        expect(visible).toBe(true);
      }
    }
  });

  test("dialogs trap focus, close on Escape and return focus to what opened them", async ({
    page,
  }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/leave");
    const open = page.getByRole("button", { name: "Apply for leave" }).first();
    await expect(open).toBeVisible();
    let dialog = page.getByRole("dialog", { name: "Apply for leave" });
    await expect(async () => {
      await open.click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10_000 });

    // Focus stays inside while tabbing around.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() =>
        document.activeElement?.closest('[role="dialog"]') ? true : false,
      );
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    dialog = page.getByRole("dialog", { name: "Apply for leave" });
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });
});
