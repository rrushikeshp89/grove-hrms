"use client";

import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/roles";
import { SectionTabs } from "@/features/time/components/section-tabs";

const TABS: { href: string; label: string; permission?: Permission }[] = [
  { href: "/settings", label: "Account" },
  { href: "/settings/company", label: "Company", permission: "settings.company" },
  { href: "/settings/leave", label: "Leave types", permission: "leave.configure" },
  { href: "/settings/holidays", label: "Holidays", permission: "leave.configure" },
  { href: "/settings/roles", label: "Roles & access", permission: "roles.read" },
];

/** The settings sections this role can open. The server still checks every page. */
export function SettingsTabs({ role }: { role: Role }) {
  const actor = { role, employeeId: null };
  const tabs = TABS.filter((t) => !t.permission || can(actor, t.permission));
  return <SectionTabs label="Settings sections" tabs={tabs} />;
}
