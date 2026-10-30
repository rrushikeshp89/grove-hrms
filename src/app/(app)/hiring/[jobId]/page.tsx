import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { EMPLOYMENT_LABELS } from "@/features/people/format";
import { Board, JobActions, RejectedList } from "@/features/recruitment/components/board";
import { JOB_STATUS_META } from "@/features/recruitment/logic/pipeline";
import { jobBoard, mayRecruit, recruitmentOptions } from "@/features/recruitment/queries";
import { can } from "@/lib/rbac";
import { addDays, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Role" };

function BoardSkeleton() {
  return (
    <div className="mt-6 flex gap-3" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-96 flex-1 rounded-card" />
      ))}
    </div>
  );
}

async function Job({ params }: { params: PageProps<"/hiring/[jobId]">["params"] }) {
  const user = await requirePermission("recruitment.read");
  const { jobId } = await params;
  const data = await jobBoard(jobId);
  if (!data) notFound();
  const { job, candidates } = data;
  const actor = actorOf(user);
  const canManage = can(actor, "recruitment.manage");
  const canEdit = mayRecruit(user, job) && job.status !== "CLOSED";
  const canHire = canEdit && can(actor, "employee.create");
  const options = await recruitmentOptions();
  const meta = JOB_STATUS_META[job.status];
  const hired = candidates.filter((c) => c.stage === "HIRED").length;
  const rejected = candidates.filter((c) => c.stage === "REJECTED");
  // Keyed on positions, so a server refresh resets the board's local state.
  const boardKey = candidates.map((c) => `${c.id}:${c.stage}:${c.order}`).join();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/hiring"
            className="mb-2 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> All roles
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display-soft text-display font-medium text-ink">{job.title}</h1>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <p className="mt-1 text-body text-ink-muted">
            {job.department} · {job.location} · {EMPLOYMENT_LABELS[job.employmentType]} · Hiring
            manager {job.hiringManager} · {hired} of {job.openings} filled
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <JobActions
            jobId={job.id}
            closed={job.status === "CLOSED"}
            canManage={canManage}
            canAdd={mayRecruit(user, job)}
            job={job.form}
            options={options}
          />
        </div>
      </header>

      <Board
        key={boardKey}
        data={data}
        canEdit={canEdit}
        canHire={canHire}
        now={new Date().toISOString()}
        suggestedStart={addDays(todayIn(), 14)}
        options={options}
      />
      <RejectedList candidates={rejected} canEdit={canEdit} />

      <Card>
        <CardHeader
          title="About the role"
          description={`Opened ${format(new Date(job.openedAt), "d MMMM yyyy")}`}
        />
        <CardBody className="flex max-w-3xl flex-col gap-3">
          {job.descriptionText.split("\n\n").map((p, i) => (
            <p key={i} className="text-body text-ink-muted">
              {p}
            </p>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

export default function JobPage({ params }: PageProps<"/hiring/[jobId]">) {
  return (
    <PageContainer className="max-w-none">
      <Suspense
        fallback={
          <>
            <Skeleton className="h-10 w-80" />
            <BoardSkeleton />
          </>
        }
      >
        <Job params={params} />
      </Suspense>
    </PageContainer>
  );
}
