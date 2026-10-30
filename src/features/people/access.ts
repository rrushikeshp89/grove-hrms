import { can, scopeFor, type Actor, type Target } from "@/lib/rbac";

/**
 * What a viewer may see and change on someone's profile. Pure so the server
 * actions and the profile UI agree exactly.
 *
 *   personal: preferred name, pronouns, bio, skills (the person and HR)
 *   private:  DOB, personal email, phone, address, emergency contacts
 *   job:      designation, department, manager, location, type, status (HR)
 */
export type ProfileAccess = {
  seePrivate: boolean;
  editPersonal: boolean;
  editPrivate: boolean;
  editJob: boolean;
  /** Former employees are only visible to people who manage records. */
  seeFormer: boolean;
};

export function profileAccess(actor: Actor, target: Target): ProfileAccess {
  const seePrivate = can(actor, "employee.readSensitive", target);
  const editOwnOrAll = can(actor, "employee.update", target);
  // Job details change pay, reporting lines and access, so only people who
  // can edit everyone's records (HR, admins) may touch them.
  const editAll = scopeFor(actor, "employee.update") === "all";
  return {
    seePrivate,
    editPersonal: editOwnOrAll,
    editPrivate: editOwnOrAll && seePrivate,
    editJob: editAll,
    seeFormer: editAll,
  };
}
