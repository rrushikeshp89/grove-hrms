import { describe, expect, it } from "vitest";

import {
  ancestors,
  buildTree,
  defaultCollapsed,
  descendantCount,
  neighbor,
  revealIn,
  visibleTree,
} from "./tree";

// ceo ─┬─ vp ─┬─ em ── ic1, ic2
//      │      └─ ic3
//      └─ cfo
const rows = [
  { id: "ic2", managerId: "em", name: "Zara" },
  { id: "cfo", managerId: "ceo", name: "Bea" },
  { id: "ceo", managerId: null, name: "Kavya" },
  { id: "vp", managerId: "ceo", name: "Sid" },
  { id: "em", managerId: "vp", name: "Priya" },
  { id: "ic1", managerId: "em", name: "Arjun" },
  { id: "ic3", managerId: "vp", name: "Asha" },
];

describe("buildTree", () => {
  const tree = buildTree(rows);

  it("finds the root and links children", () => {
    expect(tree.roots).toEqual(["ceo"]);
    expect(tree.children.get("em")).toEqual(["ic1", "ic2"]);
  });

  it("puts managers before individual contributors, then sorts by name", () => {
    expect(tree.children.get("ceo")).toEqual(["vp", "cfo"]);
    expect(tree.children.get("vp")).toEqual(["em", "ic3"]);
  });

  it("treats people whose manager is missing as roots", () => {
    const t = buildTree([...rows, { id: "orphan", managerId: "left-company", name: "Omar" }]);
    expect(t.roots).toContain("orphan");
  });

  it("survives a reporting loop instead of hanging", () => {
    const t = buildTree([
      { id: "a", managerId: "b", name: "A" },
      { id: "b", managerId: "a", name: "B" },
    ]);
    expect(t.roots.length).toBeGreaterThan(0);
    expect(() => visibleTree(t, new Set())).not.toThrow();
  });
});

describe("navigation helpers", () => {
  const tree = buildTree(rows);

  it("lists ancestors nearest first and counts descendants", () => {
    expect(ancestors(tree, "ic1")).toEqual(["em", "vp", "ceo"]);
    expect(descendantCount(tree, "vp")).toBe(4);
    expect(descendantCount(tree, "ic1")).toBe(0);
  });

  it("collapses managers below the given depth", () => {
    expect([...defaultCollapsed(tree, 1)].sort()).toEqual(["em", "vp"]);
    expect([...defaultCollapsed(tree, 2)]).toEqual(["em"]);
  });

  it("reveals someone by expanding their ancestors only", () => {
    const collapsed = revealIn(tree, defaultCollapsed(tree, 1), "ic2");
    expect(collapsed.has("vp")).toBe(false);
    expect(collapsed.has("em")).toBe(false);
  });

  it("hides children of collapsed nodes", () => {
    const v = visibleTree(tree, new Set(["vp"]));
    const ceo = v.children[0]!;
    expect(ceo.children.map((c) => c.id)).toEqual(["vp", "cfo"]);
    expect(ceo.children[0]!.children).toEqual([]);
  });

  it("moves like a tree view with the arrow keys", () => {
    const open = new Set<string>();
    expect(neighbor(tree, open, "vp", "up")).toBe("ceo");
    expect(neighbor(tree, open, "vp", "down")).toBe("em");
    expect(neighbor(tree, new Set(["vp"]), "vp", "down")).toBeNull();
    expect(neighbor(tree, open, "vp", "right")).toBe("cfo");
    expect(neighbor(tree, open, "vp", "left")).toBeNull();
    expect(neighbor(tree, open, "ceo", "up")).toBeNull();
  });
});
