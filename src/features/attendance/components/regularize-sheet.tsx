"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";
import { dbDate } from "@/lib/tz";

import { requestRegularization } from "../actions";
import { regularizeSchema, type RegularizeInput } from "../schemas";

export function RegularizeSheet({
  day,
  defaults,
  onOpenChange,
}: {
  day: string | null;
  defaults: { clockIn: string; clockOut: string };
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<RegularizeInput, unknown, z.output<typeof regularizeSchema>>({
    resolver: zodResolver(regularizeSchema),
    values: { date: day ?? "", clockIn: defaults.clockIn, clockOut: defaults.clockOut, reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await requestRegularization(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof RegularizeInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Correction not sent", { description: r.error });
      return;
    }
    toast.success("Correction sent", {
      description: "Your manager will see it in their approvals.",
    });
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Sheet open={!!day} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title="Correct a day"
          description={
            day
              ? `${format(dbDate(day), "EEEE, d MMMM")}. Your manager approves corrections.`
              : undefined
          }
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="Clocked in at" optional error={errors.clockIn?.message}>
              <Input type="time" {...form.register("clockIn")} />
            </Field>
            <Field label="Clocked out at" optional error={errors.clockOut?.message}>
              <Input type="time" {...form.register("clockOut")} />
            </Field>
            <Field
              label="What happened?"
              error={errors.reason?.message ?? errors.date?.message}
              className="sm:col-span-2"
            >
              <Textarea
                rows={3}
                placeholder="Forgot to clock out after the client call"
                {...form.register("reason")}
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Send aria-hidden /> Send for approval
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
