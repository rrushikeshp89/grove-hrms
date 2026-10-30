import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { TableSkeleton } from "@/components/ui/states";
import { TeamCalendar } from "@/features/leave/components/team-calendar";
import { teamCalendar } from "@/features/leave/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { db } from "@/lib/db";
import { parseMonth, todayIn } from "@/lib/tz";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Team calendar" };

async function Calendar({
  searchParams,
}: {
  searchParams: PageProps<"/leave/calendar">["searchParams"];
}) {
  const user = await requirePermission("leave.read");
  const sp = await searchParams;
  const today = todayIn();
  const { year, month } = parseMonth(typeof sp.month === "string" ? sp.month : undefined, today);
  const dept =
    typeof sp.department === "string" && /^[A-Z]{2,6}$/.test(sp.department) ? sp.department : null;
  const [data, departments] = await Promise.all([
    teamCalendar(user, year, month, dept),
    db.department.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  return (
    <TeamCalendar
      data={data}
      year={year}
      month={month}
      today={today}
      department={dept}
      departments={departments}
    />
  );
}

export default function TeamCalendarPage({ searchParams }: PageProps<"/leave/calendar">) {
  return (
    <PageContainer className="max-w-7xl">
      <PageHeader
        eyebrow="Time"
        title="Leave"
        description="See who's away before you plan your own time off."
      />
      <div className="mt-6 flex flex-col gap-6">
        <SectionTabs
          label="Leave views"
          tabs={[
            { href: "/leave", label: "My leave" },
            { href: "/leave/calendar", label: "Team calendar" },
          ]}
        />
        <Suspense fallback={<TableSkeleton rows={8} columns={8} />}>
          <Calendar searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
