import { format } from "date-fns";

import { addDays, dbDate, type ISODate } from "@/lib/tz";

export type LeaveTypeRules = {
  code: string;
  name: string;
  isPaid: boolean;
  allowHalfDay: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
};

/** Sick leave can be recorded after the fact, up to this many days back. */
export const SICK_BACKDATE_DAYS = 7;

export type LeaveProblem = {
  field: "range" | "leaveTypeId" | "startHalf" | "endHalf";
  message: string;
};

const pretty = (iso: ISODate) => format(dbDate(iso), "EEE d MMM");

/**
 * Business rules for a leave request, checked on the server and previewed in
 * the apply form. Returns every problem so the form can show them together.
 */
export function validateLeave(input: {
  type: LeaveTypeRules;
  start: ISODate;
  end: ISODate;
  halfDay: boolean;
  days: number;
  today: ISODate;
  available: number;
  overlaps: { start: ISODate; end: ISODate } | null;
}): LeaveProblem[] {
  const { type, start, end, today } = input;
  const problems: LeaveProblem[] = [];

  if (end < start) return [{ field: "range", message: "The end date is before the start date." }];
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    problems.push({
      field: "range",
      message: "Leave can't cross into a new year. Split it into two requests, one for each year.",
    });
  }
  if (input.days === 0) {
    problems.push({
      field: "range",
      message: "Those dates are all weekends or holidays, so there's nothing to request.",
    });
  }
  if (input.halfDay && !type.allowHalfDay) {
    problems.push({ field: "startHalf", message: `${type.name} is taken in whole days.` });
  }

  const backdatable = type.code === "SL";
  if (start < today) {
    if (!backdatable) {
      problems.push({
        field: "range",
        message: "That date has passed. Only sick leave can be recorded afterwards.",
      });
    } else if (start < addDays(today, -SICK_BACKDATE_DAYS)) {
      problems.push({
        field: "range",
        message: `Sick leave can be recorded up to ${SICK_BACKDATE_DAYS} days afterwards. For older dates, talk to HR.`,
      });
    }
  } else if (type.minNoticeDays > 0 && start < addDays(today, type.minNoticeDays)) {
    problems.push({
      field: "range",
      message: `${type.name} needs ${type.minNoticeDays} days' notice. The earliest you can start is ${pretty(addDays(today, type.minNoticeDays))}.`,
    });
  }

  if (type.maxConsecutiveDays && input.days > type.maxConsecutiveDays) {
    problems.push({
      field: "range",
      message: `${type.name} is limited to ${type.maxConsecutiveDays} working days in a row.`,
    });
  }
  if (type.isPaid && input.days > input.available) {
    problems.push({
      field: "leaveTypeId",
      message:
        input.available <= 0
          ? `You have no ${type.name.toLowerCase()} left this year.`
          : `You have ${input.available} ${input.available === 1 ? "day" : "days"} of ${type.name.toLowerCase()} left, and this needs ${input.days}.`,
    });
  }
  if (input.overlaps) {
    problems.push({
      field: "range",
      message: `You already have leave from ${pretty(input.overlaps.start)} to ${pretty(input.overlaps.end)}.`,
    });
  }
  return problems;
}
