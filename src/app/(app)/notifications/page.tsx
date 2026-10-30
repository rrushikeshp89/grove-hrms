import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { PAGE_SIZE, notificationsFor } from "@/features/notifications/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Notifications" };

async function Notifications({
  searchParams,
}: {
  searchParams: PageProps<"/notifications">["searchParams"];
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const unreadOnly = sp.view === "unread";
  const pages = Math.min(5, Math.max(1, Number(typeof sp.pages === "string" ? sp.pages : 1) || 1));
  const { items, total, unread } = await notificationsFor(user, {
    unreadOnly,
    limit: PAGE_SIZE * pages,
  });
  const base = unreadOnly ? "/notifications?view=unread" : "/notifications";

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs
        label="Notification filter"
        current={base}
        tabs={[
          { href: "/notifications", label: "All" },
          { href: "/notifications?view=unread", label: unread ? `Unread · ${unread}` : "Unread" },
        ]}
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={unreadOnly ? "Nothing unread" : "No notifications yet"}
            description={
              unreadOnly
                ? "You've read everything. New approvals, reminders and news will land here."
                : "Approvals that need you, answers to your requests, reminders and company news all show up here."
            }
          />
        ) : (
          <>
            <NotificationList
              key={items.map((i) => `${i.id}${i.read}`).join()}
              items={items}
              unread={unread}
            />
            {total > items.length && (
              <div className="border-t border-hairline p-4 text-center">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`${base}${unreadOnly ? "&" : "?"}pages=${pages + 1}`} scroll={false}>
                    Show older
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="You"
        title="Notifications"
        description="What needs you, and what's changed."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
          <Notifications searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
