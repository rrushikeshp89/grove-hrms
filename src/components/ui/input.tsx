import * as React from "react";

import { cn } from "@/lib/utils";

export const controlBase = [
  "w-full rounded-control border border-border-input bg-surface text-ink",
  "placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-150",
  "hover:border-ink-subtle",
  "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/20",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20",
].join(" ");

type InputProps = React.ComponentProps<"input"> & {
  /** Lucide icon rendered at the start of the field. */
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
};

export function Input({ className, leadingIcon, trailing, type = "text", ...props }: InputProps) {
  const input = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlBase,
        "h-9 px-3 text-body",
        "file:mr-3 file:border-0 file:bg-transparent file:text-small file:font-medium file:text-ink",
        leadingIcon && "pl-9",
        trailing && "pr-9",
        !leadingIcon && !trailing && className,
      )}
      {...props}
    />
  );
  if (!leadingIcon && !trailing) return input;
  return (
    <div className={cn("relative", className)}>
      {leadingIcon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle [&_svg]:size-4">
          {leadingIcon}
        </span>
      )}
      {input}
      {trailing && (
        <span className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-subtle">
          {trailing}
        </span>
      )}
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlBase, "min-h-24 px-3 py-2 text-body", className)}
      {...props}
    />
  );
}
