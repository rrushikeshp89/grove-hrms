"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import * as React from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { activeHref, type NavGroup } from "@/config/navigation";
import { useHtmlData } from "@/hooks/use-html-data";
import { snappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { BrandMark, Wordmark } from "./brand";

export function NavList({
  groups,
  onNavigate,
  collapsible = true,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  /** When false (mobile sheet), labels always show. */
  collapsible?: boolean;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname, groups);
  const indicatorId = React.useId();

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className={cn("mb-1 px-2.5 eyebrow", collapsible && "sidebar-collapsed:sr-only")}>
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === active;
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-body font-medium transition-colors duration-150",
                  isActive ? "text-ink" : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                  collapsible && "sidebar-collapsed:justify-center sidebar-collapsed:px-0",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={indicatorId}
                    transition={snappy}
                    className="absolute inset-0 rounded-control border border-hairline bg-surface shadow-xs"
                  />
                )}
                <Icon
                  className={cn(
                    "relative size-[18px] shrink-0",
                    isActive ? "text-accent" : "text-ink-subtle group-hover:text-ink-muted",
                  )}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span
                  className={cn("relative truncate", collapsible && "sidebar-collapsed:sr-only")}
                >
                  {item.label}
                </span>
              </Link>
            );
            return collapsible ? (
              <CollapsedTooltip key={item.href} label={item.label}>
                {link}
              </CollapsedTooltip>
            ) : (
              <React.Fragment key={item.href}>{link}</React.Fragment>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Tooltips only matter when labels are hidden; the CSS hides them otherwise. */
function CollapsedTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  const collapsed = useHtmlData("sidebar") === "collapsed";
  if (!collapsed) return children;
  return (
    <Tooltip content={label} side="right">
      {children}
    </Tooltip>
  );
}

export function Sidebar({
  groups,
  homeHref,
  onToggle,
  footer,
}: {
  groups: NavGroup[];
  homeHref: string;
  onToggle: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-hairline bg-bg px-3 py-4 lg:flex",
        "transition-[width] duration-200 ease-out-soft sidebar-collapsed:w-[68px]",
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-2 px-1.5 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
        <Link
          href={homeHref}
          className="flex items-center gap-2.5 rounded-control"
          aria-label="Grove home"
        >
          <BrandMark />
          <Wordmark className="sidebar-collapsed:sr-only" />
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          className="grid size-8 place-items-center rounded-control text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink sidebar-collapsed:hidden"
        >
          <PanelLeftClose className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList groups={groups} />
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-hairline pt-4">
        {footer}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="mx-auto hidden size-9 place-items-center rounded-control text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink sidebar-collapsed:grid"
        >
          <PanelLeftOpen className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
