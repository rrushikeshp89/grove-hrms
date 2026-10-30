import { z } from "zod";

import { ASSIGNEES } from "./logic/checklist";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const toggleTaskSchema = z.object({
  taskId: z.string().min(1),
  done: z.boolean(),
});

export const EXIT_REASONS = [
  "Joined another company",
  "Higher studies",
  "Relocating",
  "Career change",
  "Family reasons",
  "Contract ended",
  "Retirement",
] as const;

export const startOffboardingSchema = z.object({
  employeeId: z.string().min(1, "Choose who is leaving"),
  lastDay: isoDate,
  reason: z.string().trim().min(2, "Add a reason").max(120, "Keep it under 120 characters"),
});
export type StartOffboardingInput = z.input<typeof startOffboardingSchema>;

export const templateTaskSchema = z.object({
  title: z.string().trim().min(2, "Name the task").max(120, "Keep it under 120 characters"),
  description: z
    .string()
    .trim()
    .max(300, "Keep it under 300 characters")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  assigneeRole: z.enum(ASSIGNEES),
  dueOffsetDays: z.coerce
    .number({ error: "Enter a number of days" })
    .int("Whole days only")
    .min(-60, "At most 60 days before")
    .max(90, "At most 90 days after"),
});

export const templateSchema = z.object({
  templateId: z.string().min(1),
  tasks: z.array(templateTaskSchema).min(1, "Keep at least one task").max(40, "40 tasks at most"),
});
export type TemplateInput = z.input<typeof templateSchema>;
