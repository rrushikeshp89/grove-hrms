import { Download, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { AuditFiltersBar } from "@/features/audit/components/audit-filters";
import { AuditTable } from "@/features/audit/components/audit-table";
import { filtersToQuery, parseFilters } from "@/features/audit/logic";
import { auditOptions, auditPage } from "@/features/audit/queries";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

async function Audit({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;
  const [{ entries, next }, options] = await Promise.all([
    auditPage(filters, cursor),
    auditOptions(),
  ]);
  const query = filtersToQuery(filters);

  return (
    <AuditFiltersBar filters={filters} options={options}>
      <div className="mb-3 flex justify-end">
        <Button asChild variant="secondary" size="sm">
          <a href={`/audit/export${query ? `?${query}` : ""}`} download>
            <Download aria-hidden /> Export CSV
          </a>
        </Button>
      </div>
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No entries match"
            description="Try a wider date range, or clear a filter. Every change made in Grove is recorded here."
          />
        ) : (
          <>
            <AuditTable entries={entries} />
            {(next || cursor) && (
              <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3 text-small text-ink-muted">
                {cursor ? (
                  <Link
                    href={query ? `/audit?${query}` : "/audit"}
                    className="font-medium text-accent hover:underline"
                  >
                    Back to the newest
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link
                    href={`/audit?${query ? `${query}&` : ""}cursor=${next}`}
                    className="font-medium text-accent hover:underline"
                  >
                    Older entries
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </Card>
      <p className="mt-3 text-small text-ink-subtle">
        Entries can&apos;t be edited or deleted from Grove. Times are shown in your time zone.
      </p>
    </AuditFiltersBar>
  );
}

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Who changed what, and when. Open an entry to see the values before and after."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={8} columns={3} />}>
          <Audit searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
