import { z } from "zod";

import { ROLES } from "@/lib/roles";

import { isHHMM, shiftProblem } from "./logic";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Pick a real date");

const nullableInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce
      .number({ error: message })
      .int("Whole days only")
      .min(min, message)
      .max(max, message)
      .nullable(),
  );

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company's name").max(60, "Keep it under 60 characters"),
  legalName: z
    .string()
    .trim()
    .min(2, "Enter the registered name")
    .max(120, "Keep it under 120 characters"),
});
export type CompanyInput = z.input<typeof companySchema>;

export const scheduleSchema = z
  .object({
    scheduleId: z.string().min(1),
    startTime: z.string().refine(isHHMM, "Use the 24-hour format, like 09:30"),
    endTime: z.string().refine(isHHMM, "Use the 24-hour format, like 18:30"),
    graceMinutes: z.coerce
      .number({ error: "Enter a number of minutes" })
      .int("Whole minutes only")
      .min(0, "Zero or more")
      .max(60, "At most an hour"),
    workDays: z.array(z.number().int().min(1).max(7)).min(1, "Choose at least one working day"),
  })
  .superRefine((v, ctx) => {
    const problem = shiftProblem(v.startTime, v.endTime);
    if (problem && isHHMM(v.startTime) && isHHMM(v.endTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: problem });
    }
  });
export type ScheduleInput = z.input<typeof scheduleSchema>;

export const leaveTypeSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(2, "Name the leave type").max(40, "Keep it under 40 characters"),
  /** Set once, when the type is created. */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, "Two to four letters, like EL"),
  description: z
    .string()
    .trim()
    .max(200, "Keep it under 200 characters")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  isPaid: z.boolean(),
  allowHalfDay: z.boolean(),
  approvalLevels: z.union([z.literal(1), z.literal(2)]),
  maxConsecutiveDays: nullableInt(1, 365, "Between 1 and 365 days"),
  minNoticeDays: z.coerce
    .number({ error: "Enter a number of days" })
    .int("Whole days only")
    .min(0, "Zero or more")
    .max(60, "At most 60 days"),
  requiresDocumentAfterDays: nullableInt(1, 30, "Between 1 and 30 days"),
  annualQuota: z.coerce
    .number({ error: "Enter the yearly days" })
    .min(0, "Zero or more")
    .max(365, "At most 365")
    .multipleOf(0.5, "Use whole or half days"),
  accrual: z.enum(["MONTHLY", "UPFRONT"]),
  carryForwardMax: z.coerce
    .number({ error: "Enter a number of days" })
    .min(0, "Zero or more")
    .max(365, "At most 365")
    .multipleOf(0.5, "Use whole or half days"),
  proRataOnJoin: z.boolean(),
});
export type LeaveTypeInput = z.input<typeof leaveTypeSchema>;

export const leaveTypeActiveSchema = z.object({ id: z.string().min(1), active: z.boolean() });

export const holidaySchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim().min(2, "Name the holiday").max(60, "Keep it under 60 characters"),
  date: isoDate,
  /** null means every location. */
  locationId: z.string().nullable(),
  isOptional: z.boolean(),
});
export type HolidayInput = z.input<typeof holidaySchema>;

export const deleteHolidaySchema = z.object({ id: z.string().min(1) });

export const roleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});
