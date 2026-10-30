import { z } from "zod";

import { EMPLOYMENT_TYPES, STATUSES } from "./filters";

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const indianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\+?\d{10,13}$/.test(v), "Use 10 digits, optionally with +91")
  .transform((v) => (v === "" ? null : v))
  .nullable();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Pick a real date");

/** What people can change about themselves (and HR for anyone). */
export const personalSchema = z.object({
  employeeId: z.string().min(1),
  preferredName: optionalText(40),
  pronouns: optionalText(20),
  bio: optionalText(400, "Keep your bio under 400 characters"),
  skills: z
    .array(z.string().trim().min(1).max(30, "Keep each skill short"))
    .max(12, "Up to 12 skills")
    .transform((list) => [...new Set(list)]),
});
export type PersonalInput = z.input<typeof personalSchema>;

/** Private details, shown only to the person, their managers and HR. */
export const privateSchema = z.object({
  employeeId: z.string().min(1),
  phone: indianPhone,
  personalEmail: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("That doesn't look like an email address").nullable()),
  dateOfBirth: isoDate.nullable(),
  area: optionalText(60),
  city: optionalText(60),
  state: optionalText(60),
});
export type PrivateInput = z.input<typeof privateSchema>;

/** Job details: HR and admins only. */
export const jobSchema = z.object({
  employeeId: z.string().min(1),
  designationId: z.string().min(1, "Choose a designation"),
  departmentId: z.string().min(1, "Choose a department"),
  locationId: z.string().min(1, "Choose a location"),
  managerId: z.string().min(1).nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(STATUSES),
  joinDate: isoDate,
});
export type JobInput = z.input<typeof jobSchema>;

export const emergencyContactSchema = z.object({
  employeeId: z.string().min(1),
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Enter their name").max(80),
  relationship: z.string().trim().min(2, "How are they related to you?").max(30),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{10,13}$/, "Use 10 digits, optionally with +91")),
  isPrimary: z.boolean(),
});
export type EmergencyContactInput = z.input<typeof emergencyContactSchema>;

export const newEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(40),
  lastName: z.string().trim().min(1, "Enter a last name").max(40),
  workEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email("Enter their work email")
        .endsWith("@northwindgrove.in", "Work emails end in @northwindgrove.in"),
    ),
  designationId: z.string().min(1, "Choose a designation"),
  departmentId: z.string().min(1, "Choose a department"),
  locationId: z.string().min(1, "Choose a location"),
  managerId: z.string().min(1, "Choose who they report to"),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  joinDate: isoDate,
});
export type NewEmployeeInput = z.input<typeof newEmployeeSchema>;
