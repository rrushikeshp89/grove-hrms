import { addDays, type ISODate } from "@/lib/tz";

import { bucketIndex, spanDays, type Bucket } from "./range";

/* ─── Headcount and attrition ──────────────────────────────────────────── */

export type Tenure = { joinDate: ISODate; exitDate: ISODate | null };

/** Employed at the end of `day`: joined on or before it and not yet gone. */
export function employedOn(p: Tenure, day: ISODate): boolean {
  return p.joinDate <= day && (p.exitDate === null || p.exitDate > day);
}

export function headcountOn(people: readonly Tenure[], day: ISODate): number {
  let n = 0;
  for (const p of people) if (employedOn(p, day)) n++;
  return n;
}

export type HeadcountPoint = {
  key: string;
  label: string;
  headcount: number;
  joiners: number;
  leavers: number;
};

/** Headcount at the end of each bucket, with who arrived and left during it. */
export function headcountSeries(people: readonly Tenure[], buckets: readonly Bucket[]) {
  const points: HeadcountPoint[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    headcount: headcountOn(people, b.end),
    joiners: 0,
    leavers: 0,
  }));
  for (const p of people) {
    const j = bucketIndex(buckets, p.joinDate);
    if (j >= 0) points[j]!.joiners++;
    if (p.exitDate) {
      const l = bucketIndex(buckets, p.exitDate);
      if (l >= 0) points[l]!.leavers++;
    }
  }
  return points;
}

/**
 * Leavers over the average of opening and closing headcount, the usual HR
 * definition. `annualized` scales it to a 12-month rate so short and long
 * ranges compare.
 */
export function attrition(people: readonly Tenure[], range: { start: ISODate; end: ISODate }) {
  const opening = headcountOn(people, addDays(range.start, -1));
  const closing = headcountOn(people, range.end);
  const leavers = people.filter(
    (p) => p.exitDate && p.exitDate >= range.start && p.exitDate <= range.end,
  ).length;
  const average = (opening + closing) / 2;
  const rate = average ? leavers / average : 0;
  return { opening, closing, leavers, average, rate, annualized: rate * (365 / spanDays(range)) };
}

/** Whole years and months between two days, for "average tenure at exit". */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

/* ─── Hiring funnel ────────────────────────────────────────────────────── */

export const FUNNEL_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export type Stage = FunnelStage | "REJECTED";

/** The furthest funnel stage a candidate reached. Rejection doesn't move them back. */
export function furthestStage(path: readonly Stage[]): FunnelStage {
  let best = 0;
  for (const s of path) {
    const i = FUNNEL_STAGES.indexOf(s as FunnelStage);
    if (i > best) best = i;
  }
  return FUNNEL_STAGES[best]!;
}

/**
 * How many candidates reached each stage. Someone hired also passed through
 * every stage before it, so each count includes the stages after it.
 */
export function funnelCounts(furthest: readonly FunnelStage[]) {
  const counts = FUNNEL_STAGES.map(() => 0);
  for (const f of furthest) {
    const i = FUNNEL_STAGES.indexOf(f);
    for (let k = 0; k <= i; k++) counts[k]!++;
  }
  return FUNNEL_STAGES.map((stage, i) => ({
    stage,
    count: counts[i]!,
    /** Share of the previous stage that made it here. */
    conversion: i === 0 ? null : counts[i - 1] ? counts[i]! / counts[i - 1]! : 0,
  }));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/* ─── Attendance patterns ──────────────────────────────────────────────── */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/**
 * A weekday × arrival-time grid. Arrivals before `from` fold into the first
 * column and anything at or after the last column's start folds into it, so
 * outliers stay visible without stretching the axis.
 */
export function arrivalGrid(
  arrivals: readonly { weekday: number; minute: number; count: number }[],
  opts: { from: number; to: number; step: number },
) {
  const columns: number[] = [];
  for (let m = opts.from; m <= opts.to; m += opts.step) columns.push(m);
  const values = WEEKDAYS.map(() => columns.map(() => 0));
  for (const a of arrivals) {
    if (a.weekday < 1 || a.weekday > 5) continue;
    const col = Math.min(
      columns.length - 1,
      Math.max(0, Math.floor((a.minute - opts.from) / opts.step)),
    );
    values[a.weekday - 1]![col]! += a.count;
  }
  const label = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  return {
    rows: [...WEEKDAYS],
    columns: columns.map((m, i) => (i === columns.length - 1 ? `${label(m)}+` : label(m))),
    values,
  };
}

export function clockLabel(minutes: number): string {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/* ─── Leave ────────────────────────────────────────────────────────────── */

/** Leave days per bucket and type code, from per-day portions. */
export function leaveByBucket(
  parts: readonly { day: ISODate; code: string; portion: number }[],
  buckets: readonly Bucket[],
  codes: readonly string[],
) {
  const rows = buckets.map(
    (b) =>
      ({ key: b.key, label: b.label, ...Object.fromEntries(codes.map((c) => [c, 0])) }) as {
        key: string;
        label: string;
      } & Record<string, number>,
  );
  for (const p of parts) {
    const i = bucketIndex(buckets, p.day);
    if (i < 0 || !codes.includes(p.code)) continue;
    const row = rows[i]! as Record<string, number>;
    row[p.code] = (row[p.code] ?? 0) + p.portion;
  }
  return rows;
}
