import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/primitives";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <span className="sr-only">Loading</span>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full rounded-control" />
        </div>
      ))}
      <Skeleton className="h-9 w-40 self-end rounded-control" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-display-soft text-display font-medium text-ink">Choose a new password</h1>
      <p className="mt-2 mb-8 text-body text-ink-muted">
        You&apos;ll be signed out everywhere else once it&apos;s saved.
      </p>
      <Suspense fallback={<FormSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
