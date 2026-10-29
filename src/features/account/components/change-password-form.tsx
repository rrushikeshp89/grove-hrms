"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Lock } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import { changePassword } from "@/features/auth/actions";
import { PasswordInput } from "@/features/auth/components/password-input";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/auth/schemas";

export function ChangePasswordForm({ isDemo }: { isDemo: boolean }) {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (isDemo) {
    return (
      <p className="flex items-start gap-3 rounded-control border border-hairline bg-surface-sunken p-4 text-small text-ink-muted">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
        Demo accounts keep their password so every visitor can sign in. Sign in as any other
        employee to try changing a password.
      </p>
    );
  }

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePassword(values);
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ChangePasswordInput, { message: messages[0] });
      }
      if (!result.fieldErrors) toast.error("Password not changed", { description: result.error });
      return;
    }
    form.reset();
    toast.success("Password changed", { description: "Your other sessions were signed out." });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:max-w-md">
      <Field label="Current password" error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <Field label="New password" hint="At least 10 characters." error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <Button type="submit" loading={isSubmitting} className="justify-self-start">
        <KeyRound aria-hidden /> Change password
      </Button>
    </form>
  );
}
