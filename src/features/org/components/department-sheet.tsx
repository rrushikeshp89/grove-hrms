"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";
import { ManagerCombobox } from "@/features/people/components/person-fields";
import type { JobOptions } from "@/features/people/queries";
import { cn } from "@/lib/utils";

import { deleteDepartment, deleteDesignation, saveDepartment, saveDesignation } from "../actions";
import type { DepartmentRow } from "../queries";
import {
  DEPARTMENT_COLORS,
  departmentSchema,
  designationSchema,
  type DepartmentInput,
  type DesignationInput,
} from "../schemas";

const SWATCH: Record<(typeof DEPARTMENT_COLORS)[number], string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
  "chart-6": "bg-chart-6",
};

export const swatchClass = (token: string) => SWATCH[token as keyof typeof SWATCH] ?? "bg-chart-1";

function DesignationRow({
  departmentId,
  designation,
  onDone,
}: {
  departmentId: string;
  designation?: DepartmentRow["designations"][number];
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<DesignationInput, unknown, z.output<typeof designationSchema>>({
    resolver: zodResolver(designationSchema),
    defaultValues: {
      id: designation?.id,
      departmentId,
      title: designation?.title ?? "",
      level: designation?.level ?? 2,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await saveDesignation(form.getValues());
    if (!r.ok) {
      const msg = r.fieldErrors?.title?.[0] ?? r.fieldErrors?.level?.[0];
      if (msg) form.setError(r.fieldErrors?.title ? "title" : "level", { message: msg });
      else toast.error("Couldn't save the title", { description: r.error });
      return;
    }
    toast.success(designation ? "Title updated" : "Title added");
    onDone();
    router.refresh();
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5 py-2">
      <div className="flex items-start gap-2">
        <Input
          aria-label="Title"
          placeholder="e.g. Staff Engineer"
          autoFocus
          {...form.register("title")}
          aria-invalid={!!errors.title}
          className="flex-1"
        />
        <Input
          aria-label="Level"
          type="number"
          min={1}
          max={9}
          {...form.register("level")}
          aria-invalid={!!errors.level}
          className="w-20"
        />
        <Button type="submit" size="icon" aria-label="Save title" loading={isSubmitting}>
          <Check />
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={onDone}>
          <X />
        </Button>
      </div>
      {(errors.title || errors.level) && (
        <p role="alert" className="text-small text-danger">
          {errors.title?.message ?? errors.level?.message}
        </p>
      )}
    </form>
  );
}

function Designations({ department }: { department: DepartmentRow }) {
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteDesignation({ id });
      if (!r.ok) toast.error("Can't remove that title", { description: r.error });
      else toast.success("Title removed");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="titles-heading" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 id="titles-heading" className="text-heading font-semibold text-ink">
          Job titles
        </h3>
        <span className="text-small text-ink-subtle">Level · people</span>
      </div>
      <ul className="divide-y divide-hairline rounded-control border border-hairline px-3">
        {department.designations.map((d) =>
          editing === d.id ? (
            <li key={d.id}>
              <DesignationRow
                departmentId={department.id}
                designation={d}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={d.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-body text-ink">{d.title}</span>
              <span className="w-16 text-right num text-small text-ink-muted">
                L{d.level} · {d.headcount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${d.title}`}
                onClick={() => setEditing(d.id)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${d.title}`}
                disabled={pending || d.headcount > 0}
                title={d.headcount > 0 ? "People still have this title" : undefined}
                onClick={() => remove(d.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ),
        )}
        {editing === "new" && (
          <li>
            <DesignationRow departmentId={department.id} onDone={() => setEditing(null)} />
          </li>
        )}
        {department.designations.length === 0 && editing !== "new" && (
          <li className="py-4 text-center text-small text-ink-muted">
            No titles yet. Add the first one.
          </li>
        )}
      </ul>
      {editing !== "new" && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setEditing("new")}
        >
          <Plus aria-hidden /> Add a title
        </Button>
      )}
    </section>
  );
}

export function DepartmentSheet({
  department,
  options,
  open,
  onOpenChange,
}: {
  department: DepartmentRow | null;
  options: JobOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, startDelete] = React.useTransition();
  const form = useForm<DepartmentInput, unknown, z.output<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    values: {
      id: department?.id,
      name: department?.name ?? "",
      code: department?.code ?? "",
      description: department?.description ?? "",
      colorToken: (department?.colorToken as DepartmentInput["colorToken"]) ?? "chart-1",
      headId: department?.head?.id ?? null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await saveDepartment(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof DepartmentInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Couldn't save", { description: r.error });
      return;
    }
    toast.success(department ? "Department updated" : "Department created");
    router.refresh();
    if (!department) onOpenChange(false);
  });

  function remove() {
    if (!department) return;
    startDelete(async () => {
      const r = await deleteDepartment({ id: department.id });
      setConfirmDelete(false);
      if (!r.ok)
        return void toast.error(`Can't delete ${department.name}`, { description: r.error });
      toast.success(`${department.name} deleted`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-lg">
        <SheetHeader
          title={department ? department.name : "New department"}
          description={
            department
              ? `${department.headcount} people · ${department.code}`
              : "Titles can be added once it exists."
          }
        />
        <SheetBody className="flex flex-col gap-8">
          <form
            id="department-form"
            onSubmit={submit}
            noValidate
            className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]"
          >
            <Field label="Name" error={errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Code" error={errors.code?.message}>
              <Input className="font-mono uppercase" maxLength={6} {...form.register("code")} />
            </Field>
            <Field
              label="Description"
              optional
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={2} {...form.register("description")} />
            </Field>
            <Field label="Head" optional error={errors.headId?.message} className="sm:col-span-2">
              <Controller
                control={form.control}
                name="headId"
                render={({ field }) => (
                  <ManagerCombobox
                    value={field.value}
                    onChange={field.onChange}
                    options={options}
                  />
                )}
              />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-small font-medium text-ink">Color</legend>
              <Controller
                control={form.control}
                name="colorToken"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Color" className="flex gap-2">
                    {DEPARTMENT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={field.value === c}
                        aria-label={`Color ${c.replace("chart-", "")}`}
                        onClick={() => field.onChange(c)}
                        className={cn(
                          "grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow",
                          SWATCH[c],
                          field.value === c && "ring-2 ring-ink",
                        )}
                      >
                        {field.value === c && <Check className="size-4 text-surface" aria-hidden />}
                      </button>
                    ))}
                  </div>
                )}
              />
            </fieldset>
          </form>
          {department && <Designations department={department} />}
        </SheetBody>
        <SheetFooter className="justify-between sm:justify-between">
          {department ? (
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger-subtle hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit" form="department-form" loading={isSubmitting}>
              {department ? "Save changes" : "Create department"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent size="sm">
          <DialogHeader
            title={`Delete ${department?.name}?`}
            description="Only possible when nobody, current or former, belongs to it. Its titles are removed too."
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Keep it</Button>
            </DialogClose>
            <Button variant="destructive" loading={deleting} onClick={remove}>
              Delete department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
