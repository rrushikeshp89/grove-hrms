export const ROLES = ["SUPER_ADMIN", "HR_MANAGER", "TEAM_MANAGER", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  TEAM_MANAGER: "Team Manager",
  EMPLOYEE: "Employee",
};
