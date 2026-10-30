import { format } from "date-fns";

import { addDays, dbDate, isoWeekday, type ISODate } from "@/lib/tz";

export const PRESETS = ["3m", "6m", "12m", "ytd"] as const;
export type Preset = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<Preset, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
  ytd: "This year",
};

export type AnalyticsRange = { start: ISODate; end: ISODate; preset: Preset | "custom" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function monthsBack(today: ISODate, n: number): ISODate {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * The period a report covers, from the URL. Presets end today and start on
 * the first of a month, so buckets line up with calendar months. Everything
 * is clamped to the days we have data for.
 */
export function parseRange(
  sp: { range?: string; from?: string; to?: string },
  today: ISODate,
  dataStart: ISODate,
): AnalyticsRange {
  const clamp = (r: AnalyticsRange): AnalyticsRange => ({
    ...r,
    start: r.start < dataStart ? dataStart : r.start,
    end: r.end > today ? today : r.end,
  });
  if (sp.range === "custom" && sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to)) {
    const [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    const r = clamp({ start: from, end: to, preset: "custom" });
    if (r.start <= r.end) return r;
  }
  const preset = (PRESETS as readonly string[]).includes(sp.range ?? "")
    ? (sp.range as Preset)
    : "12m";
  const start =
    preset === "ytd"
      ? `${today.slice(0, 4)}-01-01`
      : monthsBack(today, { "3m": 2, "6m": 5, "12m": 11 }[preset]);
  return clamp({ start, end: today, preset });
}

export function spanDays(r: { start: ISODate; end: ISODate }): number {
  return Math.round((dbDate(r.end).getTime() - dbDate(r.start).getTime()) / 864e5) + 1;
}

export type Bucket = { key: string; label: string; start: ISODate; end: ISODate };

/**
 * Splits a range into the periods a chart plots: weeks (starting Monday)
 * for ranges up to about three months, calendar months beyond that. The
 * first and last buckets are clipped to the range.
 */
export function bucketsFor(r: { start: ISODate; end: ISODate }): Bucket[] {
  const out: Bucket[] = [];
  if (spanDays(r) <= 92) {
    let cursor = addDays(r.start, 1 - isoWeekday(r.start));
    while (cursor <= r.end) {
      const end = addDays(cursor, 6);
      const start = cursor < r.start ? r.start : cursor;
      out.push({
        key: cursor,
        label: format(dbDate(start), "d MMM"),
        start,
        end: end > r.end ? r.end : end,
      });
      cursor = addDays(cursor, 7);
    }
    return out;
  }
  let cursor = `${r.start.slice(0, 7)}-01`;
  while (cursor <= r.end) {
    const [y, m] = cursor.split("-").map(Number) as [number, number];
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    out.push({
      key: cursor.slice(0, 7),
      label: format(dbDate(cursor), "MMM yy"),
      start: cursor < r.start ? r.start : cursor,
      end: end > r.end ? r.end : end,
    });
    cursor = addDays(end, 1);
  }
  return out;
}

/** The bucket a day falls in, by binary search over sorted buckets. */
export function bucketIndex(buckets: readonly Bucket[], day: ISODate): number {
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = buckets[mid]!;
    if (day < b.start) hi = mid - 1;
    else if (day > b.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function rangeLabel(r: AnalyticsRange): string {
  const s = dbDate(r.start);
  const e = dbDate(r.end);
  const sameYear = r.start.slice(0, 4) === r.end.slice(0, 4);
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}
