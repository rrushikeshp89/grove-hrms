import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DemoLogins } from "@/features/auth/components/demo-logins";
import { LoginForm } from "@/features/auth/components/login-form";
import { DEMO_MODE, DEMO_PASSWORD } from "@/lib/env";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

/** Already signed in? Skip the form. Renders nothing otherwise. */
async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/home");
  return null;
}

async function ResetNotice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reset } = await searchParams;
  if (reset !== "1") return null;
  return (
    <p
      role="status"
      className="mb-6 flex items-center gap-2 rounded-control border border-success/25 bg-success-subtle px-3 py-2 text-small text-success"
    >
      <CircleCheck className="size-4 shrink-0" aria-hidden />
      Your password was reset. Sign in with the new one.
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense fallback={null}>
        <ResetNotice searchParams={searchParams} />
      </Suspense>

      <h1 className="font-display-soft text-display font-medium text-ink">Welcome back</h1>
      <p className="mt-2 mb-8 text-body text-ink-muted">
        Sign in with your Northwind Grove work email.
      </p>

      <LoginForm />

      {DEMO_MODE && (
        <section aria-labelledby="demo-title" className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <h2 id="demo-title" className="eyebrow">
              Or explore the demo as
            </h2>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <DemoLogins />
          <p className="mt-4 text-center text-caption text-ink-subtle">
            Every demo account uses the password{" "}
            <span className="font-mono text-ink-muted">{DEMO_PASSWORD}</span>.
          </p>
        </section>
      )}
    </>
  );
}
