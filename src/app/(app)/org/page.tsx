import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/primitives";
import { OrgChart } from "@/features/org/components/org-chart";
import { getOrgNodes } from "@/features/people/queries";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Org chart" };

async function Chart({ searchParams }: { searchParams: PageProps<"/org">["searchParams"] }) {
  await requireUser();
  const [rows, sp] = await Promise.all([getOrgNodes(), searchParams]);
  const focus = typeof sp.focus === "string" ? sp.focus : null;
  return <OrgChart rows={rows} focusId={focus} />;
}

function ChartSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center gap-16 pt-24" aria-busy>
      <span className="sr-only">Loading the org chart</span>
      <Skeleton className="h-[76px] w-[228px] rounded-card" />
      <div className="flex gap-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[76px] w-[228px] rounded-card" />
        ))}
      </div>
    </div>
  );
}

/** The chart fills the space under the top bar; it has its own pan and zoom. */
export default function OrgPage({ searchParams }: PageProps<"/org">) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <h1 className="sr-only">Org chart</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <Chart searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
