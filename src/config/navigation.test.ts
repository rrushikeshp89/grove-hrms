import { Home, Users, Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { activeHref, APP_NAVIGATION, navigationFor, type NavGroup } from "./navigation";

const groups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/home", label: "Home", icon: Home },
      { href: "/people", label: "People", icon: Users },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/payroll", label: "Payroll", icon: Wallet, permission: "payroll.run" }],
  },
];

describe("navigationFor", () => {
  it("shows permission-gated items only to roles that hold the permission", () => {
    expect(navigationFor("HR_MANAGER", groups).map((g) => g.label)).toEqual(["Workspace", "Admin"]);
    expect(navigationFor("SUPER_ADMIN", groups).map((g) => g.label)).toEqual([
      "Workspace",
      "Admin",
    ]);
  });

  it("drops groups that end up empty", () => {
    expect(navigationFor("EMPLOYEE", groups).map((g) => g.label)).toEqual(["Workspace"]);
    expect(navigationFor("TEAM_MANAGER", groups).map((g) => g.label)).toEqual(["Workspace"]);
  });

  it("hides gated items when there is no role", () => {
    const items = navigationFor(null, groups).flatMap((g) => g.items.map((i) => i.href));
    expect(items).toEqual(["/home", "/people"]);
  });

  it("gives each role a different app navigation", () => {
    const hrefs = (role: Parameters<typeof navigationFor>[0]) =>
      navigationFor(role, APP_NAVIGATION).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs("EMPLOYEE")).not.toContain("/settings/roles");
    expect(hrefs("HR_MANAGER")).toContain("/settings/roles");
  });
});

describe("activeHref", () => {
  it("matches nested routes to their section", () => {
    expect(activeHref("/people/emp_42", groups)).toBe("/people");
  });

  it("does not match on a shared prefix that isn't a path segment", () => {
    expect(activeHref("/peoplex", groups)).toBeNull();
  });

  it("prefers the longest match", () => {
    expect(activeHref("/settings/roles", APP_NAVIGATION)).toBe("/settings/roles");
    expect(activeHref("/settings", APP_NAVIGATION)).toBe("/settings");
  });
});
