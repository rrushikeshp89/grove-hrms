"use client";

import { format, isSameDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  type DateRange,
  type DayButtonProps,
  type DayPickerProps,
} from "react-day-picker";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import { buttonVariants } from "./button";
import { useFieldProps } from "./field";
import { Popover, PopoverContent, PopoverTrigger } from "./overlay";

export type { DateRange };

export type DayMarker = { date: Date; label: string };

type Markers = {
  /** Company holidays: amber dot, named in the day's accessible label. */
  holidays?: DayMarker[];
  /** Days where teammates are already away: a small count. */
  conflicts?: { date: Date; names: string[] }[];
};

const MarkersCtx = React.createContext<Markers>({});

function MarkedDayButton({ day, modifiers, className, children, ...props }: DayButtonProps) {
  const { holidays = [], conflicts = [] } = React.useContext(MarkersCtx);
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const holiday = holidays.find((h) => isSameDay(h.date, day.date));
  const conflict = conflicts.find((c) => isSameDay(c.date, day.date));
  const extra = [
    holiday && `Holiday: ${holiday.label}`,
    conflict &&
      `${conflict.names.length} teammate${conflict.names.length > 1 ? "s" : ""} away: ${conflict.names.join(", ")}`,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      ref={ref}
      className={cn(className, "relative")}
      {...props}
      aria-label={
        extra ? `${props["aria-label"] ?? format(day.date, "PPPP")}. ${extra}` : props["aria-label"]
      }
      title={extra || undefined}
    >
      {children}
      {(holiday || conflict) && (
        <span aria-hidden className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
          {holiday && <span className="size-1 rounded-full bg-highlight" />}
          {conflict && <span className="size-1 rounded-full bg-info" />}
        </span>
      )}
    </button>
  );
}

export function Calendar({
  className,
  classNames,
  holidays,
  conflicts,
  ...props
}: DayPickerProps & Markers) {
  // "Today" is the viewer's, so the grid renders after hydration; the
  // placeholder keeps the layout from jumping.
  const mounted = useMounted();
  if (!mounted) {
    const months = props.numberOfMonths ?? 1;
    return (
      <div
        aria-hidden
        className={cn("flex gap-6", className)}
        style={{ width: months * 280 + (months - 1) * 24, height: 330 }}
      />
    );
  }
  return (
    <MarkersCtx.Provider value={{ holidays, conflicts }}>
      <DayPicker
        showOutsideDays
        weekStartsOn={1}
        className={cn("w-fit", className)}
        classNames={{
          months: "relative flex flex-col gap-6 sm:flex-row",
          month: "flex flex-col gap-3",
          month_caption: "flex h-8 items-center px-1",
          caption_label: "font-display-soft text-heading font-medium text-ink",
          nav: "absolute top-0 right-0 flex items-center gap-1",
          button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" })),
          button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" })),
          month_grid: "border-collapse",
          weekdays: "flex",
          weekday: "w-10 pb-1 text-caption font-medium text-ink-subtle",
          week: "mt-0.5 flex",
          day: "group/day relative size-10 p-0 text-center",
          day_button: cn(
            "size-10 rounded-control num text-body text-ink transition-colors duration-150",
            "hover:bg-surface-hover",
            "group-data-[selected=true]/day:bg-accent group-data-[selected=true]/day:text-accent-fg",
          ),
          today:
            "[&>button]:font-semibold [&>button]:text-accent [&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4",
          outside: "[&>button]:text-ink-subtle",
          disabled: "[&>button]:pointer-events-none [&>button]:opacity-35",
          range_start: "rounded-l-control bg-accent-subtle",
          range_end: "rounded-r-control bg-accent-subtle",
          range_middle:
            "bg-accent-subtle [&>button]:rounded-none [&>button]:bg-transparent! [&>button]:text-ink!",
          hidden: "invisible",
          ...classNames,
        }}
        modifiers={{ weekend: { dayOfWeek: [0, 6] }, ...props.modifiers }}
        modifiersClassNames={{ weekend: "[&>button]:text-ink-muted", ...props.modifiersClassNames }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === "left" ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            ),
          DayButton: MarkedDayButton,
          ...props.components,
        }}
        {...props}
      />
    </MarkersCtx.Provider>
  );
}

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return null;
  if (!range.to || isSameDay(range.from, range.to)) return format(range.from, "EEE, d MMM yyyy");
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  return `${format(range.from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick dates",
  holidays,
  conflicts,
  disabled,
  className,
  id,
  ...aria
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: DayPickerProps["disabled"];
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
} & Markers) {
  const label = rangeLabel(value);
  const field = useFieldProps({ id, ...aria });
  return (
    <Popover>
      <PopoverTrigger
        {...field}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-control border border-border-input bg-surface px-3 text-left text-body",
          "transition-colors duration-150 hover:border-ink-subtle aria-invalid:border-danger",
          !label && "text-ink-subtle",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <span className="truncate num">{label ?? placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          defaultMonth={value?.from}
          holidays={holidays}
          conflicts={conflicts}
          disabled={disabled}
        />
        {(holidays?.length || conflicts?.length) && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-hairline pt-3 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-highlight" /> Holiday
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-info" /> Teammates away
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
