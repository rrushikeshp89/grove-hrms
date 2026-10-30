import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { TableSkeleton } from "@/components/ui/states";
import { DecidedList, Inbox } from "@/features/approvals/components/inbox";
import { inbox, recentDecisions } from "@/features/approvals/queries";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Approvals" };

type View = "mine" | "all" | "decided";

async function Approvals({
  searchParams,
}: {
  searchParams: PageProps<"/approvals">["searchParams"];
}) {
  const user = await requirePermission("leave.approve");
  const sp = await searchParams;
  const requested = (typeof sp.view === "string" ? sp.view : "mine") as View;
  const { items, counts } = await inbox(user, requested === "all" ? "all" : "mine");
  const view: View = requested === "all" && counts.all === null ? "mine" : requested;
  const decided = view === "decided" ? await recentDecisions(user) : [];

  const tabs: { view: View; label: string; count?: number }[] = [
    { view: "mine", label: "Waiting on you", count: counts.mine },
    ...(counts.all !== null
      ? [{ view: "all" as const, label: "All pending", count: counts.all }]
      : []),
    { view: "decided", label: "Decided" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Approval views" className="flex items-center gap-6 border-b border-hairline">
        {tabs.map((t) => (
          <Link
            key={t.view}
            href={t.view === "mine" ? "/approvals" : `/approvals?view=${t.view}`}
            aria-current={view === t.view ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-2 border-b-2 text-body font-medium transition-colors",
              view === t.view
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 num text-caption",
                  t.count ? "bg-accent-subtle text-accent" : "bg-surface-sunken text-ink-subtle",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {view === "decided" ? (
        <DecidedList items={decided} />
      ) : (
        <Inbox
          key={view}
          items={items}
          emptyTitle={view === "mine" ? "You're all caught up" : "Nothing is pending anywhere"}
        />
      )}
    </div>
  );
}

export default function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Time"
        title="Approvals"
        description="Leave and attendance corrections from your team, with who else is away so you can decide in one look."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={4} columns={3} />}>
          <Approvals searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
