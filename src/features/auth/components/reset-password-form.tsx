"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LinkIcon, MailWarning } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";

import { resetPassword } from "../actions";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas";
import { PasswordInput } from "./password-input";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const linkError = params.get("error");
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (!token || linkError) {
    return (
      <EmptyState
        className="px-0 text-left"
        icon={MailWarning}
        satellites={[LinkIcon, KeyRound]}
        title="This link has expired"
        description="Reset links work once and only for an hour. Ask for a fresh one and use it straight away."
        action={
          <Button asChild>
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        }
      />
    );
  }

  async function onSubmit(values: ResetPasswordInput) {
    setError(null);
    const result = await resetPassword(values);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <input type="hidden" {...form.register("token")} />
      <Field
        label="New password"
        hint="At least 10 characters. A short sentence works well."
        error={errors.password?.message}
      >
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-control border border-danger/25 bg-danger-subtle px-3 py-2 text-small text-danger"
        >
          {error}{" "}
          <Link href="/forgot-password" className="font-medium underline">
            Request a new link
          </Link>
        </p>
      )}
      <Button type="submit" loading={isSubmitting} className="self-end">
        <KeyRound aria-hidden /> Save new password
      </Button>
    </form>
  );
}
