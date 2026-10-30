import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/primitives";
import { AnnouncementEditor } from "@/features/announcements/components/announcement-editor";
import { audienceOptions, forEditing } from "@/features/announcements/queries";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Edit announcement" };

async function Edit({ params }: { params: PageProps<"/announcements/[id]/edit">["params"] }) {
  const user = await requirePermission("announcements.publish");
  const { id } = await params;
  const [item, options] = await Promise.all([forEditing(user, id), audienceOptions()]);
  if (!item) notFound();
  return (
    <AnnouncementEditor
      initial={item}
      departments={options.departments}
      locations={options.locations}
    />
  );
}

export default function EditAnnouncementPage({ params }: PageProps<"/announcements/[id]/edit">) {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/announcements"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Announcements
      </Link>
      <PageHeader eyebrow="Company" title="Edit announcement" />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <Edit params={params} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
