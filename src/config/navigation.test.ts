import { Home, Users, Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { activeHref, navigationFor, type NavGroup } from "./navigation";

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
    items: [
      { href: "/payroll", label: "Payroll", icon: Wallet, roles: ["SUPER_ADMIN", "HR_MANAGER"] },
    ],
  },
];

describe("navigationFor", () => {
  it("shows role-restricted items only to those roles", () => {
    expect(navigationFor("HR_MANAGER", groups).map((g) => g.label)).toEqual(["Workspace", "Admin"]);
  });

  it("drops groups that end up empty", () => {
    expect(navigationFor("EMPLOYEE", groups).map((g) => g.label)).toEqual(["Workspace"]);
  });

  it("hides restricted items when there is no role", () => {
    const items = navigationFor(null, groups).flatMap((g) => g.items.map((i) => i.href));
    expect(items).toEqual(["/home", "/people"]);
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
    const nested: NavGroup[] = [
      {
        label: "x",
        items: [
          { href: "/design", label: "Foundations", icon: Home },
          { href: "/design/components", label: "Components", icon: Home },
        ],
      },
    ];
    expect(activeHref("/design/components", nested)).toBe("/design/components");
    expect(activeHref("/design", nested)).toBe("/design");
  });
});
