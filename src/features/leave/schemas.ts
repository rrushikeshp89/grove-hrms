import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Choose a leave type"),
    start: isoDate,
    end: isoDate,
    startHalf: z.enum(["FIRST", "SECOND"]).nullable(),
    endHalf: z.enum(["FIRST", "SECOND"]).nullable(),
    reason: z
      .string()
      .trim()
      .min(3, "Add a few words for your approver")
      .max(500, "Keep it under 500 characters"),
  })
  .refine((v) => v.end >= v.start, {
    path: ["end"],
    message: "The end date is before the start date",
  });
export type ApplyLeaveInput = z.input<typeof applyLeaveSchema>;

export const cancelLeaveSchema = z.object({ requestId: z.string().min(1) });
