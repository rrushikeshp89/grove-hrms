import { cn } from "@/lib/utils";

import type { DaySummary } from "../queries";

const SEGMENTS = [
  { key: "in", label: "In", className: "bg-accent" },
  { key: "late", label: "Late", className: "bg-warning" },
  { key: "out", label: "Gone home", className: "bg-info" },
  { key: "leave", label: "On leave", className: "bg-highlight" },
  { key: "notYet", label: "Not in yet", className: "bg-surface-active" },
] as const;

/** One bar for the shape of the day, with the numbers spelled out below. */
export function DayBar({ counts, total }: { counts: DaySummary["counts"]; total: number }) {
  const shown = SEGMENTS.filter((s) => counts[s.key] > 0);
  const away = counts.away;
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-hidden
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        {shown.map((s) => (
          <span
            key={s.key}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className)}
            style={{ width: `${(counts[s.key] / Math.max(total, 1)) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-small text-ink-muted">
            <span aria-hidden className={cn("size-2 rounded-full", s.className)} />
            {s.label}
            <span className="num font-medium text-ink">{counts[s.key]}</span>
          </li>
        ))}
        {away > 0 && (
          <li className="text-small text-ink-subtle">{away} off for the weekend or a holiday</li>
        )}
      </ul>
    </div>
  );
}
