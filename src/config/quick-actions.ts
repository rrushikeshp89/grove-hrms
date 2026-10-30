import {
  CalendarPlus,
  FilePlus2,
  Megaphone,
  Target,
  UserPlus,
  UserSearch,
  type LucideIcon,
} from "lucide-react";

import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/roles";

export type QuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** "n x": press n, then the letter. */
  shortcut: string;
  /** The page that starts it. Sheets open from `?new=…` (see `useAutoOpen`). */
  href: string;
  permission: Permission;
  keywords: string[];
};

/**
 * Things you start rather than visit. Each opens its own form on the page that
 * owns it, so the form, its validation and its permissions stay in one place.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new.leave",
    label: "New leave request",
    icon: CalendarPlus,
    shortcut: "n l",
    href: "/leave?new=leave",
    permission: "leave.apply",
    keywords: ["apply", "time off", "vacation", "holiday"],
  },
  {
    id: "new.goal",
    label: "New goal",
    icon: Target,
    shortcut: "n g",
    href: "/performance?new=goal",
    permission: "performance.read",
    keywords: ["objective", "okr", "key result"],
  },
  {
    id: "new.upload",
    label: "Upload a document",
    icon: FilePlus2,
    shortcut: "n u",
    href: "/documents?new=upload",
    permission: "documents.read",
    keywords: ["file", "add document", "policy"],
  },
  {
    id: "new.announcement",
    label: "New announcement",
    icon: Megaphone,
    shortcut: "n a",
    href: "/announcements/new",
    permission: "announcements.publish",
    keywords: ["post", "news", "publish", "write"],
  },
  {
    id: "new.employee",
    label: "Add an employee",
    icon: UserPlus,
    shortcut: "n e",
    href: "/people?new=employee",
    permission: "employee.create",
    keywords: ["new hire", "person", "onboard"],
  },
  {
    id: "new.role",
    label: "Open a new role",
    icon: UserSearch,
    shortcut: "n r",
    href: "/hiring?new=role",
    permission: "recruitment.manage",
    keywords: ["job", "vacancy", "opening", "hiring", "posting"],
  },
];

export function quickActionsFor(role: Role | null): QuickAction[] {
  return QUICK_ACTIONS.filter(
    (a) => role !== null && can({ role, employeeId: null }, a.permission),
  );
}
