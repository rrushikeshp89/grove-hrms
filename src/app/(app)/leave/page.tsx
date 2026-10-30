import { UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ExportLink } from "@/components/shell/export-link";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { ApplyLeaveSheet } from "@/features/leave/components/apply-leave-sheet";
import {
  BalanceCards,
  LeaveRequests,
  UnpaidNote,
} from "@/features/leave/components/leave-overview";
import { applyContext, balancesFor, myLeaveRequests } from "@/features/leave/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { scopeFor } from "@/lib/rbac";
import { todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Leave" };

const TABS = [
  { href: "/leave", label: "My leave" },
  { href: "/leave/calendar", label: "Team calendar" },
];

async function Leave() {
  const user = await requirePermission("leave.apply");
  if (!user.employee) {
    return (
      <Card>
        <EmptyState
          icon={UserRoundX}
          title="Your account isn't linked to an employee yet"
          description="Leave belongs to an employee record. HR can link yours."
        />
      </Card>
    );
  }
  const today = todayIn();
  const year = Number(today.slice(0, 4));
  const [balances, requests, context] = await Promise.all([
    balancesFor(user.employee.id, year),
    myLeaveRequests(user.employee.id),
    applyContext(user.employee.id),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Time"
        title="Leave"
        description={`Your ${year} balances, requests and approvals.`}
        actions={
          <>
            {scopeFor(actorOf(user), "leave.read") !== "own" && (
              <ExportLink href={`/leave/export?year=${year}`}>Export CSV</ExportLink>
            )}
            <ApplyLeaveSheet balances={balances} context={context} />
          </>
        }
      />
      <div className="mt-6 flex flex-col gap-6">
        <SectionTabs label="Leave views" tabs={TABS} />
        <BalanceCards balances={balances} />
        <UnpaidNote balances={balances} />
        <LeaveRequests requests={requests} today={today} />
      </div>
    </>
  );
}

function LeaveSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <span className="sr-only">Loading leave</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <TableSkeleton rows={4} columns={3} />
    </div>
  );
}

export default function LeavePage() {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense fallback={<LeaveSkeleton />}>
        <Leave />
      </Suspense>
    </PageContainer>
  );
}
