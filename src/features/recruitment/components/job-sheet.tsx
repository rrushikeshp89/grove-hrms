"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { EMPLOYMENT_TYPES } from "@/features/people/filters";
import { EMPLOYMENT_LABELS } from "@/features/people/format";

import { saveJob } from "../actions";
import { JOB_STATUS_META } from "../logic/pipeline";
import type { RecruitmentOptions } from "../queries";
import { JOB_STATUSES, jobSchema, type JobInput } from "../schemas";
import { useAutoOpen } from "@/lib/use-auto-open";

const BLANK: JobInput = {
  id: null,
  title: "",
  departmentId: "",
  locationId: "",
  employmentType: "FULL_TIME",
  hiringManagerId: "",
  openings: 1,
  status: "OPEN",
  description: "",
};

export function JobSheet({
  open,
  onOpenChange,
  job,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: JobInput;
  options: RecruitmentOptions;
}) {
  const router = useRouter();
  const form = useForm<JobInput, unknown, z.output<typeof jobSchema>>({
    resolver: zodResolver(jobSchema),
    values: job ?? BLANK,
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await saveJob(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof JobInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Role not saved", { description: r.error });
      return;
    }
    toast.success(job ? "Role updated" : "Role created");
    onOpenChange(false);
    if (job) router.refresh();
    else router.push(`/hiring/${r.data.id}`);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title={job ? "Edit role" : "New role"}
          description="This is what the hiring team works from."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="Role title" error={errors.title?.message} className="sm:col-span-2">
              <Input placeholder="Senior Backend Engineer" {...form.register("title")} />
            </Field>
            <Field label="Department" error={errors.departmentId?.message}>
              <Controller
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Location" error={errors.locationId?.message}>
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="Hiring manager"
              error={errors.hiringManagerId?.message}
              className="sm:col-span-2"
            >
              <Controller
                control={form.control}
                name="hiringManagerId"
                render={({ field }) => (
                  <Combobox
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Choose someone"
                    searchPlaceholder="Search people"
                    options={options.managers.map((m) => ({
                      value: m.id,
                      label: m.name,
                      hint: m.title,
                    }))}
                  />
                )}
              />
            </Field>
            <Field label="Contract" error={errors.employmentType?.message}>
              <Controller
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {EMPLOYMENT_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Openings" error={errors.openings?.message}>
              <Input type="number" min={1} max={20} {...form.register("openings")} />
            </Field>
            <Field label="Status" error={errors.status?.message} className="sm:col-span-2">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {JOB_STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="About the role"
              hint="Leave a blank line between paragraphs."
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={8} {...form.register("description")} />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save aria-hidden /> {job ? "Save changes" : "Create role"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** The "New role" button and its sheet, for the jobs page header. */
export function NewJobButton({ options }: { options: RecruitmentOptions }) {
  const [open, setOpen] = React.useState(false);
  useAutoOpen("role", () => setOpen(true));
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New role
      </Button>
      <JobSheet open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}
