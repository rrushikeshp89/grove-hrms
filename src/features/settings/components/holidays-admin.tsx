"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { MapPin, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { dbDate } from "@/lib/tz";

import { deleteHoliday, saveHoliday } from "../actions";
import type { HolidayRow } from "../queries";
import { holidaySchema, type HolidayInput } from "../schemas";

const ALL = "all";

function HolidaySheet({
  holiday,
  open,
  onOpenChange,
  locations,
  defaultDate,
}: {
  holiday: HolidayRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locations: { id: string; name: string }[];
  defaultDate: string;
}) {
  const router = useRouter();
  const form = useForm<HolidayInput, unknown, z.output<typeof holidaySchema>>({
    resolver: zodResolver(holidaySchema),
    values: holiday
      ? {
          id: holiday.id,
          name: holiday.name,
          date: holiday.date,
          locationId: holiday.locationId,
          isOptional: holiday.isOptional,
        }
      : { id: null, name: "", date: defaultDate, locationId: null, isOptional: false },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async () => {
    const r = await saveHoliday(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof HolidayInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Holiday not saved", { description: r.error });
      return;
    }
    toast.success(holiday ? "Holiday updated" : "Holiday added");
    onOpenChange(false);
    router.refresh();
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title={holiday ? "Edit holiday" : "Add a holiday"}
          description="It shows on everyone's calendar and is skipped when leave is counted."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4">
            <Field label="Name" error={errors.name?.message}>
              <Input placeholder="Diwali" {...form.register("name")} />
            </Field>
            <Field label="Date" error={errors.date?.message}>
              <Input type="date" {...form.register("date")} />
            </Field>
            <Field label="Applies to" error={errors.locationId?.message}>
              <Controller
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ALL}
                    onValueChange={(v) => field.onChange(v === ALL ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Every location</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} only
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Controller
              control={form.control}
              name="isOptional"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-4 rounded-control border border-hairline px-3.5 py-2.5 text-body text-ink">
                  <span>
                    Optional
                    <span className="block text-small text-ink-muted">
                      A working day, taken as casual leave if someone wants it off.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Optional holiday"
                  />
                </label>
              )}
            />
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save aria-hidden /> {holiday ? "Save changes" : "Add holiday"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function HolidaysAdmin({
  year,
  holidays,
  locations,
}: {
  year: number;
  holidays: HolidayRow[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<HolidayRow | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<HolidayRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden /> Add a holiday
        </Button>
      </div>
      <ul className="rounded-card border border-hairline bg-surface">
        {holidays.map((h) => (
          <li
            key={h.id}
            className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-0"
          >
            <span className="w-28 shrink-0 num text-small text-ink-muted">
              {format(dbDate(h.date), "EEE d MMM")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-ink">{h.name}</span>
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {h.location && (
                  <Badge tone="info">
                    <MapPin aria-hidden /> {h.location} only
                  </Badge>
                )}
                {h.isOptional && <Badge>Optional</Badge>}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(h)}
              aria-label={`Edit ${h.name}`}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-ink-subtle"
              onClick={() => setRemoving(h)}
              aria-label={`Remove ${h.name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
        {holidays.length === 0 && (
          <li className="px-5 py-10 text-center text-body text-ink-muted">
            No holidays are listed for {year} yet.
          </li>
        )}
      </ul>
      <HolidaySheet
        holiday={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        locations={locations}
        defaultDate={`${year}-01-01`}
      />
      <HolidaySheet
        holiday={null}
        open={adding}
        onOpenChange={setAdding}
        locations={locations}
        defaultDate={`${year}-01-01`}
      />
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent size="sm">
          <DialogHeader
            title="Remove this holiday?"
            description={
              removing
                ? `${removing.name} comes off the calendar. Leave already counted around it isn't recalculated.`
                : undefined
            }
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                removing &&
                startTransition(async () => {
                  const r = await deleteHoliday({ id: removing.id });
                  if (!r.ok) {
                    toast.error("Couldn't remove it", { description: r.error });
                    return;
                  }
                  toast.success("Holiday removed");
                  setRemoving(null);
                  router.refresh();
                })
              }
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
