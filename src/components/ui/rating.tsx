"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One to five stars as a radio group. Pressing the chosen star again clears
 * the rating, so "no rating" stays reachable.
 */
export function RatingInput({
  value,
  onChange,
  label = "Rating",
  disabled,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5`}
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className="grid size-7 place-items-center rounded-xs text-ink-subtle hover:text-accent disabled:pointer-events-none"
          >
            <Star className={cn("size-4.5", on && "fill-current text-accent")} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** A read-only row of stars, for ratings people have already given. */
export function RatingDisplay({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5 text-ink-subtle", i <= value && "fill-current text-accent")}
        />
      ))}
    </span>
  );
}
