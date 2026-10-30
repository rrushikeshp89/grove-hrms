import { ArrowDownRight, ArrowLeft, ArrowUpRight, UserMinus, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { RUN_STATUS } from "@/features/payroll/format";
import { MoneyStat } from "@/features/payroll/components/money-stat";
import { RunActions } from "@/features/payroll/components/run-actions";
import { RunTable } from "@/features/payroll/components/run-table";
import { SimulatedBadge } from "@/features/payroll/components/simulated";
import { runDetail } from "@/features/payroll/queries";
import { formatMoney, formatPercent } from "@/lib/format";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Pay run" };

const money = (n: number) => formatMoney(n, "INR", { compact: true });

async function Run({ params }: { params: PageProps<"/payroll/[id]">["params"] }) {
  const user = await requirePermission("payroll.run");
  const { id } = await params;
  const run = await runDetail(id);
  if (!run) notFound();
  const meta = RUN_STATUS[run.status];
  const { totals, diff } = run;
  const netChange = totals.netMinor - totals.previousNetMinor;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/payroll"
          className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Pay runs
        </Link>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display-soft text-display font-medium text-ink">{run.label}</h1>
              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
              <SimulatedBadge />
            </div>
            <p className="mt-1 text-body text-ink-muted">
              {run.status === "FINALIZED"
                ? "Final. Payslips are visible to everyone in this run."
                : run.status === "IN_REVIEW"
                  ? "Waiting for someone other than the preparer to check and finalize."
                  : "A draft. Check the changes below, then send it for review."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <RunActions
              runId={run.id}
              status={run.status}
              label={run.label}
              mine={run.createdById === user.employee?.id}
            />
          </div>
        </header>
      </div>

      <Card className="grid gap-6 p-6 sm:grid-cols-4">
        <Stat label="People paid" value={totals.headcount} />
        <MoneyStat label="Gross" minor={totals.grossMinor} />
        <MoneyStat label="Net pay" minor={totals.netMinor} />
        <Stat label="With loss of pay" value={run.lopPeople} suffix="people" />
      </Card>

      <Card>
        <CardHeader
          title={`Compared with ${run.previousLabel}`}
          description={
            run.hasPrevious
              ? `Net pay ${netChange === 0 ? "is unchanged" : `${netChange > 0 ? "up" : "down"} ${money(Math.abs(netChange))}`}. Look at what moved, not at every row.`
              : "There's no earlier run to compare with."
          }
        />
        {run.hasPrevious && (
          <CardBody className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 eyebrow">
                <UserPlus className="size-3.5" aria-hidden /> New this month · {diff.joined.length}
              </p>
              {diff.joined.length === 0 ? (
                <p className="text-small text-ink-muted">No new joiners.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-body text-ink">
                  {diff.joined.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              )}
              <p className="mt-5 mb-2 inline-flex items-center gap-1.5 eyebrow">
                <UserMinus className="size-3.5" aria-hidden /> Left · {diff.left.length}
              </p>
              {diff.left.length === 0 ? (
                <p className="text-small text-ink-muted">No one left.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-body text-ink">
                  {diff.left.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="lg:col-span-2">
              <p className="mb-2 eyebrow">
                Net pay changes · {diff.changedCount}
                {diff.flaggedCount > 0 && (
                  <Badge tone="warning" className="ml-2">
                    {diff.flaggedCount} over 10%
                  </Badge>
                )}
              </p>
              {diff.changed.length === 0 ? (
                <p className="text-small text-ink-muted">
                  Everyone who was paid last month is paid the same.
                </p>
              ) : (
                <table className="w-full text-left text-body">
                  <caption className="sr-only">Biggest changes in net pay</caption>
                  <thead className="text-caption text-ink-muted">
                    <tr>
                      <th scope="col" className="h-8 font-medium">
                        Person
                      </th>
                      <th scope="col" className="text-right font-medium">
                        Before
                      </th>
                      <th scope="col" className="text-right font-medium">
                        Now
                      </th>
                      <th scope="col" className="text-right font-medium">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.changed.map((c) => {
                      const up = c.deltaMinor > 0;
                      return (
                        <tr key={c.employeeId} className="border-t border-hairline">
                          <th scope="row" className="py-2 text-left font-normal text-ink">
                            {c.name}
                            {c.flagged && (
                              <Badge tone="warning" className="ml-2">
                                Check
                              </Badge>
                            )}
                          </th>
                          <td className="py-2 text-right num text-ink-muted">
                            {formatMoney(c.previousNetMinor)}
                          </td>
                          <td className="py-2 text-right num text-ink">
                            {formatMoney(c.netMinor)}
                          </td>
                          <td className="py-2 text-right num">
                            <span className={up ? "text-success" : "text-danger"}>
                              {up ? (
                                <ArrowUpRight className="mr-0.5 inline size-3.5" aria-hidden />
                              ) : (
                                <ArrowDownRight className="mr-0.5 inline size-3.5" aria-hidden />
                              )}
                              {formatPercent(Math.abs(c.pct), 1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardBody>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Payslips" description={`${run.payslips.length} in this run`} />
        <div className="mt-3 border-t border-hairline">
          <RunTable rows={run.payslips} />
        </div>
      </Card>
    </div>
  );
}

export default function RunPage({ params }: PageProps<"/payroll/[id]">) {
  return (
    <PageContainer className="max-w-6xl">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Run params={params} />
      </Suspense>
    </PageContainer>
  );
}
