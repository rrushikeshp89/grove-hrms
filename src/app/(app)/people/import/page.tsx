import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { ImportWizard } from "@/features/people/components/import-wizard";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Import people" };

async function Import() {
  await requirePermission("employee.create");
  return <ImportWizard />;
}

export default function ImportPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/people"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> People
      </Link>
      <PageHeader
        eyebrow="Organization"
        title="Import people"
        description="Add many employees from a spreadsheet. You'll see exactly what will happen before anything is saved."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-card" />}>
          <Import />
        </Suspense>
      </div>
    </PageContainer>
  );
}
