import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/primitives";
import { TableSkeleton } from "@/components/ui/states";
import { StructuresTable } from "@/features/payroll/components/revise-sheet";
import { SimulatedBadge } from "@/features/payroll/components/simulated";
import { structures } from "@/features/payroll/queries";
import { todayIn } from "@/lib/tz";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Salary structures" };

async function Structures() {
  await requirePermission("payroll.run");
  const rows = await structures();
  return (
    <Card className="overflow-hidden">
      <StructuresTable rows={rows} today={todayIn()} />
    </Card>
  );
}

export default function StructuresPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/payroll"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Payroll
      </Link>
      <PageHeader
        eyebrow="Pay"
        title="Salary structures"
        description="Everyone's current package. A revision applies from its effective date and never changes a month that's been paid."
        actions={<SimulatedBadge />}
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={8} columns={3} />}>
          <Structures />
        </Suspense>
      </div>
    </PageContainer>
  );
}
