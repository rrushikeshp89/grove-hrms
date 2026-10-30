"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { addCandidate } from "../actions";
import { SOURCES } from "../logic/pipeline";
import { candidateSchema, type CandidateInput } from "../schemas";

export function AddCandidateSheet({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<CandidateInput, unknown, z.output<typeof candidateSchema>>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      jobId,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      source: "LinkedIn",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await addCandidate(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof CandidateInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Candidate not added", { description: r.error });
      return;
    }
    toast.success("Candidate added", { description: "They're in Applied." });
    form.reset();
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader title="Add a candidate" description="They start in Applied." />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}>
              <Input autoComplete="off" {...form.register("firstName")} />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <Input autoComplete="off" {...form.register("lastName")} />
            </Field>
            <Field label="Email" error={errors.email?.message} className="sm:col-span-2">
              <Input type="email" autoComplete="off" {...form.register("email")} />
            </Field>
            <Field label="Phone" optional error={errors.phone?.message}>
              <Input type="tel" autoComplete="off" {...form.register("phone")} />
            </Field>
            <Field label="Source" error={errors.source?.message}>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <UserPlus aria-hidden /> Add candidate
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
