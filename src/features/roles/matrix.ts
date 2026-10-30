import type { Permission } from "@/lib/rbac";

/** How the access matrix groups permissions for people reading it. */
export const PERMISSION_AREAS: { area: string; permissions: Permission[] }[] = [
  {
    area: "People",
    permissions: [
      "employee.read",
      "employee.readSensitive",
      "employee.update",
      "employee.create",
      "org.manage",
    ],
  },
  {
    area: "Time",
    permissions: [
      "attendance.clock",
      "attendance.read",
      "leave.apply",
      "leave.read",
      "leave.approve",
      "leave.configure",
    ],
  },
  { area: "Pay", permissions: ["payroll.read", "payroll.run"] },
  {
    area: "Growth",
    permissions: ["performance.read", "performance.review", "performance.manageCycles"],
  },
  {
    area: "Hiring",
    permissions: ["recruitment.read", "recruitment.manage", "lifecycle.read", "lifecycle.manage"],
  },
  {
    area: "Company",
    permissions: ["documents.read", "documents.manage", "announcements.publish", "analytics.read"],
  },
  {
    area: "Administration",
    permissions: ["audit.read", "settings.company", "roles.read", "roles.assign"],
  },
];
