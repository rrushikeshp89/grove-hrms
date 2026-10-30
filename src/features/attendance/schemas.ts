import { z } from "zod";

/** How far back attendance can be corrected. */
export const REGULARIZE_WINDOW_DAYS = 30;

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, like 09:30")
  .or(z.literal("").transform(() => null))
  .nullable();

export const regularizeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    clockIn: hhmm,
    clockOut: hhmm,
    reason: z
      .string()
      .trim()
      .min(5, "Say what happened, briefly")
      .max(300, "Keep it under 300 characters"),
  })
  .refine((v) => v.clockIn || v.clockOut, {
    path: ["clockIn"],
    message: "Enter at least one time to correct",
  })
  .refine((v) => !v.clockIn || !v.clockOut || v.clockOut > v.clockIn, {
    path: ["clockOut"],
    message: "Clock-out should be after clock-in",
  });
export type RegularizeInput = z.input<typeof regularizeSchema>;
