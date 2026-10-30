import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { AnnouncementEditor } from "@/features/announcements/components/announcement-editor";
import { audienceOptions } from "@/features/announcements/queries";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "New announcement" };

async function New() {
  await requirePermission("announcements.publish");
  const { departments, locations } = await audienceOptions();
  return <AnnouncementEditor departments={departments} locations={locations} />;
}

export default function NewAnnouncementPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/announcements"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Announcements
      </Link>
      <PageHeader
        eyebrow="Company"
        title="New announcement"
        description="Write it once, choose who sees it, and publish when it's ready."
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <New />
        </Suspense>
      </div>
    </PageContainer>
  );
}
