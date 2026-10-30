import type { Role } from "@/lib/roles";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isHHMM = (v: string) => HHMM.test(v);

const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));

/** Why a shift can't be saved, or null. The shift must be a sensible length within one day. */
export function shiftProblem(start: string, end: string): string | null {
  if (!isHHMM(start) || !isHHMM(end)) return "Use the 24-hour format, like 09:30.";
  const length = minutes(end) - minutes(start);
  if (length <= 0) return "The day should end after it starts.";
  if (length < 4 * 60) return "A working day is at least four hours.";
  if (length > 14 * 60) return "A working day is at most fourteen hours.";
  return null;
}

export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

export function weekSummary(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const label = (d: number) => WEEKDAYS.find((w) => w.value === d)?.label ?? "";
  if (sorted.length === 0) return "No working days";
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (consecutive && sorted.length > 2) return `${label(sorted[0]!)} to ${label(sorted.at(-1)!)}`;
  return sorted.map(label).join(", ");
}

/* ─── Role changes ─────────────────────────────────────────────────────── */

/**
 * Why a role change isn't allowed, or null when it is. The rules keep the
 * company from locking itself out: nobody changes their own role, the last
 * super admin can't be demoted, and the demo accounts stay as they are so
 * the demo keeps working.
 */
export function roleChangeProblem(input: {
  actorUserId: string;
  target: { id: string; name: string; role: Role; isDemo: boolean };
  newRole: Role;
  superAdmins: number;
}): string | null {
  const { actorUserId, target, newRole, superAdmins } = input;
  if (target.role === newRole) return `${target.name} already has that role.`;
  if (target.id === actorUserId) return "You can't change your own role. Ask another super admin.";
  if (target.isDemo) return "Demo accounts keep their roles so the demo stays predictable.";
  if (target.role === "SUPER_ADMIN" && superAdmins <= 1) {
    return "There must always be at least one super admin.";
  }
  return null;
}

/** The accrual wording for a leave policy, in a line. */
export function policySummary(p: {
  annualQuota: number;
  accrual: "UPFRONT" | "MONTHLY";
  carryForwardMax: number;
  proRataOnJoin: boolean;
}): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const parts = [
    `${n(p.annualQuota)} days a year`,
    p.accrual === "MONTHLY" ? "earned monthly" : "given up front",
    p.carryForwardMax > 0 ? `carries over up to ${n(p.carryForwardMax)}` : "doesn't carry over",
  ];
  return parts.join(" · ");
}
