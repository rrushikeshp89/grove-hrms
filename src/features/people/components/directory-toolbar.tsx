"use client";

import { LayoutGrid, Search, Table2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { activeFilterCount, serializeFilters, STATUSES, type DirectoryFilters } from "../filters";
import { EMPLOYMENT_LABELS, STATUS_META } from "../format";

type Options = {
  departments: { code: string; name: string; count: number }[];
  locations: { id: string; name: string }[];
  canSeeFormer: boolean;
};

const ALL = "__all";

const DirectoryTransition = React.createContext<{
  pending: boolean;
  start: React.TransitionStartFunction;
}>({
  pending: false,
  start: (fn) => fn(),
});

/** Shares one transition between the toolbar and the results it updates. */
export function DirectoryTransitionProvider({ children }: { children: React.ReactNode }) {
  const [pending, start] = React.useTransition();
  return (
    <DirectoryTransition.Provider value={{ pending, start }}>
      {children}
    </DirectoryTransition.Provider>
  );
}

export function DirectoryPending({ children }: { children: React.ReactNode }) {
  const { pending } = React.useContext(DirectoryTransition);
  return (
    <div
      aria-busy={pending}
      className={cn("transition-opacity duration-200", pending && "opacity-60")}
    >
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger
        aria-label={label}
        className={cn("h-9 w-auto min-w-36", value && "border-accent/50 text-ink", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: all</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DirectoryToolbar({
  filters,
  options,
  shown,
}: {
  filters: DirectoryFilters;
  options: Options;
  shown: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { start } = React.useContext(DirectoryTransition);
  const [q, setQ] = React.useState(filters.q);
  // Back/forward or "clear" can change the URL under us; follow it.
  const [seenQ, setSeenQ] = React.useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    if (filters.q !== q.trim()) setQ(filters.q);
  }
  const latest = React.useRef(filters);
  React.useEffect(() => {
    latest.current = filters;
  }, [filters]);

  const push = React.useCallback(
    (patch: Partial<DirectoryFilters>) => {
      const query = serializeFilters({ ...latest.current, ...patch });
      start(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router, start],
  );

  // Debounce typing so every keystroke doesn't hit the server.
  React.useEffect(() => {
    if (q.trim() === latest.current.q) return;
    const t = setTimeout(() => push({ q }), 250);
    return () => clearTimeout(t);
  }, [q, push]);

  const count = activeFilterCount(filters);
  const statuses = STATUSES.filter((s) => s !== "EXITED" || options.canSeeFormer);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          aria-label="Search people"
          leadingIcon={<Search />}
          placeholder="Search by name, role, team, skill or ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.stopPropagation();
              setQ("");
            }
          }}
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Department"
            value={filters.department}
            onChange={(department) => push({ department })}
            options={options.departments.map((d) => ({
              value: d.code,
              label: `${d.name} · ${d.count}`,
            }))}
          />
          <FilterSelect
            label="Location"
            value={filters.location}
            onChange={(location) => push({ location })}
            options={options.locations.map((l) => ({ value: l.id, label: l.name }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(status) => push({ status: status as DirectoryFilters["status"] })}
            options={statuses.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          />
          <FilterSelect
            label="Type"
            value={filters.type}
            onChange={(type) => push({ type: type as DirectoryFilters["type"] })}
            options={Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => push({ department: null, location: null, status: null, type: null })}
            >
              <X aria-hidden /> Clear {count === 1 ? "filter" : `${count} filters`}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-ink-muted" aria-live="polite">
          <span className="num font-medium text-ink">{shown}</span>{" "}
          {shown === 1 ? "person" : "people"}
          {filters.q && (
            <>
              {" "}
              matching <span className="font-medium text-ink">&ldquo;{filters.q}&rdquo;</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={filters.sort}
            onValueChange={(v) => push({ sort: v as DirectoryFilters["sort"] })}
          >
            <SelectTrigger
              aria-label="Sort by"
              className="h-8 w-auto gap-1.5 border-transparent bg-transparent text-small hover:border-hairline"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="name">Name, A to Z</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="joined-desc">Newest joiners</SelectItem>
              <SelectItem value="joined-asc">Longest tenure</SelectItem>
            </SelectContent>
          </Select>
          <SegmentedControl
            aria-label="View"
            size="sm"
            value={filters.view}
            onValueChange={(view) => push({ view })}
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid aria-hidden /> },
              { value: "table", label: "Table", icon: <Table2 aria-hidden /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
