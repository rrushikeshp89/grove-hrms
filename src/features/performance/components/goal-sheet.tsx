"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
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
import { addDays } from "@/lib/tz";

import { saveGoal } from "../actions";
import { goalSchema, type GoalInput } from "../schemas";
import { useAutoOpen } from "@/lib/use-auto-open";

const NONE = "none";

type Parent = { id: string; title: string; company: boolean };

export function GoalSheet({
  open,
  onOpenChange,
  goal,
  parents,
  today,
  canSetCompany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalInput;
  parents: Parent[];
  today: string;
  canSetCompany: boolean;
}) {
  const router = useRouter();
  const form = useForm<GoalInput, unknown, z.output<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    values: goal ?? {
      id: null,
      title: "",
      description: "",
      dueDate: addDays(today, 90),
      company: false,
      parentId: null,
      keyResults: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "keyResults" });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async () => {
    const r = await saveGoal(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof GoalInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Goal not saved", { description: r.error });
      return;
    }
    toast.success(goal ? "Goal updated" : "Goal created");
    onOpenChange(false);
    if (goal) router.refresh();
    else router.push(`/performance/goals/${r.data.id}`);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title={goal ? "Edit goal" : "New goal"}
          description="A goal says what you want to change. Key results say how you'll know."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4">
            <Field label="Goal" error={errors.title?.message}>
              <Input placeholder="Cut p95 page load below one second" {...form.register("title")} />
            </Field>
            <Field label="Why it matters" optional error={errors.description?.message}>
              <Textarea rows={2} {...form.register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due" error={errors.dueDate?.message}>
                <Input type="date" {...form.register("dueDate")} />
              </Field>
              <Field label="Supports" optional error={errors.parentId?.message}>
                <Controller
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nothing in particular</SelectItem>
                        {parents.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.company ? "Company: " : "Team: "}
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            {canSetCompany && !goal && (
              <Controller
                control={form.control}
                name="company"
                render={({ field }) => (
                  <label className="flex items-center gap-2.5 text-body text-ink">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                    A company-wide goal, owned by no one
                  </label>
                )}
              />
            )}

            <fieldset className="grid gap-3">
              <legend className="mb-1 text-body font-medium text-ink">Key results</legend>
              {fields.length === 0 && (
                <p className="text-small text-ink-muted">
                  Optional. Without any, you&apos;ll track progress with check-ins instead.
                </p>
              )}
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  role="group"
                  aria-label={`Key result ${i + 1}`}
                  className="grid gap-3 rounded-control border border-hairline p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1fr_5rem]"
                >
                  <Field
                    label="What's measured"
                    error={errors.keyResults?.[i]?.title?.message}
                    className="sm:col-span-4"
                  >
                    <Input {...form.register(`keyResults.${i}.title`)} />
                  </Field>
                  <Field label="Start" error={errors.keyResults?.[i]?.startValue?.message}>
                    <Input
                      type="number"
                      step="any"
                      {...form.register(`keyResults.${i}.startValue`)}
                    />
                  </Field>
                  <Field label="Now" error={errors.keyResults?.[i]?.currentValue?.message}>
                    <Input
                      type="number"
                      step="any"
                      {...form.register(`keyResults.${i}.currentValue`)}
                    />
                  </Field>
                  <Field label="Target" error={errors.keyResults?.[i]?.targetValue?.message}>
                    <Input
                      type="number"
                      step="any"
                      {...form.register(`keyResults.${i}.targetValue`)}
                    />
                  </Field>
                  <Field label="Unit" optional error={errors.keyResults?.[i]?.unit?.message}>
                    <Input placeholder="%" {...form.register(`keyResults.${i}.unit`)} />
                  </Field>
                  <div className="sm:col-span-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-ink-subtle"
                      onClick={() => remove(i)}
                      aria-label={`Remove key result ${i + 1}`}
                    >
                      <Trash2 aria-hidden /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              {errors.keyResults?.root?.message && (
                <p role="alert" className="text-small font-medium text-danger">
                  {errors.keyResults.root.message}
                </p>
              )}
              {fields.length < 5 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    append({
                      id: null,
                      title: "",
                      startValue: 0,
                      targetValue: 100,
                      currentValue: 0,
                      unit: "",
                    })
                  }
                >
                  <Plus aria-hidden /> Add a key result
                </Button>
              )}
            </fieldset>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save aria-hidden /> {goal ? "Save changes" : "Create goal"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** The "New goal" button and its sheet, for the performance header. */
export function NewGoalButton(
  props: Omit<React.ComponentProps<typeof GoalSheet>, "open" | "onOpenChange" | "goal">,
) {
  const [open, setOpen] = React.useState(false);
  useAutoOpen("goal", () => setOpen(true));
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New goal
      </Button>
      <GoalSheet open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}
