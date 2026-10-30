import { format } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { TableSkeleton } from "@/components/ui/states";
import { TeamToday } from "@/features/attendance/components/team-today";
import { teamToday } from "@/features/attendance/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { scopeFor } from "@/lib/rbac";
import { dbDate } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";
import { forbidden } from "next/navigation";

export const metadata: Metadata = { title: "Team attendance" };

async function Team() {
  const user = await requirePermission("attendance.read");
  const scope = scopeFor(actorOf(user), "attendance.read");
  if (scope === "own") forbidden();
  const data = await teamToday(user, null);
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Attendance views"
        tabs={[
          { href: "/attendance", label: "Mine" },
          { href: "/attendance/team", label: scope === "all" ? "Everyone today" : "Team today" },
        ]}
      />
      <p className="text-small text-ink-muted">
        {format(dbDate(data.today), "EEEE, d MMMM")} · updates when you reload
      </p>
      <TeamToday rows={data.rows} tz={data.tz} />
    </div>
  );
}

export default function TeamAttendancePage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Time"
        title="Attendance"
        description="Who's in, who's running late, and who's away today."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={8} columns={3} />}>
          <Team />
        </Suspense>
      </div>
    </PageContainer>
  );
}
