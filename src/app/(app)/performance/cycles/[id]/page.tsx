import { format } from "date-fns";
import { ArrowLeft, Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { RatingDisplay } from "@/components/ui/rating";
import {
  AdvanceCycleButton,
  RequestFeedback,
} from "@/features/performance/components/cycle-controls";
import { CYCLE_META, CYCLE_STEPS, canWriteReview } from "@/features/performance/logic/goals";
import { colleagues, cycleOverview, type OverviewRow } from "@/features/performance/queries";
import { scopeFor } from "@/lib/rbac";
import { dbDate } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review cycle" };

function ReviewCell({
  review,
}: {
  review?: { id: string; status: string; rating: number | null };
}) {
  if (!review) return <Minus className="size-4 text-ink-subtle" aria-label="Not applicable" />;
  if (review.status === "SUBMITTED")
    return (
      <span className="inline-flex items-center gap-1.5 text-small text-success">
        <Check className="size-3.5" aria-hidden />
        {review.rating ? <RatingDisplay value={review.rating} /> : "Submitted"}
      </span>
    );
  return (
    <span className="text-small text-ink-muted">
      {review.status === "IN_PROGRESS" ? "Draft" : "Not started"}
    </span>
  );
}

async function Cycle({ params }: { params: PageProps<"/performance/cycles/[id]">["params"] }) {
  const user = await requirePermission("performance.read");
  const scope = scopeFor(actorOf(user), "performance.read");
  if (scope !== "team" && scope !== "all") forbidden();
  const { id } = await params;
  const cycle = await cycleOverview(user, id);
  if (!cycle) notFound();
  const peers = cycle.rows.length && canWriteReview("PEER", cycle.status) ? await colleagues() : [];
  const stepIndex = CYCLE_STEPS.indexOf(cycle.status);
  const done = (k: "self" | "manager") =>
    cycle.rows.filter((r: OverviewRow) => r[k]?.status === "SUBMITTED").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={cycle.manageCycle ? "/performance/cycles" : "/performance"}
        className="inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />{" "}
        {cycle.manageCycle ? "Review cycles" : "Performance"}
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            {format(dbDate(cycle.periodStart), "d MMM")} –{" "}
            {format(dbDate(cycle.periodEnd), "d MMM yyyy")}
          </p>
          <h1 className="font-display-soft text-display font-medium text-ink">{cycle.name}</h1>
          <p className="mt-1 text-body text-ink-muted">{CYCLE_META[cycle.status].blurb}</p>
        </div>
        {cycle.manageCycle && (
          <div className="shrink-0">
            <AdvanceCycleButton cycleId={cycle.id} status={cycle.status} />
          </div>
        )}
      </header>

      <ol aria-label="Cycle progress" className="grid gap-2 sm:grid-cols-5">
        {CYCLE_STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === stepIndex ? "step" : undefined}
            className={cn(
              "rounded-control border px-3 py-2 text-small",
              i < stepIndex && "border-hairline bg-surface-sunken text-ink-muted",
              i === stepIndex && "border-accent bg-accent-subtle font-medium text-ink",
              i > stepIndex && "border-hairline text-ink-subtle",
            )}
          >
            <span className="mr-1.5 num text-caption">{i + 1}</span>
            {CYCLE_META[s].label}
          </li>
        ))}
      </ol>

      {cycle.ratings && (
        <Card>
          <CardHeader
            title="Rating spread"
            description="How ratings fall across the company, for calibration"
          />
          <CardBody className="grid gap-6 sm:grid-cols-2">
            {(
              [
                ["Self ratings", cycle.ratings.self],
                ["Manager ratings", cycle.ratings.manager],
              ] as const
            ).map(([label, summary]) => {
              const max = Math.max(1, ...summary.counts);
              return (
                <div key={label}>
                  <p className="mb-3 flex items-baseline justify-between text-small">
                    <span className="eyebrow">{label}</span>
                    <span className="text-ink-muted">
                      {summary.count} rated
                      {summary.average != null && ` · average ${summary.average}`}
                    </span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <li
                        key={star}
                        className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-2 text-small"
                      >
                        <span className="num text-ink-muted">{star}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(summary.counts[star - 1]! / max) * 100}%` }}
                          />
                        </span>
                        <span className="text-right num text-ink">{summary.counts[star - 1]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title={scope === "all" ? "Everyone" : "Your team"}
          description={`${done("self")} of ${cycle.rows.length} self reviews · ${done("manager")} manager reviews submitted`}
        />
        <div
          className="mt-3 max-h-[36rem] overflow-auto border-t border-hairline"
          tabIndex={0}
          role="region"
          aria-label="Reviews in this cycle"
        >
          <table className="w-full min-w-[40rem] text-left text-body">
            <caption className="sr-only">Reviews in this cycle</caption>
            <thead className="sticky top-0 bg-surface-sunken text-caption text-ink-muted">
              <tr>
                <th scope="col" className="h-10 px-5 font-medium">
                  Person
                </th>
                <th scope="col" className="px-3 font-medium">
                  Self review
                </th>
                <th scope="col" className="px-3 font-medium">
                  Manager review
                </th>
                <th scope="col" className="px-3 font-medium">
                  Peer feedback
                </th>
                <th scope="col" className="px-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cycle.rows.map((r) => {
                const peersDone = r.peers.filter((p) => p.status === "SUBMITTED").length;
                return (
                  <tr key={r.id} className="border-t border-hairline">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-3">
                        <Avatar name={r.person.name} src={r.person.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {r.person.name}
                          </span>
                          <span className="block truncate text-small text-ink-muted">
                            {r.person.department}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="px-3">
                      {r.self?.status === "SUBMITTED" && cycle.status !== "SELF_REVIEW" ? (
                        <Link
                          href={`/performance/reviews/${r.self.id}`}
                          className="hover:underline"
                        >
                          <ReviewCell review={r.self} />
                        </Link>
                      ) : (
                        <ReviewCell review={r.self} />
                      )}
                    </td>
                    <td className="px-3">
                      {r.manager &&
                      r.manager.status === "SUBMITTED" &&
                      cycle.manageCycle &&
                      (cycle.status === "CALIBRATION" || cycle.status === "CLOSED") ? (
                        <Link
                          href={`/performance/reviews/${r.manager.id}`}
                          className="hover:underline"
                        >
                          <ReviewCell review={r.manager} />
                        </Link>
                      ) : (
                        <ReviewCell
                          review={
                            r.manager ? { ...r.manager, rating: r.manager.rating } : undefined
                          }
                        />
                      )}
                    </td>
                    <td className="px-3">
                      {r.peers.length === 0 ? (
                        <span className="text-small text-ink-subtle">None asked</span>
                      ) : (
                        <Badge tone={peersDone === r.peers.length ? "success" : "neutral"}>
                          {peersDone} of {r.peers.length}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 text-right">
                      {peers.length > 0 && (
                        <RequestFeedback
                          cycleId={cycle.id}
                          reviewee={{ id: r.id, name: r.person.name }}
                          peers={peers}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {cycle.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-ink-muted">
                    {cycle.status === "DRAFT"
                      ? "Reviews are created when the cycle starts."
                      : "No one to show here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function CyclePage({ params }: PageProps<"/performance/cycles/[id]">) {
  return (
    <PageContainer className="max-w-6xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Cycle params={params} />
      </Suspense>
    </PageContainer>
  );
}
