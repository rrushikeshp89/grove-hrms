/**
 * Org chart data, independent of rendering. Rows come from the database as
 * a flat list with managerId pointers; this builds the tree, decides what
 * is visible given collapsed nodes, and answers navigation questions.
 */

export type OrgRow = { id: string; managerId: string | null; name: string };

export type OrgTree<T extends OrgRow> = {
  byId: Map<string, T>;
  children: Map<string, string[]>;
  parent: Map<string, string | null>;
  roots: string[];
};

export function buildTree<T extends OrgRow>(rows: T[]): OrgTree<T> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const children = new Map<string, string[]>();
  const parent = new Map<string, string | null>();

  for (const r of rows) {
    // A manager outside the visible set (left the company) makes this a root.
    const p = r.managerId && byId.has(r.managerId) ? r.managerId : null;
    parent.set(r.id, p);
  }
  // Break cycles defensively: walk up from each node; if we come back to it,
  // detach it so the chart can still render.
  for (const r of rows) {
    const seen = new Set([r.id]);
    let p = parent.get(r.id) ?? null;
    while (p) {
      if (seen.has(p)) {
        parent.set(r.id, null);
        break;
      }
      seen.add(p);
      p = parent.get(p) ?? null;
    }
  }
  for (const r of rows) {
    const p = parent.get(r.id);
    if (p) children.set(p, [...(children.get(p) ?? []), r.id]);
  }
  // Managers first, then alphabetical, so big teams sit together.
  const size = (id: string) => children.get(id)?.length ?? 0;
  for (const [id, kids] of children) {
    children.set(
      id,
      [...kids].sort(
        (a, b) =>
          Number(size(b) > 0) - Number(size(a) > 0) ||
          byId.get(a)!.name.localeCompare(byId.get(b)!.name),
      ),
    );
  }
  const roots = rows
    .filter((r) => !parent.get(r.id))
    .sort((a, b) => size(b.id) - size(a.id) || a.name.localeCompare(b.name))
    .map((r) => r.id);
  return { byId, children, parent, roots };
}

export function ancestors<T extends OrgRow>(tree: OrgTree<T>, id: string): string[] {
  const out: string[] = [];
  let p = tree.parent.get(id) ?? null;
  while (p) {
    out.push(p);
    p = tree.parent.get(p) ?? null;
  }
  return out;
}

export function depthOf<T extends OrgRow>(tree: OrgTree<T>, id: string) {
  return ancestors(tree, id).length;
}

export function descendantCount<T extends OrgRow>(tree: OrgTree<T>, id: string): number {
  let n = 0;
  const stack = [...(tree.children.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    n += 1;
    stack.push(...(tree.children.get(next) ?? []));
  }
  return n;
}

/** Collapse everything deeper than `depth` that has reports of its own. */
export function defaultCollapsed<T extends OrgRow>(tree: OrgTree<T>, depth = 1): Set<string> {
  const out = new Set<string>();
  for (const id of tree.byId.keys()) {
    if ((tree.children.get(id)?.length ?? 0) > 0 && depthOf(tree, id) >= depth) out.add(id);
  }
  return out;
}

/** Make a person visible: expand everyone above them. */
export function revealIn<T extends OrgRow>(
  tree: OrgTree<T>,
  collapsed: Set<string>,
  id: string,
): Set<string> {
  const next = new Set(collapsed);
  for (const a of ancestors(tree, id)) next.delete(a);
  return next;
}

export type VisibleNode = { id: string; children: VisibleNode[] };

/** The nested structure d3.hierarchy lays out, honoring collapsed nodes. */
export function visibleTree<T extends OrgRow>(
  tree: OrgTree<T>,
  collapsed: Set<string>,
): VisibleNode {
  const build = (id: string): VisibleNode => ({
    id,
    children: collapsed.has(id) ? [] : (tree.children.get(id) ?? []).map(build),
  });
  // Several roots hang off an invisible top so they lay out side by side.
  return { id: "__root", children: tree.roots.map(build) };
}

/** Keyboard navigation in tree order, matching the WAI-ARIA tree pattern. */
export function neighbor<T extends OrgRow>(
  tree: OrgTree<T>,
  collapsed: Set<string>,
  id: string,
  key: "up" | "down" | "left" | "right",
): string | null {
  const parent = tree.parent.get(id) ?? null;
  const siblings = parent ? (tree.children.get(parent) ?? []) : tree.roots;
  const i = siblings.indexOf(id);
  switch (key) {
    case "up":
      return parent;
    case "down":
      return collapsed.has(id) ? null : (tree.children.get(id)?.[0] ?? null);
    case "left":
      return siblings[i - 1] ?? null;
    case "right":
      return siblings[i + 1] ?? null;
  }
}
