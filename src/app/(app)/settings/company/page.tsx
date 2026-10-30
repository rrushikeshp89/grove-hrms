import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card, CardBody, CardHeader, DescriptionList, Skeleton } from "@/components/ui/primitives";
import { CompanyForm, ScheduleForm } from "@/features/settings/components/company-forms";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { weekSummary } from "@/features/settings/logic";
import { companySettings } from "@/features/settings/queries";
import { requirePermission, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Company settings" };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

async function Tabs() {
  const user = await requireUser();
  return <SettingsTabs role={user.role} />;
}

async function Company() {
  await requirePermission("settings.company");
  const { company, schedule } = await companySettings();
  if (!company || !schedule) {
    return (
      <p className="text-body text-ink-muted">The company record hasn&apos;t been set up yet.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Company" description="How the company is named around Grove" />
        <CardBody>
          <CompanyForm initial={{ name: company.name, legalName: company.legalName }} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Working hours"
          description={`The shift for ${schedule.locations.map((l) => l.name).join(" and ")}. Lateness and early leaving are measured against it.`}
        />
        <CardBody>
          <ScheduleForm
            scheduleId={schedule.id}
            initial={{
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              graceMinutes: schedule.graceMinutes,
              workDays: schedule.workDays,
            }}
          />
          <p className="mt-4 text-small text-ink-subtle">
            Currently {schedule.startTime} to {schedule.endTime}, {weekSummary(schedule.workDays)}.
            Past attendance isn&apos;t recalculated.
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Fixed for this deployment"
          description="These are set when Grove is installed, and shown here for reference."
        />
        <CardBody>
          <DescriptionList
            columns={3}
            items={[
              { term: "Time zone", detail: company.defaultTimezone },
              { term: "Currency", detail: company.currency },
              {
                term: "Financial year starts",
                detail: MONTHS[company.fiscalYearStartMonth - 1] ?? "April",
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

export default function CompanySettingsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Administration"
        title="Company settings"
        description="Names and working hours for the whole company."
      />
      <div className="mt-8 flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Tabs />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <Company />
        </Suspense>
      </div>
    </PageContainer>
  );
}
