import { format } from "date-fns";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CirclePlay,
  Handshake,
  MessagesSquare,
  Search,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { ProfileSkeleton } from "@/components/ui/states";
import { Timeline } from "@/components/ui/timeline";
import { CandidateActions, Notes, Stars } from "@/features/recruitment/components/candidate-panels";
import { STAGE_META, type Stage } from "@/features/recruitment/logic/pipeline";
import { candidateDetail, mayRecruit, recruitmentOptions } from "@/features/recruitment/queries";
import { can } from "@/lib/rbac";
import { addDays, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Candidate" };

const STAGE_ICON: Record<Stage, LucideIcon> = {
  APPLIED: CirclePlay,
  SCREENING: Search,
  INTERVIEW: MessagesSquare,
  OFFER: Handshake,
  HIRED: BadgeCheck,
  REJECTED: UserX,
};

async function Candidate({ params }: { params: PageProps<"/hiring/candidates/[id]">["params"] }) {
  const user = await requirePermission("recruitment.read");
  const { id } = await params;
  const c = await candidateDetail(id);
  if (!c) notFound();
  const actor = actorOf(user);
  const canEdit = mayRecruit(user, c.job) && c.job.status !== "CLOSED";
  const canHire = canEdit && can(actor, "employee.create");
  const options = canEdit ? await recruitmentOptions() : { managers: [], takenEmails: [] };
  const meta = STAGE_META[c.stage];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/hiring/${c.job.id}`}
        className="inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {c.job.title}
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={c.name} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display-soft text-display font-medium text-ink">{c.name}</h1>
              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            </div>
            <p className="mt-1 text-body text-ink-muted">
              {c.job.title} · {c.job.department}
            </p>
            {c.rating != null && (
              <p className="mt-1">
                <Stars value={c.rating} />
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {c.hiredEmployee ? (
            <Button asChild variant="secondary">
              <Link href={`/people/${c.hiredEmployee.id}`}>
                <CalendarCheck aria-hidden /> Open employee profile
              </Link>
            </Button>
          ) : (
            <CandidateActions
              candidate={c}
              canEdit={canEdit}
              canHire={canHire}
              suggestedStart={addDays(todayIn(), 14)}
              options={options}
            />
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Notes candidateId={c.id} notes={c.notes} canWrite={!!user.employee} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                columns={1}
                className="gap-y-3"
                items={[
                  { term: "Email", detail: c.email },
                  { term: "Phone", detail: c.phone ?? "Not shared" },
                  { term: "Source", detail: c.source },
                  { term: "Applied", detail: format(new Date(c.appliedAt), "d MMMM yyyy") },
                  ...(c.hiredEmployee
                    ? [{ term: "Employee ID", detail: c.hiredEmployee.code, mono: true }]
                    : []),
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Journey" />
            <CardBody>
              <Timeline
                items={[...c.history].reverse().map((e) => ({
                  id: e.id,
                  icon: STAGE_ICON[e.to],
                  tone: STAGE_META[e.to].tone,
                  title: STAGE_META[e.to].label,
                  body: e.by ?? undefined,
                  at: e.at,
                  atLabel: format(new Date(e.at), "d MMM"),
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CandidatePage({ params }: PageProps<"/hiring/candidates/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<ProfileSkeleton />}>
        <Candidate params={params} />
      </Suspense>
    </PageContainer>
  );
}
