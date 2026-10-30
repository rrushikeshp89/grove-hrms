import type { ISODate } from "@/lib/tz";

/**
 * Leave balances. Accrual is computed from policy (no monthly job needed),
 * and everything that happens to a balance is an append-only ledger entry:
 *
 *   available = accrued + carried forward + adjustments − used − on hold
 *
 * The leave year is the calendar year.
 */

export type Policy = {
  annualQuota: number;
  accrual: "UPFRONT" | "MONTHLY";
  carryForwardMax: number;
  proRataOnJoin: boolean;
};

export type LedgerKind =
  "ACCRUAL" | "CARRY_FORWARD" | "USAGE" | "PENDING_HOLD" | "RELEASE" | "ADJUSTMENT";
export type LedgerEntry = { kind: LedgerKind; days: number };

/** Round to the nearest half day, the smallest unit anyone can take. */
export const toHalf = (n: number) => Math.round(n * 2) / 2;

/**
 * How much of the year's quota has been earned by `asOf`.
 *  - UPFRONT grants the year at once (pro-rated by full months left if they
 *    joined during the year).
 *  - MONTHLY earns 1/12 at the start of each month worked.
 */
export function accrued(policy: Policy, joinDate: ISODate, year: number, asOf: ISODate): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (asOf < yearStart || joinDate > yearEnd) return 0;
  const joinedThisYear = joinDate >= yearStart;
  const firstMonth = joinedThisYear
    ? Number(joinDate.slice(5, 7)) + (joinDate.slice(8) === "01" ? 0 : 1)
    : 1;

  if (policy.accrual === "UPFRONT") {
    if (!joinedThisYear || !policy.proRataOnJoin) return policy.annualQuota;
    const months = Math.max(0, 13 - firstMonth);
    return toHalf((policy.annualQuota * months) / 12);
  }
  const lastMonth = asOf > yearEnd ? 12 : Number(asOf.slice(5, 7));
  const months = Math.max(0, lastMonth - firstMonth + 1);
  return toHalf((policy.annualQuota * months) / 12);
}

export type BalanceSummary = {
  accrued: number;
  carriedForward: number;
  adjusted: number;
  used: number;
  pending: number;
  available: number;
};

export function summarize(accruedDays: number, entries: readonly LedgerEntry[]): BalanceSummary {
  let carriedForward = 0;
  let adjusted = 0;
  let used = 0;
  let holds = 0;
  for (const e of entries) {
    if (e.kind === "CARRY_FORWARD") carriedForward += e.days;
    else if (e.kind === "ADJUSTMENT" || e.kind === "ACCRUAL") adjusted += e.days;
    else if (e.kind === "USAGE") used -= e.days;
    else if (e.kind === "PENDING_HOLD" || e.kind === "RELEASE") holds -= e.days;
  }
  const available = accruedDays + carriedForward + adjusted - used - holds;
  return {
    accrued: accruedDays,
    carriedForward,
    adjusted,
    used: toHalf(used),
    pending: toHalf(holds),
    available: toHalf(available),
  };
}

/** What moves into next year: what's left, capped by policy. */
export function carryForward(policy: Policy, yearEndAvailable: number): number {
  return Math.max(0, Math.min(policy.carryForwardMax, toHalf(yearEndAvailable)));
}
