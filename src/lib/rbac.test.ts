import { describe, expect, it } from "vitest";

import { can, covers, GRANTS, PERMISSIONS, scopeFor, type Actor, type Permission } from "./rbac";
import { ROLES } from "./roles";

// A small reporting line: ceo ← vp ← manager ← ic, plus a peer team.
const ic = { ownerId: "ic", ownerManagerChain: ["manager", "vp", "ceo"] };
const otherTeam = { ownerId: "peer", ownerManagerChain: ["other-manager", "vp", "ceo"] };

const employee: Actor = { role: "EMPLOYEE", employeeId: "ic" };
const manager: Actor = { role: "TEAM_MANAGER", employeeId: "manager" };
const vp: Actor = { role: "TEAM_MANAGER", employeeId: "vp" };
const hr: Actor = { role: "HR_MANAGER", employeeId: "hr" };
const admin: Actor = { role: "SUPER_ADMIN", employeeId: "admin" };

describe("can", () => {
  it("lets everyone read the directory", () => {
    for (const role of ROLES)
      expect(can({ role, employeeId: "x" }, "employee.read", ic)).toBe(true);
  });

  it("limits an employee's sensitive reads and edits to themselves", () => {
    expect(can(employee, "employee.readSensitive", ic)).toBe(true);
    expect(can(employee, "employee.readSensitive", otherTeam)).toBe(false);
    expect(can(employee, "employee.update", ic)).toBe(true);
    expect(can(employee, "employee.update", otherTeam)).toBe(false);
  });

  it("does not let an employee approve leave at all", () => {
    expect(can(employee, "leave.approve")).toBe(false);
    expect(can(employee, "leave.approve", ic)).toBe(false);
  });

  it("lets a manager approve for direct and indirect reports only", () => {
    expect(can(manager, "leave.approve", ic)).toBe(true);
    expect(can(vp, "leave.approve", ic)).toBe(true);
    expect(can(manager, "leave.approve", otherTeam)).toBe(false);
  });

  it("does not let a manager edit their reports' profiles", () => {
    expect(can(manager, "employee.update", ic)).toBe(false);
  });

  it("gives HR company-wide reach but not the audit log or role changes", () => {
    expect(can(hr, "leave.approve", otherTeam)).toBe(true);
    expect(can(hr, "employee.update", otherTeam)).toBe(true);
    expect(can(hr, "payroll.run")).toBe(true);
    expect(can(hr, "audit.read")).toBe(false);
    expect(can(hr, "roles.assign")).toBe(false);
    expect(can(hr, "roles.read")).toBe(true);
  });

  it("gives super admins every permission", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[])
      expect(can(admin, p, otherTeam)).toBe(true);
  });

  it("denies scoped checks to accounts without an employee record", () => {
    const service: Actor = { role: "TEAM_MANAGER", employeeId: null };
    expect(can(service, "leave.approve")).toBe(true);
    expect(can(service, "leave.approve", ic)).toBe(false);
  });
});

describe("grants", () => {
  it("only reference known permissions", () => {
    for (const role of ROLES) {
      for (const p of Object.keys(GRANTS[role])) expect(PERMISSIONS).toHaveProperty(p);
    }
  });

  it("never give a role less than the role below it", () => {
    const ladder = ["EMPLOYEE", "TEAM_MANAGER", "SUPER_ADMIN"] as const;
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      for (let i = 1; i < ladder.length; i++) {
        const lower = scopeFor({ role: ladder[i - 1]!, employeeId: "x" }, p);
        const higher = scopeFor({ role: ladder[i]!, employeeId: "x" }, p);
        expect(covers(higher, lower), `${ladder[i]} vs ${ladder[i - 1]} on ${p}`).toBe(true);
      }
      const emp = scopeFor(employee, p);
      expect(covers(scopeFor(hr, p), emp), `HR vs EMPLOYEE on ${p}`).toBe(true);
    }
  });
});
