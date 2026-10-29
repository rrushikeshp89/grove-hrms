import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const tone = {
  neutral: "bg-surface-sunken text-ink-muted",
  accent: "bg-accent-subtle text-accent",
  highlight: "bg-highlight-subtle text-highlight-ink",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
} as const;

export type Tone = keyof typeof tone;

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone,
      size: {
        sm: "h-5 px-2 text-caption",
        md: "h-6 px-2.5 text-small",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

/** Small label for counts, categories and states. Pill shaped. */
export function Badge({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/** An outlined, removable-looking chip for skills and filters. */
export function Tag({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 text-small text-ink-muted",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Status with a leading dot. Each domain maps its statuses to a tone in one
 * place (see STATUS_TONES) so "Pending" looks the same everywhere.
 */
export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge tone={tone} size="md" className={cn("gap-1.5 pl-2", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

export const STATUS_TONES = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
  draft: "neutral",
  active: "success",
  onboarding: "info",
  onLeave: "highlight",
  notice: "warning",
  exited: "neutral",
} as const satisfies Record<string, Tone>;
