import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { NewRun } from "@/features/payroll/components/new-run";
import { SimulatedBadge, SimulatedNote } from "@/features/payroll/components/simulated";
import { RUN_STATUS } from "@/features/payroll/format";
import { runs } from "@/features/payroll/queries";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Payroll" };

async function Payroll() {
  await requirePermission("payroll.run");
  const { runs: list, options } = await runs();
  return (
    <div className="flex flex-col gap-6">
      <SimulatedNote />
      <Card>
        <CardHeader
          title="Pay runs"
          description="One per month: prepare, review, then finalize"
          action={<NewRun options={options} />}
        />
        {list.length === 0 ? (
          <EmptyState
            compact
            icon={Landmark}
            title="No pay runs yet"
            description="Start a run for a finished month to generate everyone's payslips as a draft."
          />
        ) : (
          <div className="mt-3 overflow-x-auto border-t border-hairline">
            <table className="w-full min-w-[36rem] text-left text-body">
              <caption className="sr-only">Pay runs</caption>
              <thead className="text-caption text-ink-muted">
                <tr>
                  <th scope="col" className="h-10 px-5 font-medium">
                    Month
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    People
                  </th>
                  <th scope="col" className="px-3 text-right font-medium">
                    Gross
                  </th>
                  <th scope="col" className="px-5 text-right font-medium">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr
                    key={r.id}
                    className="relative border-t border-hairline hover:bg-surface-hover"
                  >
                    <th scope="row" className="px-5 py-3 text-left font-medium text-ink">
                      <Link href={`/payroll/${r.id}`} className="after:absolute after:inset-0">
                        {r.label}
                      </Link>
                    </th>
                    <td className="px-3">
                      <StatusPill tone={RUN_STATUS[r.status].tone}>
                        {RUN_STATUS[r.status].label}
                      </StatusPill>
                    </td>
                    <td className="px-3 text-right num text-ink">{r.people}</td>
                    <td className="px-3 text-right num text-ink-muted">
                      {formatMoney(r.grossMinor, "INR", { compact: true })}
                    </td>
                    <td className="px-5 text-right num font-medium text-ink">
                      {formatMoney(r.netMinor, "INR", { compact: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function PayrollPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Pay"
        title="Payroll"
        description="Run payroll for the company, and keep salary structures current."
        actions={
          <>
            <SimulatedBadge />
            <Button asChild variant="secondary">
              <Link href="/payroll/structures">Salary structures</Link>
            </Button>
          </>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
          <Payroll />
        </Suspense>
      </div>
    </PageContainer>
  );
}
