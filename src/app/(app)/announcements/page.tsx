import { Megaphone, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/primitives";
import { AnnouncementCard } from "@/features/announcements/components/announcement-card";
import { drafts, feed } from "@/features/announcements/queries";
import { can } from "@/lib/rbac";
import { actorOf, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Announcements" };

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-card" />
      ))}
    </div>
  );
}

async function Feed() {
  const user = await requireUser();
  const canPublish = can(actorOf(user), "announcements.publish");
  const [items, mine] = await Promise.all([feed(user), drafts(user)]);

  return (
    <div className="flex flex-col gap-4">
      {canPublish && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/announcements/new">
              <PenLine aria-hidden /> New announcement
            </Link>
          </Button>
        </div>
      )}
      {mine.length > 0 && (
        <section aria-labelledby="drafts" className="flex flex-col gap-3">
          <h2 id="drafts" className="text-heading font-semibold text-ink">
            Drafts · {mine.length}
          </h2>
          {mine.map((d) => (
            <AnnouncementCard key={d.id} item={d} canPublish />
          ))}
        </section>
      )}
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description={
              canPublish
                ? "Share news with the whole company, or with just one team or location."
                : "Company news shows up here as soon as the people team posts it."
            }
            action={
              canPublish ? (
                <Button asChild>
                  <Link href="/announcements/new">Write the first one</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        items.map((a) => <AnnouncementCard key={a.id} item={a} canPublish={canPublish} />)
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="Company"
        title="Announcements"
        description="News from across Northwind Grove."
      />
      <div className="mt-8">
        <Suspense fallback={<FeedSkeleton />}>
          <Feed />
        </Suspense>
      </div>
    </PageContainer>
  );
}
