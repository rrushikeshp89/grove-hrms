import { BriefcaseBusiness, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/primitives";
import { CardGridSkeleton, EmptyState } from "@/components/ui/states";
import { JobCard } from "@/features/recruitment/components/job-card";
import { NewJobButton } from "@/features/recruitment/components/job-sheet";
import { jobs, recruitmentOptions, type JobView } from "@/features/recruitment/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { can } from "@/lib/rbac";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Hiring" };

const VIEWS: { view: JobView; label: string; status: "OPEN" | "ON_HOLD" | "DRAFT" | "CLOSED" }[] = [
  { view: "open", label: "Open", status: "OPEN" },
  { view: "on_hold", label: "On hold", status: "ON_HOLD" },
  { view: "draft", label: "Drafts", status: "DRAFT" },
  { view: "closed", label: "Closed", status: "CLOSED" },
];

const EMPTY: Record<JobView, { title: string; description: string }> = {
  open: {
    title: "No open roles right now",
    description: "When a team needs someone, open a role and candidates will gather here.",
  },
  on_hold: {
    title: "Nothing's on hold",
    description: "Pause a role from its Edit screen and it waits here, candidates intact.",
  },
  draft: {
    title: "No drafts",
    description: "Save a role as a draft to finish the details before opening it.",
  },
  closed: {
    title: "No closed roles yet",
    description: "Roles close on their own once every opening is filled.",
  },
};

async function Jobs({ searchParams }: { searchParams: PageProps<"/hiring">["searchParams"] }) {
  const user = await requirePermission("recruitment.read");
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.view === sp.view)?.view ?? "open";
  const canManage = can(actorOf(user), "recruitment.manage");
  const [data, options] = await Promise.all([jobs(view), canManage ? recruitmentOptions() : null]);
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <SectionTabs
            label="Roles by status"
            current={view === "open" ? "/hiring" : `/hiring?view=${view}`}
            tabs={VIEWS.map((v) => ({
              href: v.view === "open" ? "/hiring" : `/hiring?view=${v.view}`,
              label: `${v.label} · ${data.counts[v.status] ?? 0}`,
            }))}
          />
        </div>
        {options && <NewJobButton options={options} />}
      </div>
      {data.jobs.length === 0 ? (
        <Card>
          <EmptyState icon={BriefcaseBusiness} satellites={[Users]} {...EMPTY[view]} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.jobs.map((j) => (
            <JobCard key={j.id} job={j} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HiringPage({ searchParams }: PageProps<"/hiring">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Talent"
        title="Hiring"
        description="Every role and where its candidates stand."
      />
      <div className="mt-8">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <Jobs searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
