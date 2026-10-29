import { Blocks, LayoutTemplate, Palette, Table2, type LucideIcon } from "lucide-react";

import type { Role } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omit to show the item to every role. */
  roles?: readonly Role[];
  /** "g x" style sequence; shown in the palette and the shortcut sheet. */
  shortcut?: string;
  keywords?: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Only routes that exist are listed here. Each phase adds its modules, so
 * navigation never points at an unfinished screen.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: "Design system",
    items: [
      {
        href: "/design",
        label: "Foundations",
        icon: Palette,
        shortcut: "g f",
        keywords: ["color", "type", "tokens", "spacing", "motion"],
      },
      {
        href: "/design/components",
        label: "Components",
        icon: Blocks,
        shortcut: "g c",
        keywords: ["button", "input", "dialog", "form"],
      },
      {
        href: "/design/data",
        label: "Data & charts",
        icon: Table2,
        shortcut: "g t",
        keywords: ["table", "chart", "analytics"],
      },
      {
        href: "/design/patterns",
        label: "Patterns",
        icon: LayoutTemplate,
        shortcut: "g p",
        keywords: ["empty", "error", "loading", "skeleton", "celebration"],
      },
    ],
  },
];

/** The groups a role may see, with empty groups removed. */
export function navigationFor(role: Role | null, groups: NavGroup[] = NAVIGATION): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.roles || (role !== null && i.roles.includes(role))),
    }))
    .filter((g) => g.items.length > 0);
}

/** Longest matching prefix wins, so /people/123 highlights People. */
export function activeHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    const match = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}
