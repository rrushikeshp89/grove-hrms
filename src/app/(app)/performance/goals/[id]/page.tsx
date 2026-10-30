import { format } from "date-fns";
import { ArrowLeft, CirclePlus, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { ProfileSkeleton } from "@/components/ui/states";
import { Timeline } from "@/components/ui/timeline";
import { CheckInDialog, GoalOwnerActions } from "@/features/performance/components/check-in";
import { GoalCard } from "@/features/performance/components/goal-card";
import { GOAL_STATUS_META, formatValue } from "@/features/performance/logic/goals";
import { goalDetail, parentOptions } from "@/features/performance/queries";
import { can } from "@/lib/rbac";
import { dbDate, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Goal" };

async function Goal({ params }: { params: PageProps<"/performance/goals/[id]">["params"] }) {
  const user = await requirePermission("performance.read");
  const { id } = await params;
  const goal = await goalDetail(user, id);
  if (!goal) notFound();
  const today = todayIn();
  const meta = GOAL_STATUS_META[goal.status];
  const parents = goal.canEdit ? await parentOptions(user) : [];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/performance"
        className="inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Performance
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display-soft text-display font-medium text-ink">{goal.title}</h1>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink-muted">
            {goal.owner ? (
              <span className="inline-flex items-center gap-2">
                <Avatar name={goal.owner.name} src={goal.owner.avatarUrl} size="xs" />{" "}
                {goal.owner.name}
              </span>
            ) : (
              <span>Company goal</span>
            )}
            {goal.dueDate && <span>Due {format(dbDate(goal.dueDate), "d MMMM yyyy")}</span>}
            {goal.cycle && <span>{goal.cycle}</span>}
          </p>
          {goal.parent && (
            <p className="mt-1 flex items-center gap-1 text-small text-ink-muted">
              <Target className="size-3.5" aria-hidden /> Supports{" "}
              <Link
                href={`/performance/goals/${goal.parent.id}`}
                className="text-accent hover:underline"
              >
                {goal.parent.title}
              </Link>
            </p>
          )}
          {goal.description && (
            <p className="mt-3 max-w-2xl text-body text-ink-muted">{goal.description}</p>
          )}
        </div>
        {goal.canEdit && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <GoalOwnerActions
              goal={goal}
              parents={parents}
              today={today}
              canSetCompany={can(actorOf(user), "performance.manageCycles")}
            />
            {goal.status !== "DONE" && <CheckInDialog goal={goal} today={today} />}
          </div>
        )}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Key results"
              description={goal.keyResults.length ? undefined : "This goal is tracked by check-ins"}
            />
            <CardBody className="flex items-center gap-5 border-b border-hairline">
              <ProgressRing
                value={goal.progress}
                size={72}
                stroke={7}
                tone={goal.status === "DONE" ? "success" : "accent"}
                label={`Overall progress: ${goal.progress}%`}
              >
                <span className="num text-body font-semibold text-ink">{goal.progress}%</span>
              </ProgressRing>
              <p className="text-body text-ink-muted">
                {goal.status === "DONE"
                  ? "Complete."
                  : goal.keyResults.length
                    ? `${goal.keyResultsDone} of ${goal.keyResults.length} key results done.`
                    : "Updated whenever you check in."}
              </p>
            </CardBody>
            {goal.keyResults.length > 0 && (
              <ul className="px-5 py-1">
                {goal.keyResults.map((k) => (
                  <li key={k.id} className="border-b border-hairline py-3.5 last:border-0">
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-body">
                      <span className="text-ink">{k.title}</span>
                      <span className="num text-small text-ink-muted">
                        {formatValue(k.currentValue, k.unit)}{" "}
                        <span className="text-ink-subtle">
                          of {formatValue(k.targetValue, k.unit)}
                        </span>
                      </span>
                    </div>
                    <ProgressBar
                      value={k.percent}
                      tone={k.percent >= 100 ? "success" : "accent"}
                      label={`${k.title}: ${k.percent}%`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {goal.aligned.length > 0 && (
            <section aria-labelledby="aligned" className="flex flex-col gap-3">
              <h2 id="aligned" className="text-heading font-semibold text-ink">
                Aligned goals · {goal.aligned.length}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {goal.aligned.map((g) => (
                  <GoalCard key={g.id} goal={g} showOwner />
                ))}
              </ul>
            </section>
          )}
        </div>

        <Card>
          <CardHeader title="Check-ins" description="What's changed, newest first" />
          <CardBody>
            {goal.checkIns.length === 0 ? (
              <p className="text-body text-ink-muted">No check-ins yet.</p>
            ) : (
              <Timeline
                items={goal.checkIns.map((c) => ({
                  id: c.id,
                  icon: CirclePlus,
                  tone: "accent",
                  title: `${c.progress}%`,
                  body: c.note,
                  at: c.createdAt,
                  atLabel: format(new Date(c.createdAt), "d MMM"),
                }))}
              />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function GoalPage({ params }: PageProps<"/performance/goals/[id]">) {
  return (
    <PageContainer>
      <Suspense fallback={<ProfileSkeleton />}>
        <Goal params={params} />
      </Suspense>
    </PageContainer>
  );
}
