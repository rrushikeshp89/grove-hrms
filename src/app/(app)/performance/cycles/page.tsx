import { format } from "date-fns";
import { ArrowLeft, Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { NewCycleButton } from "@/features/performance/components/cycle-controls";
import { CYCLE_META } from "@/features/performance/logic/goals";
import { cycles } from "@/features/performance/queries";
import { dbDate } from "@/lib/tz";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Review cycles" };

const pct = (c: { done: number; total: number }) =>
  c.total ? Math.round((c.done / c.total) * 100) : 0;

async function Cycles() {
  await requirePermission("performance.manageCycles");
  const list = await cycles();
  if (list.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Flag}
          title="No review cycles yet"
          description="A cycle gives everyone a self review and every manager a review of their reports."
          action={<NewCycleButton />}
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NewCycleButton />
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((c) => (
          <li key={c.id}>
            <Card className="relative flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-heading font-semibold text-ink">
                    <Link
                      href={`/performance/cycles/${c.id}`}
                      className="after:absolute after:inset-0 after:rounded-card hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </h2>
                  <p className="text-small text-ink-muted">
                    {format(dbDate(c.periodStart), "d MMM")} –{" "}
                    {format(dbDate(c.periodEnd), "d MMM yyyy")}
                  </p>
                </div>
                <Badge
                  tone={
                    c.status === "CLOSED" ? "neutral" : c.status === "DRAFT" ? "warning" : "accent"
                  }
                >
                  {CYCLE_META[c.status].label}
                </Badge>
              </div>
              {c.self.total > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 flex justify-between text-small">
                      <span className="text-ink-muted">Self reviews</span>
                      <span className="num text-ink">
                        {c.self.done}/{c.self.total}
                      </span>
                    </p>
                    <ProgressBar
                      value={pct(c.self)}
                      label={`Self reviews: ${pct(c.self)}% submitted`}
                    />
                  </div>
                  <div>
                    <p className="mb-1 flex justify-between text-small">
                      <span className="text-ink-muted">Manager reviews</span>
                      <span className="num text-ink">
                        {c.manager.done}/{c.manager.total}
                      </span>
                    </p>
                    <ProgressBar
                      value={pct(c.manager)}
                      label={`Manager reviews: ${pct(c.manager)}% submitted`}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-small text-ink-muted">{CYCLE_META[c.status].blurb}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CyclesPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/performance"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Performance
      </Link>
      <PageHeader
        eyebrow="Growth"
        title="Review cycles"
        description="Start a cycle, follow it through, and share results when calibration is done."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={4} columns={3} />}>
          <Cycles />
        </Suspense>
      </div>
    </PageContainer>
  );
}
