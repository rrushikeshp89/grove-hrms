import { eachDay, isoWeekday, type ISODate } from "@/lib/tz";

export type HalfDay = "FIRST" | "SECOND";

export type WorkCalendar = {
  /** ISO weekdays that are working days, 1 = Monday. */
  workDays: readonly number[];
  /** Holidays that apply to this person (optional holidays excluded). */
  holidays: ReadonlySet<ISODate>;
};

export function isWorkingDay(day: ISODate, cal: WorkCalendar): boolean {
  return cal.workDays.includes(isoWeekday(day)) && !cal.holidays.has(day);
}

/**
 * Working days a leave request uses. Weekends and holidays inside the range
 * are free. A request can start in the afternoon (startHalf = SECOND) or end
 * at lunch (endHalf = FIRST); a single-day request with either half set is
 * half a day.
 */
export function leaveDays(
  range: { start: ISODate; end: ISODate; startHalf?: HalfDay | null; endHalf?: HalfDay | null },
  cal: WorkCalendar,
): number {
  if (range.end < range.start) return 0;
  const days = eachDay(range.start, range.end).filter((d) => isWorkingDay(d, cal));
  if (days.length === 0) return 0;
  if (range.start === range.end) return range.startHalf || range.endHalf ? 0.5 : 1;
  let total = days.length;
  if (range.startHalf === "SECOND" && isWorkingDay(range.start, cal)) total -= 0.5;
  if (range.endHalf === "FIRST" && isWorkingDay(range.end, cal)) total -= 0.5;
  return total;
}

/** Each working day in a range with how much of it is taken (1 or 0.5). */
export function leaveDayParts(
  range: { start: ISODate; end: ISODate; startHalf?: HalfDay | null; endHalf?: HalfDay | null },
  cal: WorkCalendar,
): { day: ISODate; portion: number; half: HalfDay | null }[] {
  const single = range.start === range.end;
  return eachDay(range.start, range.end)
    .filter((d) => isWorkingDay(d, cal))
    .map((day) => {
      if (single && (range.startHalf || range.endHalf)) {
        return { day, portion: 0.5, half: range.startHalf ?? range.endHalf ?? null };
      }
      if (day === range.start && range.startHalf === "SECOND")
        return { day, portion: 0.5, half: "SECOND" as const };
      if (day === range.end && range.endHalf === "FIRST")
        return { day, portion: 0.5, half: "FIRST" as const };
      return { day, portion: 1, half: null };
    });
}

export function rangesOverlap(
  a: { start: ISODate; end: ISODate },
  b: { start: ISODate; end: ISODate },
) {
  return a.start <= b.end && b.start <= a.end;
}
