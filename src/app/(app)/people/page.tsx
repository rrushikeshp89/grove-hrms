import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { CardGridSkeleton } from "@/components/ui/states";
import { AddEmployeeSheet } from "@/features/people/components/add-employee-sheet";
import {
  DirectoryPending,
  DirectoryToolbar,
  DirectoryTransitionProvider,
} from "@/features/people/components/directory-toolbar";
import { PeopleResults } from "@/features/people/components/people-results";
import { activeFilterCount, parseFilters } from "@/features/people/filters";
import { getDirectoryOptions, getJobOptions, listPeople } from "@/features/people/queries";
import { can } from "@/lib/rbac";
import { actorOf, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "People" };

async function Directory({ searchParams }: { searchParams: PageProps<"/people">["searchParams"] }) {
  const user = await requireUser();
  const filters = parseFilters(await searchParams);
  const canAdd = can(actorOf(user), "employee.create");
  const [{ people, total }, options, jobOptions] = await Promise.all([
    listPeople(user, filters),
    getDirectoryOptions(user),
    canAdd ? getJobOptions() : null,
  ]);

  return (
    <DirectoryTransitionProvider>
      <PageHeader
        eyebrow="Organization"
        title="People"
        description={`${total} people at Northwind Grove. Search by name, team, skill or employee ID.`}
        actions={jobOptions && <AddEmployeeSheet options={jobOptions} />}
      />
      <div className="mt-8 flex flex-col gap-5">
        <DirectoryToolbar filters={filters} options={options} shown={people.length} />
        <DirectoryPending>
          <PeopleResults
            people={people.map((p) => ({ ...p, joinDate: p.joinDate.toISOString() }))}
            view={filters.view}
            query={filters.q}
            filtered={activeFilterCount(filters) > 0}
          />
        </DirectoryPending>
      </div>
    </DirectoryTransitionProvider>
  );
}

function DirectorySkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <span className="sr-only">Loading the directory</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-sm rounded-control" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-36 rounded-control" />
        ))}
      </div>
      <CardGridSkeleton count={10} />
    </div>
  );
}

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <PageContainer className="max-w-7xl">
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
