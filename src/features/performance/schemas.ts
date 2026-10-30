import { z } from "zod";

import { GOAL_STATUS_META } from "./logic/goals";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Pick a real date");

const number = (message: string) => z.coerce.number({ error: message });

export const keyResultSchema = z
  .object({
    id: z.string().nullable(),
    title: z
      .string()
      .trim()
      .min(3, "Say what will be measured")
      .max(120, "Keep it under 120 characters"),
    startValue: number("Enter a starting value"),
    targetValue: number("Enter a target"),
    currentValue: number("Enter where it stands"),
    unit: z
      .string()
      .trim()
      .max(16, "Keep the unit short")
      .transform((v) => (v === "" ? null : v))
      .nullable(),
  })
  .refine((k) => k.startValue !== k.targetValue, {
    path: ["targetValue"],
    message: "The target should differ from the start",
  });

export const goalSchema = z.object({
  id: z.string().nullable(),
  title: z
    .string()
    .trim()
    .min(5, "Give the goal a clear title")
    .max(120, "Keep it under 120 characters"),
  description: z
    .string()
    .trim()
    .max(600, "Keep it under 600 characters")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  dueDate: isoDate,
  /** A company-wide goal belongs to nobody and is set by the people team. */
  company: z.boolean(),
  parentId: z.string().nullable(),
  keyResults: z.array(keyResultSchema).max(5, "Five key results is plenty"),
});
export type GoalInput = z.input<typeof goalSchema>;

export const checkInSchema = z.object({
  goalId: z.string().min(1),
  values: z.array(z.object({ id: z.string(), currentValue: number("Enter a number") })),
  /** Only used when the goal has no key results. */
  progress: z.coerce.number().int().min(0).max(100).nullable(),
  status: z.enum(
    Object.keys(GOAL_STATUS_META) as [
      keyof typeof GOAL_STATUS_META,
      ...(keyof typeof GOAL_STATUS_META)[],
    ],
  ),
  note: z
    .string()
    .trim()
    .min(5, "Add a line about what changed")
    .max(400, "Keep it under 400 characters"),
});
export type CheckInInput = z.input<typeof checkInSchema>;

export const deleteGoalSchema = z.object({ goalId: z.string().min(1) });

/* ─── Cycles and reviews ───────────────────────────────────────────────── */

export const cycleSchema = z
  .object({
    name: z.string().trim().min(3, "Name the cycle").max(40, "Keep it under 40 characters"),
    periodStart: isoDate,
    periodEnd: isoDate,
    selfReviewDue: isoDate,
    managerReviewDue: isoDate,
  })
  .refine((c) => c.periodEnd > c.periodStart, {
    path: ["periodEnd"],
    message: "The period should end after it starts",
  })
  .refine((c) => c.managerReviewDue >= c.selfReviewDue, {
    path: ["managerReviewDue"],
    message: "Managers review after people write their own",
  });
export type CycleInput = z.input<typeof cycleSchema>;

export const cycleIdSchema = z.object({ cycleId: z.string().min(1) });

export const saveReviewSchema = z.object({
  reviewId: z.string().min(1),
  answers: z.record(z.string(), z.string().max(2000, "Keep each answer under 2,000 characters")),
  rating: z.number().int().min(1).max(5).nullable(),
  submit: z.boolean(),
});
export type SaveReviewInput = z.input<typeof saveReviewSchema>;

export const requestFeedbackSchema = z.object({
  cycleId: z.string().min(1),
  revieweeId: z.string().min(1),
  fromIds: z.array(z.string()).min(1, "Pick at least one person").max(5, "Five people is plenty"),
});

export const declineFeedbackSchema = z.object({ reviewId: z.string().min(1) });
