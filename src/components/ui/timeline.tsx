import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import type { Tone } from "./badge";

const dotTone: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-subtle",
  accent: "bg-accent-subtle text-accent",
  highlight: "bg-highlight-subtle text-highlight-ink",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};

export type TimelineItem = {
  id: string;
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** ISO string; rendered in mono so times line up. */
  at: string;
  atLabel: string;
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative flex flex-col", className)}>
      {items.map((it, i) => {
        const Icon = it.icon;
        const last = i === items.length - 1;
        return (
          <li key={it.id} className="relative flex gap-3.5 pb-6 last:pb-0">
            {!last && (
              <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-hairline" />
            )}
            <span
              className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface",
                dotTone[it.tone ?? "neutral"],
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-body text-ink">{it.title}</p>
                <time dateTime={it.at} className="font-mono num text-caption text-ink-subtle">
                  {it.atLabel}
                </time>
              </div>
              {it.body && <div className="mt-1 text-small text-ink-muted">{it.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
