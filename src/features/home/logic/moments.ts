import { addDays, dbDate, type ISODate } from "@/lib/tz";

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The next time a yearly date comes round, on or after `today`. A 29
 * February date falls on the 28th in other years.
 */
export function nextOccurrence(date: ISODate, today: ISODate): { day: ISODate; year: number } {
  const md = date.slice(5);
  const year = Number(today.slice(0, 4));
  const at = (y: number): ISODate =>
    md === "02-29" && !isLeap(y) ? `${y}-02-28` : (`${y}-${md}` as ISODate);
  const thisYear = at(year);
  return thisYear >= today ? { day: thisYear, year } : { day: at(year + 1), year: year + 1 };
}

const daysBetween = (a: ISODate, b: ISODate) =>
  Math.round((dbDate(b).getTime() - dbDate(a).getTime()) / 864e5);

export type MomentPerson = {
  id: string;
  dateOfBirth: ISODate | null;
  joinDate: ISODate;
};

export type Moment =
  | { kind: "birthday"; personId: string; day: ISODate; daysAway: number }
  | { kind: "anniversary"; personId: string; day: ISODate; daysAway: number; years: number }
  | { kind: "joined"; personId: string; day: ISODate; daysAway: number };

/**
 * Birthdays and work anniversaries in the next `ahead` days, and people who
 * joined in the last `recent` days (negative daysAway). Sorted so today
 * comes first, then soonest, then the newest joiners.
 */
export function upcomingMoments(
  people: readonly MomentPerson[],
  today: ISODate,
  { ahead = 14, recent = 30 }: { ahead?: number; recent?: number } = {},
): Moment[] {
  const out: Moment[] = [];
  const since = addDays(today, -recent);
  for (const p of people) {
    if (p.dateOfBirth) {
      const next = nextOccurrence(p.dateOfBirth, today);
      const away = daysBetween(today, next.day);
      if (away <= ahead)
        out.push({ kind: "birthday", personId: p.id, day: next.day, daysAway: away });
    }
    if (p.joinDate > today) continue;
    if (p.joinDate >= since) {
      out.push({
        kind: "joined",
        personId: p.id,
        day: p.joinDate,
        daysAway: daysBetween(today, p.joinDate),
      });
      continue;
    }
    const next = nextOccurrence(p.joinDate, today);
    const years = next.year - Number(p.joinDate.slice(0, 4));
    const away = daysBetween(today, next.day);
    if (years >= 1 && away <= ahead)
      out.push({ kind: "anniversary", personId: p.id, day: next.day, daysAway: away, years });
  }
  const rank = (m: Moment) => (m.kind === "joined" ? 1 : 0);
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) ? b.day.localeCompare(a.day) : a.daysAway - b.daysAway) ||
      a.kind.localeCompare(b.kind),
  );
}
