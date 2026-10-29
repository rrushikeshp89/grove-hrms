"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import * as React from "react";

import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-caption",
  md: "size-10 text-small",
  lg: "size-14 text-heading",
  xl: "size-20 text-title font-display-soft",
} as const;

// Fallback fills rotate through quiet token pairs so a grid of initials
// doesn't look like one grey wall. The hash keeps a person's color stable.
const fills = [
  "bg-accent-subtle text-accent",
  "bg-highlight-subtle text-highlight-ink",
  "bg-info-subtle text-info",
  "bg-success-subtle text-success",
  "bg-surface-active text-ink-muted",
] as const;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
  ring,
  labelled = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  /** Draws a bg-colored ring, for stacks and overlaps. */
  ring?: boolean;
  /**
   * Announce the name to screen readers. Off by default because avatars
   * usually sit next to the visible name, which would be read twice.
   */
  labelled?: boolean;
}) {
  return (
    <AvatarPrimitive.Root
      role={labelled ? "img" : undefined}
      aria-label={labelled ? name : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full font-medium select-none",
        sizes[size],
        ring && "ring-2 ring-surface",
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className={cn("grid size-full place-items-center", fills[hash(name) % fills.length])}
        delayMs={src ? 400 : 0}
      >
        <span aria-hidden>{initials(name)}</span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div
      role="img"
      aria-label={people.map((p) => p.name).join(", ")}
      className={cn("flex items-center -space-x-2", className)}
    >
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} src={p.src} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "relative inline-grid place-items-center rounded-full bg-surface-sunken num font-medium text-ink-muted ring-2 ring-surface",
            sizes[size],
          )}
          aria-hidden
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
