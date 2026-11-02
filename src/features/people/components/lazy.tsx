"use client";

import dynamic from "next/dynamic";

import { TableSkeleton } from "@/components/ui/states";

// next/dynamic only splits a client component off when it's called from a client
// module. Both skip server rendering: with it, these wait on hydration and don't
// respond to clicks until they catch up.

/** HR only, and it brings the whole forms stack. */
export const AddEmployeeSheet = dynamic(
  () => import("./add-employee-sheet").then((m) => m.AddEmployeeSheet),
  { ssr: false },
);

/** Sorting needs TanStack Table, which only this view should pay for. */
export const PeopleTable = dynamic(() => import("./people-table").then((m) => m.PeopleTable), {
  ssr: false,
  loading: () => <TableSkeleton />,
});
