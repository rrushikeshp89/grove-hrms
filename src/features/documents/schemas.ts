import { z } from "zod";

import { uploadProblem } from "./logic/rules";

export const UPLOAD_CATEGORIES = ["ID_PROOF", "CONTRACT", "CERTIFICATE", "OTHER"] as const;

const fields = z.object({
  title: z.string().trim().min(2, "Give it a name").max(80, "Keep the name under 80 characters"),
  category: z.enum(["ID_PROOF", "CONTRACT", "PAYSLIP", "CERTIFICATE", "POLICY", "OTHER"], {
    error: "Choose a category",
  }),
  /** "self", "policy" (the company library), or an employee id. */
  target: z.string().min(1),
  visibility: z.enum(["PRIVATE", "HR_ONLY", "COMPANY"]),
  file: z.instanceof(File, { error: "Choose a file" }).superRefine((f, ctx) => {
    const problem = uploadProblem(f);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
});

/** The upload form posts FormData; this reads it into typed fields. */
export const uploadSchema = z
  .instanceof(FormData)
  .transform((fd) => ({
    title: fd.get("title"),
    category: fd.get("category"),
    target: fd.get("target") ?? "self",
    visibility: fd.get("visibility") ?? "PRIVATE",
    file: fd.get("file"),
  }))
  .pipe(fields);

export const deleteDocumentSchema = z.object({ documentId: z.string().min(1) });
