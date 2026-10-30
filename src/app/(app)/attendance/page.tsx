import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/primitives";
import { ClockCard } from "@/features/attendance/components/clock-card";
import { Timesheet } from "@/features/attendance/components/timesheet";
import { myTimesheet, myToday } from "@/features/attendance/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { scopeFor } from "@/lib/rbac";
import { parseMonth, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";
import { UserRoundX } from "lucide-react";

export const metadata: Metadata = { title: "Attendance" };

async function Attendance({
  searchParams,
}: {
  searchParams: PageProps<"/attendance">["searchParams"];
}) {
  const user = await requirePermission("attendance.clock");
  const sp = await searchParams;
  const scope = scopeFor(actorOf(user), "attendance.read");
  const tabs =
    scope === "team" || scope === "all"
      ? [
          { href: "/attendance", label: "Mine" },
          { href: "/attendance/team", label: scope === "all" ? "Everyone today" : "Team today" },
        ]
      : null;

  if (!user.employee) {
    return (
      <Card>
        <EmptyState
          icon={UserRoundX}
          title="Your account isn't linked to an employee yet"
          description="Attendance belongs to an employee record. HR can link yours in a minute."
        />
      </Card>
    );
  }
  const { year, month } = parseMonth(
    typeof sp.month === "string" ? sp.month : undefined,
    todayIn(),
  );
  const [today, sheet] = await Promise.all([
    myToday(user.employee.id),
    myTimesheet(user.employee.id, year, month),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {tabs && <SectionTabs label="Attendance views" tabs={tabs} />}
      <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20">
          <ClockCard key={`${today.today}-${today.clockInAt}-${today.clockOutAt}`} today={today} />
        </div>
        <Timesheet data={sheet} year={year} month={month} />
      </div>
    </div>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]" aria-busy>
      <span className="sr-only">Loading attendance</span>
      <Card className="flex flex-col items-center gap-5 py-8">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="size-32 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </Card>
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

export default function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Time"
        title="Attendance"
        description="Clock in for the day, and see or correct your timesheet."
      />
      <div className="mt-8">
        <Suspense fallback={<AttendanceSkeleton />}>
          <Attendance searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
