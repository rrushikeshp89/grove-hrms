"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarPlus, CircleAlert, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DateRangePicker, type DateRange } from "@/components/ui/calendar";
import { Checkbox, SegmentedControl } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { addDays, type ISODate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { applyLeave } from "../actions";
import { leaveDays } from "../logic/days";
import { validateLeave } from "../logic/validate";
import type { ApplyContext, BalanceRow } from "../queries";
import { applyLeaveSchema, type ApplyLeaveInput } from "../schemas";

const toLocal = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) => format(d, "yyyy-MM-dd");
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function ApplyLeaveSheet({
  balances,
  context,
}: {
  balances: BalanceRow[];
  context: ApplyContext;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const defaultType = balances.find((b) => b.code === "CL") ?? balances[0];
  const form = useForm<ApplyLeaveInput, unknown, z.output<typeof applyLeaveSchema>>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: {
      leaveTypeId: defaultType?.typeId ?? "",
      start: "",
      end: "",
      startHalf: null,
      endHalf: null,
      reason: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [typeId, start, end, startHalf, endHalf] = useWatch({
    control: form.control,
    name: ["leaveTypeId", "start", "end", "startHalf", "endHalf"],
  });
  const type = balances.find((b) => b.typeId === typeId);

  const calendar = React.useMemo(
    () => ({ workDays: context.workDays, holidays: new Set(context.holidays.map((h) => h.day)) }),
    [context],
  );
  const holidays = React.useMemo(
    () => context.holidays.map((h) => ({ date: toLocal(h.day), label: h.name })),
    [context],
  );
  const conflicts = React.useMemo(
    () => context.conflicts.map((c) => ({ date: toLocal(c.day), names: c.names })),
    [context],
  );

  const single = !!start && start === end;
  const days = start && end ? leaveDays({ start, end, startHalf, endHalf }, calendar) : 0;
  const problems =
    type && start && end
      ? validateLeave({
          type,
          start,
          end,
          halfDay: !!(startHalf || endHalf),
          days,
          today: context.today,
          available: type.summary.available,
          overlaps: null,
        })
      : [];
  const away = start && end ? context.conflicts.filter((c) => c.day >= start && c.day <= end) : [];
  const awayNames = [...new Set(away.flatMap((a) => a.names))];

  const range: DateRange | undefined = start
    ? { from: toLocal(start), to: end ? toLocal(end) : undefined }
    : undefined;

  const submit = form.handleSubmit(async () => {
    const r = await applyLeave(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof ApplyLeaveInput, { message: m.join(" ") });
      if (!r.fieldErrors) toast.error("Request not sent", { description: r.error });
      return;
    }
    toast.success("Request sent", {
      description: `${fmt(r.data.days)} ${r.data.days === 1 ? "day" : "days"} of ${type?.name.toLowerCase()} is waiting for approval.`,
    });
    setOpen(false);
    form.reset();
    router.refresh();
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <CalendarPlus aria-hidden /> Apply for leave
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-lg">
        <SheetHeader
          title="Apply for leave"
          description="Your manager is notified as soon as you send it."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="flex flex-col gap-5">
            <Field label="Type" error={errors.leaveTypeId?.message}>
              <Controller
                control={form.control}
                name="leaveTypeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {balances.map((b) => (
                        <SelectItem key={b.typeId} value={b.typeId}>
                          {b.name}
                          {b.isPaid ? ` · ${fmt(b.summary.available)} left` : " · unpaid"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {type?.description && (
              <p className="-mt-3 text-small text-ink-muted">{type.description}</p>
            )}

            <Field
              label="Dates"
              hint="Amber dots are holidays; slate dots mean teammates are away."
              error={errors.start?.message ?? errors.end?.message}
            >
              <DateRangePicker
                value={range}
                onChange={(r) => {
                  form.setValue("start", r?.from ? toIso(r.from) : "", { shouldValidate: false });
                  form.setValue("end", r?.from ? toIso(r.to ?? r.from) : "", {
                    shouldValidate: false,
                  });
                  form.setValue("startHalf", null);
                  form.setValue("endHalf", null);
                  form.clearErrors(["start", "end"]);
                }}
                holidays={holidays}
                conflicts={conflicts}
                disabled={{ before: toLocal(addDays(context.today, -7)) }}
              />
            </Field>

            {type?.allowHalfDay &&
              start &&
              end &&
              (single ? (
                <SegmentedControl
                  aria-label="Part of the day"
                  value={startHalf ?? endHalf ?? "FULL"}
                  onValueChange={(v) => {
                    form.setValue("startHalf", v === "FULL" ? null : (v as "FIRST" | "SECOND"));
                    form.setValue("endHalf", null);
                  }}
                  options={[
                    { value: "FULL", label: "Full day" },
                    { value: "FIRST", label: "Morning" },
                    { value: "SECOND", label: "Afternoon" },
                  ]}
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5 text-body text-ink">
                    <Checkbox
                      checked={startHalf === "SECOND"}
                      onCheckedChange={(v) => form.setValue("startHalf", v ? "SECOND" : null)}
                    />
                    Start after lunch on {format(toLocal(start), "EEE d MMM")}
                  </label>
                  <label className="flex items-center gap-2.5 text-body text-ink">
                    <Checkbox
                      checked={endHalf === "FIRST"}
                      onCheckedChange={(v) => form.setValue("endHalf", v ? "FIRST" : null)}
                    />
                    Back after lunch on {format(toLocal(end), "EEE d MMM")}
                  </label>
                </div>
              ))}

            {start && end && type && (
              <div
                className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-sunken/50 p-4"
                aria-live="polite"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-body text-ink">
                    <span className="font-display-soft num text-title font-medium">
                      {fmt(days)}
                    </span>{" "}
                    working {days === 1 ? "day" : "days"}
                  </p>
                  {type.isPaid && (
                    <p
                      className={cn(
                        "num text-small",
                        days > type.summary.available ? "text-danger" : "text-ink-muted",
                      )}
                    >
                      {fmt(type.summary.available)} → {fmt(type.summary.available - days)} left
                    </p>
                  )}
                </div>
                {awayNames.length > 0 && (
                  <p className="flex items-start gap-2 text-small text-info">
                    <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {awayNames.length === 1
                      ? `${awayNames[0]} is`
                      : `${awayNames.slice(0, -1).join(", ")} and ${awayNames.at(-1)} are`}{" "}
                    also away during these dates.
                  </p>
                )}
                {problems.map((p) => (
                  <p key={p.message} className="flex items-start gap-2 text-small text-danger">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {p.message}
                  </p>
                ))}
              </div>
            )}

            <Field
              label="Reason"
              hint="Your approver and HR can see this."
              error={errors.reason?.message}
            >
              <Textarea
                rows={3}
                placeholder="Family wedding in Mysuru"
                {...form.register("reason")}
              />
            </Field>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={problems.length > 0}>
              <Send aria-hidden /> Send request
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
