import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { LeaveTypes } from "@/features/settings/components/leave-types";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { leaveSetup } from "@/features/settings/queries";
import { requirePermission, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Leave types" };

async function Tabs() {
  const user = await requireUser();
  return <SettingsTabs role={user.role} />;
}

async function Types() {
  await requirePermission("leave.configure");
  return <LeaveTypes types={await leaveSetup()} />;
}

export default function LeaveSettingsPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Leave types"
        description="What each kind of leave is, who approves it, and how the days build up."
      />
      <div className="mt-8 flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Tabs />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <Types />
        </Suspense>
      </div>
    </PageContainer>
  );
}
