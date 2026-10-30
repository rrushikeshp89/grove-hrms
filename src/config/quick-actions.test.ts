import { describe, expect, it } from "vitest";

import { APP_NAVIGATION } from "./navigation";
import { QUICK_ACTIONS, quickActionsFor } from "./quick-actions";

describe("quick actions", () => {
  it("each have a unique id and shortcut, and a sequence that starts with n", () => {
    expect(new Set(QUICK_ACTIONS.map((a) => a.id)).size).toBe(QUICK_ACTIONS.length);
    expect(new Set(QUICK_ACTIONS.map((a) => a.shortcut)).size).toBe(QUICK_ACTIONS.length);
    for (const a of QUICK_ACTIONS) expect(a.shortcut).toMatch(/^n [a-z]$/);
  });

  it("don't reuse a navigation shortcut", () => {
    const nav = new Set(
      APP_NAVIGATION.flatMap((g) => g.items.map((i) => i.shortcut)).filter(Boolean),
    );
    for (const a of QUICK_ACTIONS) expect(nav.has(a.shortcut)).toBe(false);
  });

  it("sheets open from ?new=… on the page that owns them", () => {
    for (const a of QUICK_ACTIONS) {
      const url = new URL(a.href, "http://x");
      expect(url.pathname.startsWith("/")).toBe(true);
      // Announcements has its own page for writing; the rest open a sheet.
      if (a.id !== "new.announcement") expect(url.searchParams.get("new")).toBeTruthy();
    }
  });

  it("offers each role only what it can do", () => {
    const ids = (r: Parameters<typeof quickActionsFor>[0]) => quickActionsFor(r).map((a) => a.id);
    expect(ids("EMPLOYEE")).toEqual(
      expect.arrayContaining(["new.leave", "new.goal", "new.upload"]),
    );
    expect(ids("EMPLOYEE")).not.toContain("new.employee");
    expect(ids("EMPLOYEE")).not.toContain("new.announcement");
    expect(ids("EMPLOYEE")).not.toContain("new.role");
    expect(ids("HR_MANAGER")).toEqual(
      expect.arrayContaining(["new.employee", "new.announcement", "new.role"]),
    );
    expect(ids(null)).toEqual([]);
  });
});
