"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
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
import { cn } from "@/lib/utils";

import { saveLeaveType, setLeaveTypeActive } from "../actions";
import { policySummary } from "../logic";
import type { LeaveTypeRow } from "../queries";
import { leaveTypeSchema, type LeaveTypeInput } from "../schemas";

const BLANK: LeaveTypeInput = {
  id: null,
  name: "",
  code: "",
  description: "",
  isPaid: true,
  allowHalfDay: true,
  approvalLevels: 1,
  maxConsecutiveDays: null,
  minNoticeDays: 0,
  requiresDocumentAfterDays: null,
  annualQuota: 12,
  accrual: "MONTHLY",
  carryForwardMax: 0,
  proRataOnJoin: true,
};

const toInput = (t: LeaveTypeRow): LeaveTypeInput => ({
  id: t.id,
  name: t.name,
  code: t.code,
  description: t.description ?? "",
  isPaid: t.isPaid,
  allowHalfDay: t.allowHalfDay,
  approvalLevels: t.approvalLevels,
  maxConsecutiveDays: t.maxConsecutiveDays,
  minNoticeDays: t.minNoticeDays,
  requiresDocumentAfterDays: t.requiresDocumentAfterDays,
  ...t.policy,
});

function Toggle({
  label,
  hint,
  name,
  control,
}: {
  label: string;
  hint?: string;
  name: "isPaid" | "allowHalfDay" | "proRataOnJoin";
  control: ReturnType<
    typeof useForm<LeaveTypeInput, unknown, z.output<typeof leaveTypeSchema>>
  >["control"];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-center justify-between gap-4 rounded-control border border-hairline px-3.5 py-2.5 text-body text-ink">
          <span>
            {label}
            {hint && <span className="block text-small text-ink-muted">{hint}</span>}
          </span>
          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
        </label>
      )}
    />
  );
}

function LeaveTypeSheet({
  type,
  open,
  onOpenChange,
}: {
  type: LeaveTypeRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<LeaveTypeInput, unknown, z.output<typeof leaveTypeSchema>>({
    resolver: zodResolver(leaveTypeSchema),
    values: type ? toInput(type) : BLANK,
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await saveLeaveType(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof LeaveTypeInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Leave type not saved", { description: r.error });
      return;
    }
    toast.success(type ? "Leave type updated" : "Leave type added");
    onOpenChange(false);
    router.refresh();
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title={type ? `Edit ${type.name}` : "New leave type"}
          description="Balances are worked out from these rules, so changes apply to everyone straight away."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field
              label="Code"
              hint={type ? "Fixed once created." : "Two to four letters."}
              error={errors.code?.message}
            >
              <Input {...form.register("code")} disabled={!!type} className="uppercase" />
            </Field>
            <Field
              label="What it's for"
              optional
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={2} {...form.register("description")} />
            </Field>

            <p className="eyebrow sm:col-span-2">Allowance</p>
            <Field label="Days a year" error={errors.annualQuota?.message}>
              <Input type="number" step={0.5} min={0} {...form.register("annualQuota")} />
            </Field>
            <Field label="How it builds up" error={errors.accrual?.message}>
              <Controller
                control={form.control}
                name="accrual"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">A little each month</SelectItem>
                      <SelectItem value="UPFRONT">All at the start of the year</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Carries over (days)" error={errors.carryForwardMax?.message}>
              <Input type="number" step={0.5} min={0} {...form.register("carryForwardMax")} />
            </Field>
            <div className="self-end">
              <Toggle
                control={form.control}
                name="proRataOnJoin"
                label="Pro-rata for new joiners"
              />
            </div>

            <p className="eyebrow sm:col-span-2">Rules</p>
            <Field label="Approval" error={errors.approvalLevels?.message}>
              <Controller
                control={form.control}
                name="approvalLevels"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Manager only</SelectItem>
                      <SelectItem value="2">Manager, then HR</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Notice needed (days)" error={errors.minNoticeDays?.message}>
              <Input type="number" min={0} {...form.register("minNoticeDays")} />
            </Field>
            <Field
              label="Longest stretch (days)"
              optional
              error={errors.maxConsecutiveDays?.message}
            >
              <Input type="number" min={1} {...form.register("maxConsecutiveDays")} />
            </Field>
            <Field
              label="Document needed after (days)"
              optional
              error={errors.requiresDocumentAfterDays?.message}
            >
              <Input type="number" min={1} {...form.register("requiresDocumentAfterDays")} />
            </Field>
            <Toggle
              control={form.control}
              name="isPaid"
              label="Paid"
              hint="Unpaid leave reduces that month's pay."
            />
            <Toggle control={form.control} name="allowHalfDay" label="Half days allowed" />
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save aria-hidden /> {type ? "Save changes" : "Add leave type"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function LeaveTypes({ types }: { types: LeaveTypeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<LeaveTypeRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> New leave type
        </Button>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {types.map((t) => (
          <li key={t.id}>
            <div
              className={cn(
                "flex h-full flex-col gap-3 rounded-card border border-hairline bg-surface p-5",
                !t.isActive && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-heading font-semibold text-ink">
                    {t.name}
                    <Badge className="font-mono">{t.code}</Badge>
                    {!t.isActive && <Badge tone="warning">Inactive</Badge>}
                  </h2>
                  <p className="mt-1 text-small text-ink-muted">{policySummary(t.policy)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing(t)}
                  aria-label={`Edit ${t.name}`}
                >
                  <Pencil aria-hidden />
                </Button>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                <li>
                  <Badge tone={t.isPaid ? "success" : "neutral"}>
                    {t.isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                </li>
                <li>
                  <Badge>{t.approvalLevels === 2 ? "Manager, then HR" : "Manager approves"}</Badge>
                </li>
                {t.minNoticeDays > 0 && (
                  <li>
                    <Badge>{t.minNoticeDays} days&apos; notice</Badge>
                  </li>
                )}
                {t.maxConsecutiveDays && (
                  <li>
                    <Badge>Up to {t.maxConsecutiveDays} days at once</Badge>
                  </li>
                )}
                {!t.allowHalfDay && (
                  <li>
                    <Badge>Full days only</Badge>
                  </li>
                )}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-3 text-small text-ink-muted">
                <span>
                  {t.requests} {t.requests === 1 ? "request" : "requests"} so far
                </span>
                <label className="flex items-center gap-2">
                  {t.isActive ? "Active" : "Inactive"}
                  <Switch
                    checked={t.isActive}
                    disabled={pending}
                    aria-label={`${t.name} is ${t.isActive ? "active" : "inactive"}`}
                    onCheckedChange={(active) =>
                      startTransition(async () => {
                        const r = await setLeaveTypeActive({ id: t.id, active });
                        if (!r.ok) toast.error("Couldn't change that", { description: r.error });
                        else {
                          toast.success(
                            active
                              ? `${t.name} is available again`
                              : `${t.name} is hidden from new requests`,
                          );
                          router.refresh();
                        }
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <LeaveTypeSheet
        type={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <LeaveTypeSheet type={null} open={adding} onOpenChange={setAdding} />
    </>
  );
}
