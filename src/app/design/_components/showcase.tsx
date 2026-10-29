import * as React from "react";

import { cn } from "@/lib/utils";

/** A titled section on a design-system page, linkable by id. */
export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20", className)}>
      <div className="mb-5 max-w-2xl">
        <h2 id={`${id}-title`} className="font-display-soft text-title font-medium text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** A labelled specimen panel. */
export function Specimen({
  label,
  children,
  className,
  bodyClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("rounded-card border border-hairline bg-surface shadow-xs", className)}>
      <p className="border-b border-hairline px-4 py-2.5 text-caption font-medium text-ink-subtle">
        {label}
      </p>
      <div className={cn("flex flex-wrap items-center gap-3 p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

export function SectionStack({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 flex flex-col gap-16">{children}</div>;
}
