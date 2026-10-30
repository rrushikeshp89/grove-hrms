import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { SimulatedBadge, SimulatedNote } from "@/features/payroll/components/simulated";
import { computePayslip } from "@/features/payroll/logic/compute";
import { currentStructure, myPayslips } from "@/features/payroll/queries";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Pay" };

async function Pay() {
  const user = await requirePermission("payroll.read");
  if (!user.employee) {
    return (
      <Card>
        <EmptyState
          icon={ReceiptText}
          title="Your account isn't linked to an employee yet"
          description="Payslips belong to an employee record. HR can link yours in a minute."
        />
      </Card>
    );
  }
  const [slips, structure] = await Promise.all([
    myPayslips(user.employee.id),
    currentStructure(user.employee.id),
  ]);
  const monthly = structure
    ? computePayslip({ components: structure.components, workingDays: 22, lopDays: 0 })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <SimulatedNote />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Payslips" description="Final payslips, newest first" />
          {slips.length === 0 ? (
            <EmptyState
              compact
              icon={ReceiptText}
              title="No payslips yet"
              description="Your first payslip appears here once the people team finalizes a pay run that includes you."
            />
          ) : (
            <ul className="mt-3 border-t border-hairline">
              {slips.map((s) => (
                <li
                  key={s.id}
                  className="relative border-b border-hairline last:border-0 hover:bg-surface-hover"
                >
                  <Link
                    href={`/pay/${s.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 after:absolute after:inset-0"
                  >
                    <span className="text-body font-medium text-ink">{s.label}</span>
                    <span className="num text-body text-ink">{formatMoney(s.netMinor)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Your package"
            description={structure ? `Effective ${structure.effectiveFrom}` : undefined}
          />
          <CardBody>
            {structure && monthly ? (
              <>
                <p className="eyebrow">Yearly CTC</p>
                <p className="font-display-soft num text-display font-medium text-ink">
                  {formatMoney(structure.annualCtcMinor)}
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 text-small">
                  {monthly.lines.map((l) => (
                    <li key={l.name} className="flex justify-between gap-3">
                      <span className="text-ink-muted">{l.name}</span>
                      <span className="num text-ink">
                        {l.kind === "DEDUCTION" && "−"}
                        {formatMoney(l.amountMinor)}
                      </span>
                    </li>
                  ))}
                  <li className="mt-1 flex justify-between gap-3 border-t border-border-strong pt-2 font-medium">
                    <span className="text-ink">Typical monthly net</span>
                    <span className="num text-ink">{formatMoney(monthly.netMinor)}</span>
                  </li>
                </ul>
              </>
            ) : (
              <p className="text-body text-ink-muted">
                Your salary structure hasn&apos;t been set up yet.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Pay"
        title="Your pay"
        description="Payslips and what your package is made of."
        actions={<SimulatedBadge />}
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={5} columns={2} />}>
          <Pay />
        </Suspense>
      </div>
    </PageContainer>
  );
}
