import * as React from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 eyebrow">{eyebrow}</p>}
        <h1 className="font-display-soft text-display font-medium text-ink">{title}</h1>
        {description && <p className="mt-2 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Standard page gutter and max width. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10", className)}
      {...props}
    />
  );
}
