import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/rbac";

import { profileAccess } from "./access";

const arjun = { ownerId: "arjun", ownerManagerChain: ["priya", "vp", "ceo"] };
const other = { ownerId: "rahul-report", ownerManagerChain: ["rahul", "ceo"] };

const self: Actor = { role: "EMPLOYEE", employeeId: "arjun" };
const peer: Actor = { role: "EMPLOYEE", employeeId: "fatima" };
const manager: Actor = { role: "TEAM_MANAGER", employeeId: "priya" };
const hr: Actor = { role: "HR_MANAGER", employeeId: "rahul" };
const admin: Actor = { role: "SUPER_ADMIN", employeeId: "aditya" };

describe("profileAccess", () => {
  it("lets people edit their own personal and private details, not their job", () => {
    expect(profileAccess(self, arjun)).toEqual({
      seePrivate: true,
      editPersonal: true,
      editPrivate: true,
      editJob: false,
      seeFormer: false,
    });
  });

  it("shows a colleague's public profile only", () => {
    expect(profileAccess(peer, arjun)).toMatchObject({
      seePrivate: false,
      editPersonal: false,
      editJob: false,
    });
  });

  it("lets a manager read their report's private details but not edit them", () => {
    expect(profileAccess(manager, arjun)).toMatchObject({
      seePrivate: true,
      editPersonal: false,
      editPrivate: false,
      editJob: false,
    });
    expect(profileAccess(manager, other).seePrivate).toBe(false);
  });

  it("gives HR and admins full edit rights and visibility of former staff", () => {
    for (const actor of [hr, admin]) {
      expect(profileAccess(actor, other)).toEqual({
        seePrivate: true,
        editPersonal: true,
        editPrivate: true,
        editJob: true,
        seeFormer: true,
      });
    }
  });
});
