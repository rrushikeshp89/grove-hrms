import { describe, expect, it } from "vitest";

import {
  clockTime,
  eachDay,
  instantAt,
  minutesInDay,
  monthBounds,
  parseMonth,
  todayIn,
} from "@/lib/tz";

import { evaluateDay, formatDuration } from "./evaluate";
import { buildTimesheet, summarizeTimesheet, type DayRecord } from "./timesheet";

const schedule = { startTime: "09:30", endTime: "18:30", graceMinutes: 15 };
const at = (hhmm: string) => instantAt("2026-10-29", hhmm);

describe("tz helpers", () => {
  it("works in India time regardless of the server's zone", () => {
    // 20:00 UTC on the 29th is already the 30th in Bengaluru.
    expect(todayIn("Asia/Kolkata", new Date("2026-10-29T20:00:00Z"))).toBe("2026-10-30");
    expect(instantAt("2026-10-30", "09:30").toISOString()).toBe("2026-10-30T04:00:00.000Z");
    expect(minutesInDay(at("09:45"))).toBe(585);
    expect(clockTime(at("18:05"))).toBe("18:05");
  });

  it("handles months and ranges", () => {
    expect(monthBounds(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(parseMonth("2026-13", "2026-10-30")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2025-12", "2026-10-30")).toEqual({ year: 2025, month: 12 });
    expect(eachDay("2026-10-30", "2026-11-02")).toHaveLength(4);
  });
});

describe("evaluateDay", () => {
  it("is on time within the grace period", () => {
    expect(evaluateDay({ clockInAt: at("09:44"), clockOutAt: at("18:40") }, schedule)).toEqual({
      status: "PRESENT",
      workedMinutes: 536,
      lateByMinutes: 0,
      earlyByMinutes: 0,
    });
  });

  it("counts lateness from the shift start once past grace", () => {
    expect(
      evaluateDay({ clockInAt: at("09:52"), clockOutAt: at("19:00") }, schedule),
    ).toMatchObject({
      status: "LATE",
      lateByMinutes: 22,
    });
  });

  it("flags leaving early and short days", () => {
    expect(
      evaluateDay({ clockInAt: at("09:30"), clockOutAt: at("17:30") }, schedule),
    ).toMatchObject({
      status: "PRESENT",
      earlyByMinutes: 60,
    });
    expect(
      evaluateDay({ clockInAt: at("09:30"), clockOutAt: at("13:00") }, schedule),
    ).toMatchObject({
      status: "HALF_DAY",
      workedMinutes: 210,
    });
  });

  it("reports a day in progress without worked time yet", () => {
    expect(evaluateDay({ clockInAt: at("10:05"), clockOutAt: null }, schedule)).toMatchObject({
      status: "LATE",
      workedMinutes: 0,
    });
    expect(evaluateDay({ clockInAt: null, clockOutAt: null }, schedule).status).toBe("ABSENT");
  });

  it("formats durations", () => {
    expect(formatDuration(485)).toBe("8h 05m");
    expect(formatDuration(42)).toBe("42m");
  });
});

describe("buildTimesheet", () => {
  const rec = (status: DayRecord["status"], closed = true): DayRecord => ({
    clockInAt: at("09:30"),
    clockOutAt: closed ? at("18:30") : null,
    status,
    workedMinutes: closed ? 540 : 0,
    lateByMinutes: status === "LATE" ? 20 : 0,
    earlyByMinutes: 0,
  });

  // Oct 2026: Fri 2 Oct holiday, today Wed 7 Oct.
  const days = buildTimesheet({
    start: "2026-10-01",
    end: "2026-10-09",
    today: "2026-10-07",
    joinDate: "2026-10-01",
    workDays: [1, 2, 3, 4, 5],
    holidays: new Map([["2026-10-02", "Gandhi Jayanti"]]),
    leave: new Map([
      ["2026-10-05", { type: "Casual leave", portion: 1 }],
      ["2026-10-06", { type: "Casual leave", portion: 0.5 }],
    ]),
    records: new Map([
      ["2026-10-01", rec("LATE")],
      ["2026-10-06", rec("HALF_DAY")],
      ["2026-10-07", rec("PRESENT", false)],
    ]),
  });
  const kinds = Object.fromEntries(days.map((d) => [d.day, d.kind]));

  it("merges records, leave, holidays and weekends", () => {
    expect(kinds).toEqual({
      "2026-10-01": "LATE",
      "2026-10-02": "HOLIDAY",
      "2026-10-03": "WEEKEND",
      "2026-10-04": "WEEKEND",
      "2026-10-05": "ON_LEAVE",
      "2026-10-06": "PARTIAL_LEAVE",
      "2026-10-07": "IN_PROGRESS",
      "2026-10-08": "FUTURE",
      "2026-10-09": "FUTURE",
    });
  });

  it("marks missed working days absent and days before joining separately", () => {
    const d = buildTimesheet({
      start: "2026-10-01",
      end: "2026-10-02",
      today: "2026-10-30",
      joinDate: "2026-10-02",
      workDays: [1, 2, 3, 4, 5],
      holidays: new Map(),
      leave: new Map(),
      records: new Map(),
    });
    expect(d.map((x) => x.kind)).toEqual(["NOT_JOINED", "ABSENT"]);
  });

  it("summarizes a month", () => {
    expect(summarizeTimesheet(days)).toEqual({
      present: 3,
      late: 1,
      absent: 0,
      leave: 1.5,
      averageMinutes: 540,
    });
  });
});
