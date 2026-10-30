import { Separator as SeparatorPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/* ─── Card ─────────────────────────────────────────────────────────────── */

export function Card({
  className,
  interactive,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-card border border-hairline bg-surface shadow-xs",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 ease-out-soft hover:-translate-y-px hover:border-border-strong hover:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-heading font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-small text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-hairline px-5 py-3 text-small text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Separator ────────────────────────────────────────────────────────── */

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-hairline",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Kbd ──────────────────────────────────────────────────────────────── */

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-hairline border-b-border-strong bg-surface px-1",
        "font-sans text-caption font-medium text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/* ─── Description list ─────────────────────────────────────────────────── */

export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: { term: string; detail: React.ReactNode; mono?: boolean }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.term} className="min-w-0">
          <dt className="text-small text-ink-subtle">{it.term}</dt>
          <dd className={cn("mt-0.5 text-body text-ink", it.mono && "font-mono num text-small")}>
            {it.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────────── */

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-sm bg-surface-active", className)}
      {...props}
    />
  );
}
