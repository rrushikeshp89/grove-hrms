"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

import { updateCompany, updateSchedule } from "../actions";
import { WEEKDAYS } from "../logic";
import { companySchema, scheduleSchema, type CompanyInput, type ScheduleInput } from "../schemas";

export function CompanyForm({ initial }: { initial: CompanyInput }) {
  const router = useRouter();
  const form = useForm<CompanyInput, unknown, z.output<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    values: initial,
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await updateCompany(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof CompanyInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Not saved", { description: r.error });
      return;
    }
    toast.success("Company details saved", { description: "Payslips use the registered name." });
    router.refresh();
  });
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Company name" error={errors.name?.message}>
        <Input {...form.register("name")} />
      </Field>
      <Field label="Registered name" hint="Printed on payslips." error={errors.legalName?.message}>
        <Input {...form.register("legalName")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          <Save aria-hidden /> Save details
        </Button>
      </div>
    </form>
  );
}

export function ScheduleForm({
  scheduleId,
  initial,
}: {
  scheduleId: string;
  initial: Omit<ScheduleInput, "scheduleId">;
}) {
  const router = useRouter();
  const form = useForm<ScheduleInput, unknown, z.output<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    values: { scheduleId, ...initial },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await updateSchedule(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof ScheduleInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Not saved", { description: r.error });
      return;
    }
    toast.success("Working hours saved", {
      description: "Attendance uses them from the next clock-in.",
    });
    router.refresh();
  });
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
      <Field label="Day starts" error={errors.startTime?.message}>
        <Input type="time" {...form.register("startTime")} />
      </Field>
      <Field label="Day ends" error={errors.endTime?.message}>
        <Input type="time" {...form.register("endTime")} />
      </Field>
      <Field
        label="Grace period (minutes)"
        hint="Arrive within this and you're on time."
        error={errors.graceMinutes?.message}
      >
        <Input type="number" min={0} max={60} {...form.register("graceMinutes")} />
      </Field>
      <fieldset className="sm:col-span-3">
        <legend className="mb-2 text-body font-medium text-ink">Working days</legend>
        <Controller
          control={form.control}
          name="workDays"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {WEEKDAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-2 text-body text-ink">
                  <Checkbox
                    checked={field.value.includes(d.value)}
                    onCheckedChange={(v) =>
                      field.onChange(
                        v === true
                          ? [...field.value, d.value]
                          : field.value.filter((x) => x !== d.value),
                      )
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}
        />
        {errors.workDays?.message && (
          <p role="alert" className="mt-1.5 text-small font-medium text-danger">
            {errors.workDays.message}
          </p>
        )}
      </fieldset>
      <div className="sm:col-span-3">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          <Save aria-hidden /> Save working hours
        </Button>
      </div>
    </form>
  );
}
