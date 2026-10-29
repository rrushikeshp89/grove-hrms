"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { signIn } from "../actions";
import { signInSchema, type SignInInput } from "../schemas";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SignInInput) {
    setError(null);
    const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
    const result = await signIn(values, next);
    // Success redirects; only failures return.
    if (result && !result.ok) {
      setError(result.error);
      form.setFocus("password");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label="Work email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          placeholder="name@northwindgrove.in"
          {...form.register("email")}
        />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
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
        <Link
          href="/forgot-password"
          className="text-small font-medium text-accent hover:underline"
        >
          Forgot password?
        </Link>
        <Button type="submit" loading={isSubmitting}>
          <LogIn aria-hidden /> Sign in
        </Button>
      </div>
    </form>
  );
}
