import { TZDate } from "@date-fns/tz";

/**
 * Calendar days are ISO strings ("2026-10-30") everywhere in time logic, so
 * they never drift with the server's own time zone. Instants (clock-ins) are
 * Dates. These helpers convert between the two for a location's zone.
 */
export const COMPANY_TZ = "Asia/Kolkata";

export type ISODate = string;

/** The calendar day it currently is in a time zone. */
export function todayIn(tz: string = COMPANY_TZ, now: Date = new Date()): ISODate {
  const d = new TZDate(now, tz);
  return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function isoOf(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A DB @db.Date (UTC midnight) or a Date in UTC → its ISO day. */
export function isoFromDbDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** ISO day → the UTC-midnight Date Prisma stores for @db.Date columns. */
export function dbDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** "09:30" on a given day in a zone → the instant. */
export function instantAt(iso: ISODate, hhmm: string, tz: string = COMPANY_TZ): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime());
}

/** Minutes since local midnight for an instant in a zone (09:30 → 570). */
export function minutesInDay(instant: Date, tz: string = COMPANY_TZ): number {
  const d = new TZDate(instant, tz);
  return d.getHours() * 60 + d.getMinutes();
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** "HH:mm" for an instant, in a zone. */
export function clockTime(instant: Date, tz: string = COMPANY_TZ): string {
  const d = new TZDate(instant, tz);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: ISODate): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Every ISO day from start to end, inclusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthBounds(year: number, month: number): { start: ISODate; end: ISODate } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: isoOf(year, month, 1), end: isoOf(year, month, last) };
}

/** "2026-10" → { year, month }, falling back to the given default. */
export function parseMonth(
  value: string | undefined,
  fallback: ISODate,
): { year: number; month: number } {
  const m = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: Number(fallback.slice(0, 4)), month: Number(fallback.slice(5, 7)) };
}
