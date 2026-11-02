"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { columnsFor, DataTable } from "@/components/ui/data-table";

import { displayName, STATUS_META } from "../format";
import type { DirectoryRow } from "./people-results";

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

/** Sorting and row navigation need the browser, so only this view hydrates. */
export function PeopleTable({ people }: { people: DirectoryRow[] }) {
  const router = useRouter();
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
