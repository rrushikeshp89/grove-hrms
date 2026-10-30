import { expect, type Page } from "@playwright/test";

export const ROLES = {
  EMPLOYEE: { card: "Employee", name: "Arjun", email: "arjun.mehta@northwindgrove.in" },
  TEAM_MANAGER: { card: "Team manager", name: "Priya", email: "priya.raman@northwindgrove.in" },
  HR_MANAGER: { card: "HR manager", name: "Rahul", email: "rahul.deshpande@northwindgrove.in" },
  SUPER_ADMIN: { card: "Super admin", name: "Aditya", email: "aditya.banerjee@northwindgrove.in" },
} as const;

export type DemoRole = keyof typeof ROLES;

/**
 * Event handlers attach after hydration. The static HTML is usable before
 * that, so retry the interaction until the app responds.
 */
export async function retryUntil(action: () => Promise<void>, done: () => Promise<void>) {
  await expect(async () => {
    await action();
    await done();
  }).toPass({ timeout: 15_000, intervals: [250, 500, 1000] });
}

export async function signInAs(page: Page, role: DemoRole) {
  // A signed-in visitor is sent from /login to /home, so switching roles starts signed out.
  await page.context().clearCookies();
  await page.goto("/login");
  const card = page.getByRole("button", { name: new RegExp(`^Explore as ${ROLES[role].card}:`) });
  await retryUntil(
    () => card.click(),
    () => expect(page).toHaveURL(/\/home$/, { timeout: 5000 }),
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(ROLES[role].name);
}
