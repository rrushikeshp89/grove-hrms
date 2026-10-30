import { format } from "date-fns";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DescriptionList, Skeleton } from "@/components/ui/primitives";
import { AppearanceSettings } from "@/features/account/components/appearance-settings";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import { SessionsList, type SessionRow } from "@/features/account/components/sessions-list";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { describeUserAgent, displayIp } from "@/lib/user-agent";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings" };

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-control" />
      ))}
    </div>
  );
}

async function Profile() {
  const user = await requireUser();
  const e = user.employee;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <Avatar name={user.name} src={e?.avatarUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-heading font-semibold text-ink">
          {user.name}
          <Badge tone="accent">{ROLE_LABELS[user.role]}</Badge>
          {user.isDemo && <Badge tone="highlight">Demo account</Badge>}
        </p>
        <DescriptionList
          className="mt-4"
          items={[
            { term: "Work email", detail: user.email },
            { term: "Employee ID", detail: e?.code ?? "Not linked", mono: true },
            { term: "Designation", detail: e?.designation ?? "Not linked" },
            { term: "Department", detail: e?.department ?? "Not linked" },
          ]}
        />
        <p className="mt-4 text-small text-ink-subtle">
          Job details are maintained by HR. Ask them if something here is out of date.
        </p>
      </div>
    </div>
  );
}

async function Sessions() {
  const user = await requireUser();
  const rows = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userAgent: true, ipAddress: true, updatedAt: true },
  });
  const sessions: SessionRow[] = rows.map((s) => {
    const ua = describeUserAgent(s.userAgent);
    return {
      id: s.id,
      label: ua.label,
      mobile: ua.mobile,
      ip: displayIp(s.ipAddress),
      lastActive: s.updatedAt.toISOString(),
      current: s.id === user.sessionId,
    };
  });
  return (
    <>
      <SessionsList initial={sessions} />
      <p className="mt-3 text-small text-ink-subtle">
        Sessions last seven days and renew while you use Grove. Checked{" "}
        {format(new Date(), "d MMM, HH:mm")}.
      </p>
    </>
  );
}

async function Tabs() {
  const user = await requireUser();
  return <SettingsTabs role={user.role} />;
}

async function Security() {
  const user = await requireUser();
  return <ChangePasswordForm isDemo={user.isDemo} />;
}

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="You"
        title="Settings"
        description="Your profile, how Grove looks, and where you're signed in."
      />
      <div className="mt-8 flex flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Tabs />
        </Suspense>
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <Suspense fallback={<SectionSkeleton />}>
              <Profile />
            </Suspense>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Appearance"
            description="Saved to your account, so it follows you to other devices."
          />
          <CardBody>
            <AppearanceSettings />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Password" />
          <CardBody>
            <Suspense fallback={<SectionSkeleton rows={2} />}>
              <Security />
            </Suspense>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Where you're signed in"
            description="Sign out of any device you don't recognize."
          />
          <CardBody>
            <Suspense fallback={<SectionSkeleton />}>
              <Sessions />
            </Suspense>
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
