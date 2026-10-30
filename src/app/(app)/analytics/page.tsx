import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { AnalyticsFilters, RangeNote } from "@/features/analytics/components/filters";
import { Hiring } from "@/features/analytics/components/hiring";
import {
  Attrition,
  DepartmentMix,
  HeadcountOverview,
  JoinersLeavers,
} from "@/features/analytics/components/people";
import { AttendancePatterns, LeaveTrends } from "@/features/analytics/components/time";
import { parseRange, rangeLabel, spanDays } from "@/features/analytics/logic/range";
import {
  attendanceReport,
  dataStart,
  departmentOptions,
  hiringReport,
  leaveReport,
  peopleReport,
  type Filters,
} from "@/features/analytics/queries";
import { todayIn } from "@/lib/tz";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Analytics" };

function SectionSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-hidden>
      <Skeleton
        className={tall ? "h-80 rounded-card lg:col-span-2" : "h-64 rounded-card lg:col-span-2"}
      />
      <Skeleton className={tall ? "h-80 rounded-card" : "h-64 rounded-card"} />
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="font-display-soft text-title font-medium text-ink">
          {title}
        </h2>
        <p className="text-body text-ink-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

async function People({ f }: { f: Filters }) {
  const data = await peopleReport(f);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <HeadcountOverview data={data} label={rangeLabel({ ...f, preset: "custom" })} />
        <JoinersLeavers data={data} />
      </div>
      <DepartmentMix data={data} filtered={!!f.department} />
    </div>
  );
}

async function AttritionSection({ f }: { f: Filters }) {
  return <Attrition data={await peopleReport(f)} />;
}

async function Leave({ f }: { f: Filters }) {
  return <LeaveTrends data={await leaveReport(f)} />;
}

async function Attendance({ f }: { f: Filters }) {
  return <AttendancePatterns data={await attendanceReport(f)} />;
}

async function HiringSection({ f }: { f: Filters }) {
  return <Hiring data={await hiringReport(f)} />;
}

async function Reports({
  searchParams,
}: {
  searchParams: PageProps<"/analytics">["searchParams"];
}) {
  await requirePermission("analytics.read");
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const today = todayIn();
  const [start, departments] = await Promise.all([dataStart(today), departmentOptions()]);
  const range = parseRange(
    { range: str(sp.range), from: str(sp.from), to: str(sp.to) },
    today,
    start,
  );
  const dept = str(sp.dept);
  const department = departments.some((d) => d.code === dept) ? dept! : null;
  const f: Filters = { start: range.start, end: range.end, department };

  return (
    <AnalyticsFilters
      range={range}
      department={department}
      departments={departments}
      dataStart={start}
      today={today}
    >
      <div className="flex flex-col gap-12">
        <RangeNote
          label={`${rangeLabel(range)}${department ? ` · ${departments.find((d) => d.code === department)!.name}` : ""}`}
          weekly={spanDays(range) <= 92}
        />
        <Section
          id="people"
          title="People"
          description="How the team has grown, and where people sit."
        >
          <Suspense fallback={<SectionSkeleton tall />}>
            <People f={f} />
          </Suspense>
        </Section>
        <Section id="attrition" title="Attrition" description="Who left, how often, and why.">
          <Suspense fallback={<SectionSkeleton />}>
            <AttritionSection f={f} />
          </Suspense>
        </Section>
        <Section id="leave" title="Time off" description="Approved leave, by type and team.">
          <Suspense fallback={<SectionSkeleton />}>
            <Leave f={f} />
          </Suspense>
        </Section>
        <Section id="attendance" title="Attendance" description="Arrival habits and punctuality.">
          <Suspense fallback={<SectionSkeleton tall />}>
            <Attendance f={f} />
          </Suspense>
        </Section>
        <Section id="hiring" title="Hiring" description="From application to offer to first day.">
          <Suspense fallback={<SectionSkeleton />}>
            <HiringSection f={f} />
          </Suspense>
        </Section>
      </div>
    </AnalyticsFilters>
  );
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Headcount, attrition, time off, attendance and hiring for Northwind Grove. Every chart has a table view."
      />
      <div className="mt-8">
        <Suspense fallback={<SectionSkeleton tall />}>
          <Reports searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
