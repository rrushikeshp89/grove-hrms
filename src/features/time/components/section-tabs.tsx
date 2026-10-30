"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Link tabs for sibling pages (Mine / Team), with the current one marked. */
export function SectionTabs({
  tabs,
  label,
  current,
}: {
  tabs: { href: string; label: string }[];
  label: string;
  /** For tabs that differ by query string, the href of the active one. */
  current?: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="relative flex items-center gap-6 overflow-x-auto border-b border-hairline"
    >
      {tabs.map((t) => {
        const active = (current ?? pathname) === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 shrink-0 items-center border-b-2 text-body font-medium transition-colors",
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
