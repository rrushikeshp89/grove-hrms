import { hhmmToMinutes, minutesInDay } from "@/lib/tz";

export type Schedule = { startTime: string; endTime: string; graceMinutes: number };

export type AttendanceStatus =
  "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "WEEKEND";

/** Less than this much work counts as a half day. */
export const HALF_DAY_MINUTES = 4.5 * 60;

/**
 * Turns a day's clock-in/out into a status. Still clocked in? Then it's
 * PRESENT or LATE so far; worked time and early leaving are only known at
 * clock-out.
 */
export function evaluateDay(
  input: { clockInAt: Date | null; clockOutAt: Date | null },
  schedule: Schedule,
  tz?: string,
): {
  status: AttendanceStatus;
  workedMinutes: number;
  lateByMinutes: number;
  earlyByMinutes: number;
} {
  if (!input.clockInAt)
    return { status: "ABSENT", workedMinutes: 0, lateByMinutes: 0, earlyByMinutes: 0 };
  const start = hhmmToMinutes(schedule.startTime);
  const end = hhmmToMinutes(schedule.endTime);
  const inAt = minutesInDay(input.clockInAt, tz);
  const late = Math.max(0, inAt - start);
  const lateByMinutes = late > schedule.graceMinutes ? late : 0;

  if (!input.clockOutAt) {
    return {
      status: lateByMinutes ? "LATE" : "PRESENT",
      workedMinutes: 0,
      lateByMinutes,
      earlyByMinutes: 0,
    };
  }
  const workedMinutes = Math.max(
    0,
    Math.round((input.clockOutAt.getTime() - input.clockInAt.getTime()) / 60000),
  );
  const outAt = minutesInDay(input.clockOutAt, tz);
  const earlyByMinutes = outAt < end && workedMinutes < end - start ? end - outAt : 0;
  const status: AttendanceStatus =
    workedMinutes < HALF_DAY_MINUTES ? "HALF_DAY" : lateByMinutes ? "LATE" : "PRESENT";
  return { status, workedMinutes, lateByMinutes, earlyByMinutes };
}

/** "8h 05m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
