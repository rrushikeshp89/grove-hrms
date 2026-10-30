"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
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

import { checkIn, deleteGoal } from "../actions";
import {
  GOAL_STATUS_META,
  formatValue,
  goalProgress,
  suggestStatus,
  type GoalStatus,
} from "../logic/goals";
import type { GoalDetail } from "../queries";
import { checkInSchema, type CheckInInput } from "../schemas";
import { GoalSheet } from "./goal-sheet";

/**
 * Updating a goal: new values for its key results (or a progress figure when
 * it has none), a status that starts from a suggestion, and a note. The
 * suggestion compares progress with how much of the time has passed.
 */
export function CheckInDialog({ goal, today }: { goal: GoalDetail; today: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<CheckInInput, unknown, z.output<typeof checkInSchema>>({
    resolver: zodResolver(checkInSchema),
    values: {
      goalId: goal.id,
      values: goal.keyResults.map((k) => ({ id: k.id, currentValue: k.currentValue })),
      progress: goal.progress,
      status: goal.status,
      note: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control });
  const hasKrs = goal.keyResults.length > 0;
  const progress = hasKrs
    ? (goalProgress(
        goal.keyResults.map((k, i) => ({
          ...k,
          currentValue: Number(watched.values?.[i]?.currentValue ?? k.currentValue),
        })),
      ) ?? 0)
    : Number(watched.progress ?? 0);
  const suggested = suggestStatus({ progress, start: goal.startDate, due: goal.dueDate, today });

  const submit = form.handleSubmit(async () => {
    const r = await checkIn(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof CheckInInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Check-in not saved", { description: r.error });
      return;
    }
    setOpen(false);
    if (r.data.status === "DONE") {
      celebrate();
      toast.success("Goal complete", { description: "That's worth a moment. Well done." });
    } else toast.success("Check-in saved", { description: `Now at ${r.data.progress}%.` });
    router.refresh();
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MessageSquarePlus aria-hidden /> Check in
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader title="Check in" description={goal.title} />
          <form onSubmit={submit} noValidate>
            <DialogBody className="grid gap-4">
              {hasKrs ? (
                <div className="grid gap-3">
                  {goal.keyResults.map((k, i) => (
                    <Field
                      key={k.id}
                      label={k.title}
                      hint={`From ${formatValue(k.startValue, k.unit)} to ${formatValue(k.targetValue, k.unit)}`}
                      error={errors.values?.[i]?.currentValue?.message}
                    >
                      <Input
                        type="number"
                        step="any"
                        {...form.register(`values.${i}.currentValue`)}
                      />
                    </Field>
                  ))}
                </div>
              ) : (
                <Field label="How far along is it? (0–100)" error={errors.progress?.message}>
                  <Input type="number" min={0} max={100} {...form.register("progress")} />
                </Field>
              )}
              <p className="num text-small text-ink-muted">
                This puts the goal at <strong className="text-ink">{progress}%</strong>.
              </p>
              <Field
                label="Status"
                hint={
                  suggested !== watched.status
                    ? `Based on the time that's passed, this looks ${GOAL_STATUS_META[suggested].label.toLowerCase()}.`
                    : undefined
                }
                error={errors.status?.message}
              >
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(GOAL_STATUS_META) as GoalStatus[])
                          .filter((s) => s !== "DONE")
                          .map((s) => (
                            <SelectItem key={s} value={s}>
                              {GOAL_STATUS_META[s].label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="What changed?" error={errors.note?.message}>
                <Textarea
                  rows={3}
                  placeholder="Shipped the caching layer; p95 is down to 1.4s."
                  {...form.register("note")}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Save check-in
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Edit and delete, for a goal's owner. */
export function GoalOwnerActions({
  goal,
  parents,
  today,
  canSetCompany,
}: {
  goal: GoalDetail;
  parents: { id: string; title: string; company: boolean }[];
  today: string;
  canSetCompany: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <Pencil aria-hidden /> Edit
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(true)} aria-label="Delete goal">
        <Trash2 aria-hidden />
      </Button>
      <GoalSheet
        open={editing}
        onOpenChange={setEditing}
        parents={parents.filter((p) => p.id !== goal.id)}
        today={today}
        canSetCompany={canSetCompany}
        goal={{
          id: goal.id,
          title: goal.title,
          description: goal.description ?? "",
          dueDate: goal.dueDate ?? today,
          company: goal.isCompany,
          parentId: goal.parent?.id ?? null,
          keyResults: goal.keyResults.map((k) => ({
            id: k.id,
            title: k.title,
            startValue: k.startValue,
            targetValue: k.targetValue,
            currentValue: k.currentValue,
            unit: k.unit ?? "",
          })),
        }}
      />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent size="sm">
          <DialogHeader
            title="Delete this goal?"
            description="Its key results and check-ins go with it. This can't be undone."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteGoal({ goalId: goal.id });
                  if (!r.ok) {
                    toast.error("Couldn't delete", { description: r.error });
                    return;
                  }
                  toast.success("Goal deleted");
                  router.push("/performance");
                })
              }
            >
              <Trash2 aria-hidden /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
