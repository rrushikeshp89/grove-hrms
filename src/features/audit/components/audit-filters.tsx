"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { domainLabel, filtersToQuery, type AuditFilters } from "../logic";

const ANY = "any";

/** Filters live in the URL: shareable, and the back button undoes them. */
export function AuditFiltersBar({
  filters,
  options,
  children,
}: {
  filters: AuditFilters;
  options: { actors: { id: string; name: string }[]; domains: string[]; entities: string[] };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [shown, setShown] = React.useOptimistic(filters);
  const [q, setQ] = React.useState(filters.q ?? "");

  function go(next: Partial<AuditFilters>) {
    const merged = { ...filters, ...next };
    startTransition(() => {
      setShown(merged);
      const qs = filtersToQuery(merged);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const active = Object.values(filters).some(Boolean);
  const pick = (v: string) => (v === ANY ? null : v);

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        aria-label="Audit log filters"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() || null });
        }}
        className="grid gap-3 rounded-card border border-hairline bg-surface p-3 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="lg:col-span-2">
          <Input
            type="search"
            aria-label="Search the log"
            placeholder="Search actions, people or IDs"
            leadingIcon={<Search aria-hidden />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={shown.actor ?? ANY} onValueChange={(v) => go({ actor: pick(v) })}>
          <SelectTrigger aria-label="Who">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            {options.actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={shown.domain ?? ANY} onValueChange={(v) => go({ domain: pick(v) })}>
          <SelectTrigger aria-label="Area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Every area</SelectItem>
            {options.domains.map((d) => (
              <SelectItem key={d} value={d}>
                {domainLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="From"
          value={shown.from ?? ""}
          max={shown.to ?? undefined}
          onChange={(e) => go({ from: (e.target.value || null) as AuditFilters["from"] })}
        />
        <Input
          type="date"
          aria-label="To"
          value={shown.to ?? ""}
          min={shown.from ?? undefined}
          onChange={(e) => go({ to: (e.target.value || null) as AuditFilters["to"] })}
        />
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <Select value={shown.entity ?? ANY} onValueChange={(v) => go({ entity: pick(v) })}>
            <SelectTrigger aria-label="Kind of record" className="max-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Every kind of record</SelectItem>
              {options.entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                go({ actor: null, domain: null, entity: null, from: null, to: null, q: null });
              }}
            >
              <X aria-hidden /> Clear filters
            </Button>
          )}
          <span className="sr-only" aria-live="polite">
            {pending ? "Updating results" : ""}
          </span>
        </div>
      </form>
      <div
        aria-busy={pending}
        className={cn(
          "transition-opacity duration-200",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}
