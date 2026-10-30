import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const createRunSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const runIdSchema = z.object({ runId: z.string().min(1) });

export const returnRunSchema = z.object({
  runId: z.string().min(1),
  note: z.string().trim().min(3, "Say what needs another look").max(300),
});

export const MIN_CTC_RUPEES = 120_000;
export const MAX_CTC_RUPEES = 20_000_000;

export const structureSchema = z.object({
  employeeId: z.string().min(1, "Choose someone"),
  annualCtcRupees: z.coerce
    .number({ error: "Enter the yearly CTC in rupees" })
    .int("Whole rupees only")
    .min(MIN_CTC_RUPEES, "At least ₹1,20,000 a year")
    .max(MAX_CTC_RUPEES, "At most ₹2 crore a year"),
  effectiveFrom: isoDate,
});
export type StructureInput = z.input<typeof structureSchema>;
