import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { DEMO_MODE, DEMO_RESET_EXAMPLE } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display-soft text-display font-medium text-ink">Forgot your password?</h1>
      <p className="mt-2 mb-8 text-body text-ink-muted">
        Tell us your work email and we&apos;ll send a link to choose a new one.
      </p>
      <ForgotPasswordForm demoMode={DEMO_MODE} example={DEMO_RESET_EXAMPLE} />
    </>
  );
}
