import {
  Blocks,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartLine,
  ClipboardCheck,
  Clock,
  House,
  Bell,
  Inbox,
  ScrollText,
  FolderOpen,
  Megaphone,
  Goal,
  Landmark,
  Palmtree,
  ReceiptText,
  Network,
  Users,
  LayoutTemplate,
  Palette,
  Settings,
  ShieldCheck,
  Table2,
  type LucideIcon,
} from "lucide-react";

import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to roles holding this permission (at any scope). */
  permission?: Permission;
  /** "g x" style sequence; shown in the palette and the shortcut sheet. */
  shortcut?: string;
  keywords?: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Only routes that exist are listed here. Each phase adds its modules, so
 * navigation never points at an unfinished screen.
 */
export const APP_NAVIGATION: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        href: "/home",
        label: "Home",
        icon: House,
        shortcut: "g h",
        keywords: ["dashboard", "today"],
      },
    ],
  },
  {
    label: "Time",
    items: [
      {
        href: "/attendance",
        label: "Attendance",
        icon: Clock,
        permission: "attendance.clock",
        shortcut: "g a",
        keywords: ["clock in", "clock out", "timesheet", "late"],
      },
      {
        href: "/leave",
        label: "Leave",
        icon: Palmtree,
        permission: "leave.apply",
        shortcut: "g l",
        keywords: ["time off", "vacation", "holiday", "balance", "apply"],
      },
      {
        href: "/approvals",
        label: "Approvals",
        icon: Inbox,
        permission: "leave.approve",
        shortcut: "g i",
        keywords: ["inbox", "requests", "approve", "pending"],
      },
      {
        href: "/holidays",
        label: "Holidays",
        icon: CalendarDays,
        keywords: ["calendar", "public holidays", "festivals"],
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        href: "/people",
        label: "People",
        icon: Users,
        shortcut: "g e",
        keywords: ["directory", "employees", "team", "colleagues"],
      },
      {
        href: "/org",
        label: "Org chart",
        icon: Network,
        shortcut: "g o",
        keywords: ["hierarchy", "reporting", "structure", "managers"],
      },
      {
        href: "/departments",
        label: "Departments",
        icon: Building2,
        shortcut: "g d",
        keywords: ["teams", "designations", "titles"],
      },
    ],
  },
  {
    label: "Talent",
    items: [
      {
        href: "/hiring",
        label: "Hiring",
        icon: BriefcaseBusiness,
        permission: "recruitment.read",
        shortcut: "g j",
        keywords: ["jobs", "roles", "candidates", "ats", "pipeline", "recruitment"],
      },
      {
        href: "/lifecycle",
        label: "Onboarding",
        icon: ClipboardCheck,
        permission: "lifecycle.read",
        shortcut: "g b",
        keywords: ["offboarding", "checklist", "new joiner", "leaver", "tasks"],
      },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        href: "/performance",
        label: "Performance",
        icon: Goal,
        permission: "performance.read",
        shortcut: "g g",
        keywords: ["goals", "okr", "key results", "reviews", "feedback", "360", "cycle"],
      },
    ],
  },
  {
    label: "Pay",
    items: [
      {
        href: "/pay",
        label: "Pay",
        icon: ReceiptText,
        permission: "payroll.read",
        shortcut: "g y",
        keywords: ["payslip", "salary", "ctc", "earnings", "deductions"],
      },
      {
        href: "/payroll",
        label: "Payroll",
        icon: Landmark,
        permission: "payroll.run",
        shortcut: "g m",
        keywords: ["run", "salary structure", "payslips", "finalize"],
      },
    ],
  },
  {
    label: "Company",
    items: [
      {
        href: "/announcements",
        label: "Announcements",
        icon: Megaphone,
        shortcut: "g u",
        keywords: ["news", "updates", "posts", "company"],
      },
      {
        href: "/documents",
        label: "Documents",
        icon: FolderOpen,
        permission: "documents.read",
        shortcut: "g k",
        keywords: ["policies", "files", "contracts", "certificates", "handbook"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: ChartLine,
        permission: "analytics.read",
        shortcut: "g n",
        keywords: ["reports", "headcount", "attrition", "hiring", "funnel", "trends"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/audit",
        label: "Audit log",
        icon: ScrollText,
        permission: "audit.read",
        shortcut: "g x",
        keywords: ["history", "changes", "log", "who changed", "security"],
      },
      {
        href: "/settings/roles",
        label: "Roles & access",
        icon: ShieldCheck,
        permission: "roles.read",
        shortcut: "g r",
        keywords: ["permissions", "rbac", "admin"],
      },
    ],
  },
  {
    label: "You",
    items: [
      {
        href: "/notifications",
        label: "Notifications",
        icon: Bell,
        shortcut: "g z",
        keywords: ["alerts", "inbox", "unread", "updates"],
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        shortcut: "g s",
        keywords: ["password", "sessions", "theme", "preferences", "account"],
      },
      {
        href: "/design",
        label: "Design system",
        icon: Palette,
        keywords: ["components", "tokens"],
      },
    ],
  },
];

export const DESIGN_NAVIGATION: NavGroup[] = [
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
export function navigationFor(role: Role | null, groups: NavGroup[]): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.permission || (role !== null && can({ role, employeeId: null }, i.permission)),
      ),
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
