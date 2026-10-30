"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { ExportLink } from "@/components/shell/export-link";
import { DateRangePicker, type DateRange } from "@/components/ui/calendar";
import { SegmentedControl } from "@/components/ui/choice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dbDate, type ISODate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { PRESET_LABELS, PRESETS, type AnalyticsRange, type Preset } from "../logic/range";

const ALL = "all";
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Range and department live in the URL, so a view can be bookmarked or
 * shared. While the next view loads, the current one dims instead of
 * jumping to skeletons.
 */
export function AnalyticsFilters({
  range,
  department,
  departments,
  dataStart,
  today,
  children,
}: {
  range: AnalyticsRange;
  department: string | null;
  departments: { code: string; name: string }[];
  dataStart: ISODate;
  today: ISODate;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  // The controls answer at once; the reports follow when the server has them.
  const [shown, setShown] = React.useOptimistic({ preset: range.preset, department });
  const [custom, setCustom] = React.useState<DateRange | undefined>(
    range.preset === "custom" ? { from: dbDate(range.start), to: dbDate(range.end) } : undefined,
  );

  function go(next: {
    range?: AnalyticsRange["preset"];
    from?: string;
    to?: string;
    dept?: string | null;
  }) {
    const p = new URLSearchParams();
    const preset = next.range ?? range.preset;
    if (preset !== "12m") p.set("range", preset);
    if (preset === "custom") {
      p.set("from", next.from ?? range.start);
      p.set("to", next.to ?? range.end);
    }
    const dept = next.dept === undefined ? department : next.dept;
    if (dept) p.set("dept", dept);
    const qs = p.toString();
    startTransition(() => {
      setShown({ preset, department: dept });
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // The report covers whatever the page is showing, once it has loaded.
  const exportParams = new URLSearchParams();
  if (range.preset !== "12m") exportParams.set("range", range.preset);
  if (range.preset === "custom") {
    exportParams.set("from", range.start);
    exportParams.set("to", range.end);
  }
  if (department) exportParams.set("dept", department);
  const exportHref = `/analytics/export${exportParams.size ? `?${exportParams}` : ""}`;

  // Local midnight on both ends, as the calendar works in the viewer's zone.
  const min = new Date(`${dataStart}T00:00:00`);
  const max = new Date(`${today}T00:00:00`);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="search"
        aria-label="Report filters"
        className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <SegmentedControl<Preset | "custom">
          aria-label="Period"
          size="sm"
          value={shown.preset}
          onValueChange={(v) => {
            if (v === "custom") return;
            setCustom(undefined);
            go({ range: v });
          }}
          options={PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
          className="self-start"
        />
        <div className="w-full sm:w-64">
          <DateRangePicker
            aria-label="Custom period"
            placeholder="Custom dates"
            value={custom}
            disabled={[{ before: min }, { after: max }]}
            className={cn(shown.preset === "custom" && "border-accent")}
            onChange={(r) => {
              setCustom(r);
              if (r?.from && r.to) go({ range: "custom", from: iso(r.from), to: iso(r.to) });
            }}
          />
        </div>
        <div className="w-full sm:ml-auto sm:w-56">
          <Select
            value={shown.department ?? ALL}
            onValueChange={(v) => go({ dept: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportLink href={exportHref} className="w-full sm:w-auto">
          Export PDF
        </ExportLink>
        <span className="sr-only" aria-live="polite">
          {pending ? "Updating reports" : ""}
        </span>
      </div>
      <div
        aria-busy={pending}
        className={cn(
          "transition-opacity duration-200",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function RangeNote({ label, weekly }: { label: string; weekly: boolean }) {
  return (
    <p className="-mt-2 inline-flex items-center gap-1.5 text-small text-ink-subtle">
      <CalendarRange className="size-3.5" aria-hidden />
      {label} · charted by {weekly ? "week" : "month"}
    </p>
  );
}
