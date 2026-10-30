import { z } from "zod";

export const DEPARTMENT_COLORS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const departmentSchema = z.object({
  id: z.string().min(1).optional(),
  name: z
    .string()
    .trim()
    .min(2, "Give the department a name")
    .max(40, "Keep it under 40 characters"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z]{2,6}$/, "2 to 6 letters, like ENG or CS")),
  description: optionalText(160),
  colorToken: z.enum(DEPARTMENT_COLORS),
  headId: z.string().min(1).nullable(),
});
export type DepartmentInput = z.input<typeof departmentSchema>;

export const designationSchema = z.object({
  id: z.string().min(1).optional(),
  departmentId: z.string().min(1),
  title: z.string().trim().min(2, "Enter a title").max(60, "Keep it under 60 characters"),
  level: z.coerce.number<number>().int().min(1, "Levels start at 1").max(9, "Levels go up to 9"),
});
export type DesignationInput = z.input<typeof designationSchema>;

export const deleteSchema = z.object({ id: z.string().min(1) });
