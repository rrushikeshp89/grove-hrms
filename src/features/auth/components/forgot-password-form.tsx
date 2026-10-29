"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink, MailCheck, Send } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { requestPasswordReset } from "../actions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas";

export function ForgotPasswordForm({ demoMode, example }: { demoMode: boolean; example: string }) {
  const [sent, setSent] = React.useState<{ email: string; demoLink: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ForgotPasswordInput) {
    setError(null);
    const result = await requestPasswordReset(values);
    if (!result.ok) return setError(result.error);
    setSent({ email: values.email, demoLink: result.data.demoLink });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span className="grid size-12 place-items-center rounded-card bg-success-subtle text-success">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-display-soft text-title font-medium text-ink">Check your inbox</h2>
          <p className="mt-1 text-body text-ink-muted">
            If <span className="font-medium text-ink">{sent.email}</span> belongs to a Grove
            account, a reset link is on its way. It works for one hour.
          </p>
        </div>
        {demoMode && sent.demoLink && (
          <div className="rounded-card border border-highlight/40 bg-highlight-subtle/60 p-4">
            <p className="text-small font-medium text-highlight-ink">Demo mode</p>
            <p className="mt-0.5 text-small text-ink-muted">
              There&apos;s no real inbox here, so this is the link the email contains.
            </p>
            <Button asChild size="sm" className="mt-3">
              <a href={sent.demoLink}>
                Open the reset link <ExternalLink aria-hidden />
              </a>
            </Button>
          </div>
        )}
        <Button asChild variant="ghost" className="self-start">
          <Link href="/login">
            <ArrowLeft aria-hidden /> Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field
        label="Work email"
        hint={demoMode ? `Demo accounts can't be reset. Try ${example}.` : undefined}
        error={errors.email?.message}
      >
        <Input
          type="email"
          autoComplete="username"
          placeholder="name@northwindgrove.in"
          {...form.register("email")}
        />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-subtle px-3 py-2 text-small text-danger"
        >
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <Link href="/login" className="text-small font-medium text-accent hover:underline">
          Back to sign in
        </Link>
        <Button type="submit" loading={isSubmitting}>
          <Send aria-hidden /> Send reset link
        </Button>
      </div>
    </form>
  );
}
