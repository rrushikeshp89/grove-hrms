import { z } from "zod";

import { EMPLOYMENT_TYPES } from "@/features/people/filters";

import { SOURCES } from "./logic/pipeline";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Pick a real date");

export const JOB_STATUSES = ["OPEN", "ON_HOLD", "DRAFT", "CLOSED"] as const;

export const jobSchema = z.object({
  id: z.string().nullable(),
  title: z.string().trim().min(3, "Name the role").max(80, "Keep it under 80 characters"),
  departmentId: z.string().min(1, "Choose a department"),
  locationId: z.string().min(1, "Choose a location"),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hiringManagerId: z.string().min(1, "Choose a hiring manager"),
  openings: z.coerce
    .number({ error: "Enter a number" })
    .int("Whole people only")
    .min(1, "At least one opening")
    .max(20, "20 at most"),
  status: z.enum(JOB_STATUSES),
  description: z
    .string()
    .trim()
    .min(40, "Describe the role in a few sentences")
    .max(5000, "Keep it under 5,000 characters"),
});
export type JobInput = z.input<typeof jobSchema>;

export const candidateSchema = z.object({
  jobId: z.string().min(1),
  firstName: z.string().trim().min(1, "Enter a first name").max(40),
  lastName: z.string().trim().min(1, "Enter a last name").max(40),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter an email address")),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\+?\d{10,13}$/.test(v), "Use 10 digits, optionally with +91")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  source: z.enum(SOURCES, { error: "Choose where they came from" }),
});
export type CandidateInput = z.input<typeof candidateSchema>;

export const moveSchema = z.object({
  candidateId: z.string().min(1),
  stage: z.enum(["APPLIED", "SCREENING", "INTERVIEW", "OFFER"]),
  /** Neighbours after the drop, so the new position sits between them. */
  aboveId: z.string().nullable(),
  belowId: z.string().nullable(),
});

export const rejectSchema = z.object({
  candidateId: z.string().min(1),
  reason: z.string().trim().min(3, "Add a short reason").max(300, "Keep it under 300 characters"),
});

export const restoreSchema = z.object({ candidateId: z.string().min(1) });

export const noteSchema = z.object({
  candidateId: z.string().min(1),
  body: z.string().trim().min(2, "Write a note").max(2000, "Keep it under 2,000 characters"),
  rating: z.number().int().min(1).max(5).nullable(),
});
export type NoteInput = z.input<typeof noteSchema>;

export const convertSchema = z.object({
  candidateId: z.string().min(1),
  workEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email("Enter their work email")
        .endsWith("@northwindgrove.in", "Work emails end in @northwindgrove.in"),
    ),
  managerId: z.string().min(1, "Choose who they'll report to"),
  joinDate: isoDate,
});
export type ConvertInput = z.input<typeof convertSchema>;
