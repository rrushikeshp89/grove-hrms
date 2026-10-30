"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { DoorOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";

import { startOffboarding } from "../actions";
import { EXIT_REASONS, startOffboardingSchema, type StartOffboardingInput } from "../schemas";

export function StartOffboarding({
  people,
  defaultLastDay,
}: {
  people: { id: string; name: string; title: string }[];
  defaultLastDay: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<StartOffboardingInput, unknown, z.output<typeof startOffboardingSchema>>({
    resolver: zodResolver(startOffboardingSchema),
    defaultValues: { employeeId: "", lastDay: defaultLastDay, reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await startOffboarding(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof StartOffboardingInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Couldn't start offboarding", { description: r.error });
      return;
    }
    toast.success("Offboarding started", { description: "Tasks are with their owners." });
    setOpen(false);
    form.reset();
    if (r.data.checklistId) router.push(`/lifecycle/${r.data.checklistId}`);
    else router.refresh();
  });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <DoorOpen aria-hidden /> Start offboarding
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            title="Start offboarding"
            description="They move to serving notice, and tasks go out to the people team, IT, their manager and them."
          />
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Who's leaving"
                error={errors.employeeId?.message}
                className="sm:col-span-2"
              >
                <Controller
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <Combobox
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Choose someone"
                      searchPlaceholder="Search people"
                      options={people.map((p) => ({ value: p.id, label: p.name, hint: p.title }))}
                    />
                  )}
                />
              </Field>
              <Field label="Last working day" error={errors.lastDay?.message}>
                <Input type="date" {...form.register("lastDay")} />
              </Field>
              <Field label="Reason" error={errors.reason?.message}>
                <Controller
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXIT_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                <DoorOpen aria-hidden /> Start offboarding
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
