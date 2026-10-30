import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { retryUntil, ROLES, signInAs, type DemoRole } from "./helpers";

test.describe("sign in", () => {
  test("signed-out visitors are sent to login and back to where they were going", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
    await page.getByLabel("Work email").fill(ROLES.EMPLOYEE.email);
    await page.getByLabel("Password", { exact: true }).fill("grove-demo-2026");
    await retryUntil(
      () => page.getByRole("button", { name: "Sign in" }).click(),
      () => expect(page).toHaveURL(/\/settings$/, { timeout: 5000 }),
    );
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });

  test("wrong passwords get a helpful message, not a crash", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(ROLES.EMPLOYEE.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await retryUntil(
      () => page.getByRole("button", { name: "Sign in" }).click(),
      () =>
        expect(page.getByText("That email and password don't match.")).toBeVisible({
          timeout: 5000,
        }),
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test("the form validates before calling the server", async ({ page }) => {
    await page.goto("/login");
    await retryUntil(
      () => page.getByRole("button", { name: "Sign in" }).click(),
      () => expect(page.getByText("Enter your work email")).toBeVisible({ timeout: 1000 }),
    );
    await expect(page.getByText("Enter your password")).toBeVisible();
  });
});

const EXPECTED_NAV: Record<DemoRole, { sees: string[]; hidden: string[] }> = {
  EMPLOYEE: {
    sees: ["Home", "Performance", "Pay", "Announcements", "Documents", "Settings"],
    hidden: ["Roles & access", "Analytics", "Approvals", "Hiring", "Onboarding"],
  },
  TEAM_MANAGER: {
    sees: ["Home", "Approvals", "Hiring", "Onboarding", "Settings"],
    hidden: ["Roles & access", "Analytics", "Payroll"],
  },
  HR_MANAGER: {
    sees: ["Home", "Analytics", "Payroll", "Performance", "Roles & access", "Settings"],
    hidden: [],
  },
  SUPER_ADMIN: {
    sees: ["Home", "Analytics", "Payroll", "Performance", "Roles & access", "Settings"],
    hidden: [],
  },
};

test.describe("each role", () => {
  for (const role of Object.keys(ROLES) as DemoRole[]) {
    test(`${role} gets a tailored home and navigation`, async ({ page, isMobile }) => {
      await signInAs(page, role);
      const main = page.locator("main");
      if (role === "HR_MANAGER" || role === "SUPER_ADMIN") {
        await expect(main.getByText("Company at a glance")).toBeVisible();
      } else {
        await expect(main.getByText("Company at a glance")).toHaveCount(0);
      }
      if (role === "TEAM_MANAGER") {
        await expect(main.getByText("9 direct reports")).toBeVisible();
        await expect(main.getByRole("heading", { name: "Your team today" })).toBeVisible();
      }
      if (role === "EMPLOYEE") {
        await expect(main.getByText("Teammates", { exact: true })).toBeVisible();
        await expect(main.getByRole("heading", { name: "Your team today" })).toHaveCount(0);
      }
      // Everyone with an employee record gets the self-service blocks.
      for (const title of ["Your leave", "Your month", "Moments"])
        await expect(main.getByRole("heading", { name: title })).toBeVisible();

      // The mobile navigation is a modal, so check the page before opening it.
      if (isMobile) {
        await retryUntil(
          () => page.getByRole("button", { name: "Open navigation" }).click(),
          () =>
            expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible({ timeout: 1000 }),
        );
      }
      const nav = page.getByRole("navigation", { name: "Main" }).last();
      for (const label of EXPECTED_NAV[role].sees)
        await expect(nav.getByRole("link", { name: label })).toBeVisible();
      for (const label of EXPECTED_NAV[role].hidden)
        await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
    });
  }

  test("the server blocks pages a role can't use, even by URL", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/settings/roles");
    await expect(
      page.getByRole("heading", { name: "This page isn't part of your role" }),
    ).toBeVisible();
    await expect(page.getByText("Permissions by role")).toHaveCount(0);
  });

  test("HR sees the access matrix", async ({ page }) => {
    await signInAs(page, "HR_MANAGER");
    await page.goto("/settings/roles");
    await expect(page.getByRole("table", { name: /permissions each role has/ })).toBeVisible();
  });
});

test.describe("account", () => {
  test("demo users can switch roles from the account menu", async ({ page, isMobile }) => {
    test.skip(isMobile, "same flow as desktop");
    await signInAs(page, "TEAM_MANAGER");
    await retryUntil(
      () => page.getByRole("button", { name: /Account menu for Priya/ }).click(),
      () =>
        expect(page.getByRole("menuitem", { name: "HR Manager" })).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("menuitem", { name: "HR Manager" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rahul");
  });

  test("demo accounts can't change their password", async ({ page }) => {
    await signInAs(page, "EMPLOYEE");
    await page.goto("/settings");
    await expect(page.getByText("Demo accounts keep their password")).toBeVisible();
    await expect(page.getByText("This device")).toBeVisible();
  });

  test("signing out ends the session", async ({ page, isMobile }) => {
    test.skip(isMobile, "same flow as desktop");
    await signInAs(page, "EMPLOYEE");
    await retryUntil(
      () => page.getByRole("button", { name: /Account menu for Arjun/ }).click(),
      () => expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible({ timeout: 1000 }),
    );
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
  });
});

test.describe("password reset", () => {
  test.describe.configure({ mode: "serial" });

  test("demo accounts are protected from resets", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Work email").fill(ROLES.TEAM_MANAGER.email);
    await retryUntil(
      () => page.getByRole("button", { name: "Send reset link" }).click(),
      () =>
        expect(page.getByText(/Demo accounts keep their password/)).toBeVisible({ timeout: 5000 }),
    );
  });

  test("a regular employee can reset their password end to end", async ({ page, isMobile }) => {
    test.skip(isMobile, "changes shared data; run once");
    const email = "fatima.shaikh@northwindgrove.in";
    const newPassword = "a-fresh-password-2026";

    await page.goto("/forgot-password");
    await page.getByLabel("Work email").fill(email);
    await retryUntil(
      () => page.getByRole("button", { name: "Send reset link" }).click(),
      () => expect(page.getByText("Check your inbox")).toBeVisible({ timeout: 5000 }),
    );
    await page.getByRole("link", { name: "Open the reset link" }).click();
    await expect(page).toHaveURL(/\/reset-password\?token=/);

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await retryUntil(
      () => page.getByRole("button", { name: "Save new password" }).click(),
      () => expect(page).toHaveURL(/\/login\?reset=1$/, { timeout: 5000 }),
    );
    await expect(page.getByRole("status")).toContainText("Your password was reset");

    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await retryUntil(
      () => page.getByRole("button", { name: "Sign in" }).click(),
      () => expect(page).toHaveURL(/\/home$/, { timeout: 5000 }),
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Fatima");
  });

  test("an invalid link explains what to do", async ({ page }) => {
    await page.goto("/reset-password?error=INVALID_TOKEN");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Send a new link" })).toBeVisible();
  });
});

test.describe("accessibility (signed in)", () => {
  for (const path of ["/home", "/settings", "/settings/roles"]) {
    test(`${path} has no serious axe violations`, async ({ page }) => {
      await signInAs(page, "SUPER_ADMIN");
      await page.goto(path);
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
});
