import { RotateCcw, type LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./primitives";

/**
 * Empty states are a composition of a primary icon on a soft tile with two
 * small satellite icons, so each one feels specific to its context without
 * needing bespoke illustrations.
 */
export function EmptyState({
  icon: Icon,
  satellites = [],
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
}: {
  icon: LucideIcon;
  satellites?: LucideIcon[];
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [A, B] = satellites;
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-3 px-6 py-8" : "gap-4 px-6 py-14",
        className,
      )}
    >
      <div aria-hidden className="relative mb-1">
        <div className="grid size-16 rotate-[-4deg] place-items-center rounded-[18px] border border-hairline bg-surface-sunken">
          <Icon className="size-7 rotate-[4deg] text-accent" strokeWidth={1.5} />
        </div>
        {A && (
          <span className="absolute -top-2 -right-4 grid size-8 rotate-[8deg] place-items-center rounded-control border border-hairline bg-surface shadow-sm">
            <A className="size-4 text-highlight-ink" strokeWidth={1.75} />
          </span>
        )}
        {B && (
          <span className="absolute -bottom-1 -left-4 grid size-7 rotate-[-10deg] place-items-center rounded-control border border-hairline bg-surface shadow-sm">
            <B className="size-3.5 text-ink-subtle" strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="max-w-sm">
        <h3 className="font-display-soft text-title font-medium text-ink">{title}</h3>
        <p className="mt-1.5 text-body text-ink-muted">{description}</p>
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Says what happened in plain words and always offers a way forward. */
export function ErrorState({
  title = "This didn't load",
  description,
  onRetry,
  retryLabel = "Try again",
  secondaryAction,
  reference,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: React.ReactNode;
  /** An error digest people can quote to support. */
  reference?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-danger/25 bg-danger-subtle/60 p-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-heading font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-body text-ink-muted">{description}</p>
        {reference && (
          <p className="mt-2 text-caption text-ink-subtle">
            Reference <span className="font-mono num">{reference}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {secondaryAction}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 text-body font-medium text-ink shadow-xs transition-colors hover:bg-surface-hover"
          >
            <RotateCcw className="size-4" aria-hidden />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Content-shaped skeletons ─────────────────────────────────────────── */

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface" aria-busy>
      <span className="sr-only">Loading table</span>
      <div className="flex h-10 items-center gap-6 border-b border-hairline bg-surface-sunken px-cell">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex h-row items-center gap-6 border-b border-hairline px-cell last:border-0"
        >
          <div className="flex w-56 items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className="h-3 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <span className="sr-only">Loading profile</span>
      <div className="flex items-center gap-5">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-6 border-b border-hairline pb-3">
        {[64, 48, 72, 56].map((w) => (
          <Skeleton key={w} className="h-3.5" style={{ width: w }} />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <span className="sr-only">Loading dashboard</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5 lg:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-3 rounded-card border border-hairline bg-surface p-5"
        >
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
