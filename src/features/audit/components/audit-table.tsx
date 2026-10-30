"use client";

import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";
import { describeAction, diffJson, domainLabel, domainOf, entityHref } from "../logic";
import { describeUserAgent, displayIp } from "@/lib/user-agent";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import type { AuditEntry } from "../queries";

const TONE: Record<string, "neutral" | "accent" | "warning" | "danger" | "info" | "success"> = {
  auth: "neutral",
  payroll: "warning",
  role: "danger",
  settings: "danger",
  employee: "accent",
  document: "info",
};

function Diff({ entry }: { entry: AuditEntry }) {
  const rows = diffJson(entry.before, entry.after);
  const ua = entry.userAgent ? describeUserAgent(entry.userAgent).label : null;
  return (
    <div className="flex flex-col gap-4 px-5 pb-5 sm:pl-16">
      {rows.length === 0 ? (
        <p className="text-small text-ink-muted">This entry didn&apos;t record any values.</p>
      ) : (
        <table className="w-full text-left text-small">
          <caption className="sr-only">What changed</caption>
          <thead className="text-caption text-ink-subtle">
            <tr>
              <th scope="col" className="h-8 w-1/4 font-medium">
                Field
              </th>
              <th scope="col" className="w-[37%] font-medium">
                Before
              </th>
              <th scope="col" className="font-medium">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-hairline align-top">
                <th scope="row" className="py-2 pr-3 font-mono font-normal text-ink-muted">
                  {r.key}
                </th>
                <td className="py-1.5 pr-3">
                  {r.before !== null && (
                    <span
                      className={cn(
                        "inline-block rounded-xs px-1.5 py-0.5 break-words",
                        r.change === "same" ? "text-ink-muted" : "bg-danger-subtle text-danger",
                      )}
                    >
                      {r.before}
                    </span>
                  )}
                </td>
                <td className="py-1.5">
                  {r.after !== null && (
                    <span
                      className={cn(
                        "inline-block rounded-xs px-1.5 py-0.5 break-words",
                        r.change === "same" ? "text-ink-muted" : "bg-success-subtle text-success",
                      )}
                    >
                      {r.after}
                    </span>
                  )}
                  {r.change !== "same" && <span className="sr-only"> ({r.change})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="font-mono text-caption text-ink-subtle">
        {entry.entityType} · {entry.entityId}
        {entry.ip && ` · ${displayIp(entry.ip)}`}
        {ua && ` · ${ua}`}
      </p>
    </div>
  );
}

/** One row per entry; opening it shows exactly what changed. */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const mounted = useMounted();
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <ol className="divide-y divide-hairline">
      {entries.map((e) => {
        const isOpen = open.has(e.id);
        const domain = domainOf(e.action);
        const href = entityHref(e.entityType, e.entityId);
        const at = new Date(e.createdAt);
        return (
          <li key={e.id}>
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`audit-${e.id}`}
                onClick={() => toggle(e.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-hover"
              >
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-ink-subtle transition-transform",
                    isOpen && "rotate-90",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-ink">
                    {describeAction(e.action)}
                  </span>
                  <span className="block truncate text-small text-ink-muted">
                    {e.actor
                      ? `${e.actor.name} · ${ROLE_LABELS[e.actor.role as keyof typeof ROLE_LABELS] ?? e.actor.role}`
                      : "The system"}
                  </span>
                </span>
                <Badge tone={TONE[domain] ?? "neutral"} className="hidden sm:inline-flex">
                  {domainLabel(domain)}
                </Badge>
                <time
                  dateTime={e.createdAt}
                  className="w-36 shrink-0 text-right num text-small text-ink-muted"
                >
                  {mounted ? format(at, "d MMM yyyy, HH:mm") : ""}
                </time>
              </button>
            </h3>
            {isOpen && (
              <div id={`audit-${e.id}`}>
                <Diff entry={e} />
                {href && (
                  <p className="px-5 pb-4 sm:pl-16">
                    <Link
                      href={href}
                      className="text-small font-medium text-accent hover:underline"
                    >
                      Open the record
                    </Link>
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
