import { eachDay, isoWeekday, type ISODate } from "@/lib/tz";

import type { AttendanceStatus } from "./evaluate";

/**
 * What a timesheet shows for each day. Leave and holidays come from their
 * own tables, so the attendance table never has to duplicate them.
 */
export type DayKind = AttendanceStatus | "FUTURE" | "NOT_JOINED" | "IN_PROGRESS" | "PARTIAL_LEAVE";

export type DayRecord = {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  status: AttendanceStatus;
  workedMinutes: number;
  lateByMinutes: number;
  earlyByMinutes: number;
};

export type TimesheetDay = {
  day: ISODate;
  kind: DayKind;
  record: DayRecord | null;
  holiday: string | null;
  leave: { type: string; portion: number } | null;
};

export function buildTimesheet(input: {
  start: ISODate;
  end: ISODate;
  today: ISODate;
  joinDate: ISODate;
  workDays: readonly number[];
  holidays: ReadonlyMap<ISODate, string>;
  leave: ReadonlyMap<ISODate, { type: string; portion: number }>;
  records: ReadonlyMap<ISODate, DayRecord>;
}): TimesheetDay[] {
  return eachDay(input.start, input.end).map((day) => {
    const record = input.records.get(day) ?? null;
    const holiday = input.holidays.get(day) ?? null;
    const leave = input.leave.get(day) ?? null;
    const base = { day, record, holiday, leave };

    if (day < input.joinDate) return { ...base, kind: "NOT_JOINED" };
    // A record always wins: someone who works a holiday shows as present.
    if (record) {
      if (day === input.today && !record.clockOutAt) return { ...base, kind: "IN_PROGRESS" };
      if (leave && leave.portion < 1) return { ...base, kind: "PARTIAL_LEAVE" };
      return { ...base, kind: record.status };
    }
    if (leave) return { ...base, kind: leave.portion < 1 ? "PARTIAL_LEAVE" : "ON_LEAVE" };
    if (holiday) return { ...base, kind: "HOLIDAY" };
    if (!input.workDays.includes(isoWeekday(day))) return { ...base, kind: "WEEKEND" };
    if (day >= input.today) return { ...base, kind: "FUTURE" };
    return { ...base, kind: "ABSENT" };
  });
}

export function summarizeTimesheet(days: readonly TimesheetDay[]) {
  const worked = days.filter((d) => d.record?.clockOutAt);
  const totalMinutes = worked.reduce((sum, d) => sum + (d.record?.workedMinutes ?? 0), 0);
  return {
    present: days.filter((d) =>
      ["PRESENT", "LATE", "HALF_DAY", "IN_PROGRESS", "PARTIAL_LEAVE"].includes(d.kind),
    ).length,
    late: days.filter((d) => (d.record?.lateByMinutes ?? 0) > 0).length,
    absent: days.filter((d) => d.kind === "ABSENT").length,
    leave: days.reduce((sum, d) => sum + (d.leave?.portion ?? 0), 0),
    averageMinutes: worked.length ? Math.round(totalMinutes / worked.length) : 0,
  };
}
