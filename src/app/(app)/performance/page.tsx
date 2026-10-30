import { format } from "date-fns";
import { ArrowRight, Flag, Sprout, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { CardGridSkeleton, EmptyState } from "@/components/ui/states";
import { GoalCard } from "@/features/performance/components/goal-card";
import { NewGoalButton } from "@/features/performance/components/goal-sheet";
import { Results, ReviewTasks } from "@/features/performance/components/reviews";
import { CYCLE_META } from "@/features/performance/logic/goals";
import {
  goalsFor,
  myReviewTasks,
  parentOptions,
  resultsAboutMe,
  runningCycle,
  type GoalView,
} from "@/features/performance/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { can, scopeFor } from "@/lib/rbac";
import { dbDate, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Performance" };

const EMPTY: Record<GoalView, { title: string; description: string }> = {
  mine: {
    title: "No goals yet",
    description:
      "Pick one thing you want to change this quarter and write it down. Key results make it measurable.",
  },
  team: {
    title: "Your team hasn't set goals",
    description: "Goals your reports create appear here, so you can see where everyone's headed.",
  },
  company: {
    title: "No company goals",
    description:
      "The people team sets company-wide goals. Team and personal goals can line up behind them.",
  },
};

async function Performance({
  searchParams,
}: {
  searchParams: PageProps<"/performance">["searchParams"];
}) {
  const user = await requirePermission("performance.read");
  const sp = await searchParams;
  const actor = actorOf(user);
  const scope = scopeFor(actor, "performance.read");
  const hasTeam = scope === "team" || scope === "all";
  const requested = typeof sp.view === "string" ? sp.view : "mine";
  const view =
    (["mine", "team", "company", "reviews"] as const).find(
      (v) => v === requested && (v !== "team" || hasTeam),
    ) ?? "mine";
  const today = todayIn();

  const [cycle, tasks] = await Promise.all([runningCycle(), myReviewTasks(user)]);
  const open = tasks.filter((t) => t.status !== "SUBMITTED" && t.writable).length;
  const tabs = [
    { href: "/performance", label: "My goals" },
    ...(hasTeam ? [{ href: "/performance?view=team", label: "Team" }] : []),
    { href: "/performance?view=company", label: "Company" },
    { href: "/performance?view=reviews", label: open ? `Reviews · ${open}` : "Reviews" },
  ];
  const current = view === "mine" ? "/performance" : `/performance?view=${view}`;

  return (
    <div className="flex flex-col gap-6">
      {cycle && (
        <Card className="flex flex-col gap-3 border-accent/30 bg-accent-subtle/50 p-5 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
            <Flag className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-ink">
              {cycle.name} is in {CYCLE_META[cycle.status].label.toLowerCase()}
            </p>
            <p className="text-small text-ink-muted">
              {CYCLE_META[cycle.status].blurb}
              {cycle.status === "SELF_REVIEW" &&
                cycle.selfReviewDue &&
                ` Due ${format(dbDate(cycle.selfReviewDue), "d MMM")}.`}
              {cycle.status === "MANAGER_REVIEW" &&
                cycle.managerReviewDue &&
                ` Due ${format(dbDate(cycle.managerReviewDue), "d MMM")}.`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {hasTeam && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/performance/cycles/${cycle.id}`}>
                  {scope === "all" ? "Cycle overview" : "Your team's reviews"}{" "}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            )}
            {open > 0 && view !== "reviews" && (
              <Button asChild size="sm">
                <Link href="/performance?view=reviews">Write reviews · {open}</Link>
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-48 flex-1">
          <SectionTabs label="Performance" tabs={tabs} current={current} />
        </div>
        {can(actor, "performance.manageCycles") && (
          <Button asChild variant="ghost">
            <Link href="/performance/cycles">Review cycles</Link>
          </Button>
        )}
      </div>

      {view === "reviews" ? (
        <div className="flex flex-col gap-6">
          <ReviewTasks tasks={tasks} />
          <Results results={await resultsAboutMe(user)} />
        </div>
      ) : (
        <Goals
          view={view}
          user={user}
          today={today}
          canSetCompany={can(actor, "performance.manageCycles")}
        />
      )}
    </div>
  );
}

async function Goals({
  view,
  user,
  today,
  canSetCompany,
}: {
  view: GoalView;
  user: Awaited<ReturnType<typeof requirePermission>>;
  today: string;
  canSetCompany: boolean;
}) {
  const [goals, parents] = await Promise.all([goalsFor(user, view), parentOptions(user)]);
  // Goals whose period has ended sit apart, so the page leads with what's live.
  const current = goals.filter((g) => !g.dueDate || g.dueDate >= today);
  const earlier = goals.filter((g) => g.dueDate && g.dueDate < today);
  return (
    <div className="flex flex-col gap-4">
      {(view === "mine" || (view === "company" && canSetCompany)) && user.employee && (
        <div className="flex justify-end">
          <NewGoalButton
            parents={parents}
            today={today}
            canSetCompany={canSetCompany && view === "company"}
          />
        </div>
      )}
      {goals.length === 0 ? (
        <Card>
          <EmptyState icon={Target} satellites={[Sprout]} {...EMPTY[view]} />
        </Card>
      ) : (
        <>
          {current.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {current.map((g) => (
                <GoalCard key={g.id} goal={g} showOwner={view === "team"} />
              ))}
            </ul>
          )}
          {earlier.length > 0 && (
            <section aria-labelledby="earlier" className="mt-2 flex flex-col gap-3">
              <h2 id="earlier" className="text-heading font-semibold text-ink">
                Earlier cycles · {earlier.length}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {earlier.map((g) => (
                  <GoalCard key={g.id} goal={g} showOwner={view === "team"} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function PerformancePage({ searchParams }: PageProps<"/performance">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Growth"
        title="Performance"
        description="Goals and key results, review cycles, and what your colleagues think."
      />
      <div className="mt-8">
        <Suspense fallback={<CardGridSkeleton count={6} />}>
          <Performance searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
