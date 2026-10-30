"use client";

import { format } from "date-fns";
import { MapPin, SearchX, UserRoundSearch, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { columnsFor, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { gentle } from "@/lib/motion";

import type { DirectoryPerson } from "../queries";
import { displayName, STATUS_META } from "../format";

export type DirectoryRow = Omit<DirectoryPerson, "joinDate"> & { joinDate: string };

const col = columnsFor<DirectoryRow>();
const columns = col.columns([
  col.accessor((p) => displayName(p), {
    id: "name",
    header: "Person",
    sortFn: "text",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar name={displayName(row.original)} src={row.original.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{displayName(row.original)}</p>
          <p className="truncate text-caption text-ink-subtle compact:hidden">
            {row.original.designation.title}
          </p>
        </div>
      </div>
    ),
  }),
  col.accessor("employeeCode", {
    header: "ID",
    cell: (info) => <span className="font-mono text-small text-ink-muted">{info.getValue()}</span>,
  }),
  col.accessor((p) => p.department.name, {
    id: "department",
    header: "Department",
    sortFn: "text",
  }),
  col.accessor((p) => p.location.name, { id: "location", header: "Location", sortFn: "text" }),
  col.accessor((p) => (p.manager ? displayName(p.manager) : ""), {
    id: "manager",
    header: "Manager",
    sortFn: "text",
    cell: (info) => <span className="text-ink-muted">{info.getValue() || "—"}</span>,
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = STATUS_META[info.getValue()];
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  }),
  col.accessor("joinDate", {
    header: "Joined",
    sortFn: "alphanumeric",
    cell: (info) => (
      <span className="text-ink-muted">{format(new Date(info.getValue()), "d MMM yyyy")}</span>
    ),
  }),
]);

function PersonCard({ person }: { person: DirectoryRow }) {
  const status = STATUS_META[person.status];
  const name = displayName(person);
  return (
    <Link
      href={`/people/${person.id}`}
      className="group block h-full rounded-card focus-visible:outline-offset-4"
      aria-label={`${name}, ${person.designation.title}`}
    >
      <Card
        interactive
        className="flex h-full flex-col items-center gap-3 px-4 pt-6 pb-5 text-center"
      >
        <Avatar name={name} src={person.avatarUrl} size="lg" />
        <div className="w-full min-w-0">
          <p className="truncate text-body font-semibold text-ink group-hover:text-accent">
            {name}
          </p>
          <p className="truncate text-small text-ink-muted">{person.designation.title}</p>
        </div>
        <p className="flex max-w-full items-center gap-1 text-caption text-ink-subtle">
          <span className="min-w-0 truncate">{person.department.name}</span>
          <span aria-hidden>·</span>
          <MapPin className="size-3 shrink-0" aria-hidden />
          {person.location.isRemote ? "Remote" : "Bengaluru"}
        </p>
        {person.status !== "ACTIVE" && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
      </Card>
    </Link>
  );
}

export function PeopleResults({
  people,
  view,
  query,
  filtered,
}: {
  people: DirectoryRow[];
  view: "grid" | "table";
  query: string;
  filtered: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();

  if (people.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={query ? SearchX : UserRoundSearch}
          satellites={[Users]}
          title={query ? `No one matches “${query}”` : "No one fits those filters"}
          description={
            query
              ? "Try a first name, a team like “design”, a skill like “Kubernetes”, or an ID like GRV-0042."
              : filtered
                ? "Loosen a filter or clear them to see everyone."
                : "There's no one in the directory yet."
          }
        />
      </Card>
    );
  }

  if (view === "table") {
    return (
      <DataTable
        caption="People directory"
        columns={columns}
        data={people}
        getRowId={(p) => p.id}
        onRowClick={(p) => router.push(`/people/${p.id}`)}
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <AnimatePresence initial={false} mode="popLayout">
        {people.map((p) => (
          <motion.li
            key={p.id}
            layout={!reduce}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={gentle}
          >
            <PersonCard person={p} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
