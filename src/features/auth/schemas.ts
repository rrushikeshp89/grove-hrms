import { z } from "zod";

/** Trim and lowercase before validating, so pasted addresses with spaces work. */
const workEmail = (message: string) => z.string().trim().toLowerCase().pipe(z.email(message));

export const signInSchema = z.object({
  email: workEmail("Enter your work email, like name@northwindgrove.in"),
  password: z.string().min(1, "Enter your password"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: workEmail("Enter the work email you sign in with"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const newPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Keep it under 128 characters");

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is incomplete. Request a new one."),
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The two passwords don't match",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The two passwords don't match",
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ["password"],
    message: "Choose a password you haven't used here before",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const DEMO_ROLES = ["SUPER_ADMIN", "HR_MANAGER", "TEAM_MANAGER", "EMPLOYEE"] as const;
export const demoSignInSchema = z.object({ role: z.enum(DEMO_ROLES) });

/** Only same-site paths are honored after sign-in. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return "/home";
  if (next.startsWith("/login") || next.startsWith("/api")) return "/home";
  return next;
}
