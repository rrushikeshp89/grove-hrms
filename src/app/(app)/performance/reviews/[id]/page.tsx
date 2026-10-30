import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/primitives";
import { ProfileSkeleton } from "@/components/ui/states";
import { ReviewForm } from "@/features/performance/components/review-form";
import { ReviewView } from "@/features/performance/components/reviews";
import { reviewDetail } from "@/features/performance/queries";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Review" };

const TITLE = { SELF: "Self review", MANAGER: "Manager review", PEER: "Peer feedback" } as const;

async function Review({ params }: { params: PageProps<"/performance/reviews/[id]">["params"] }) {
  const user = await requirePermission("performance.read");
  const { id } = await params;
  const review = await reviewDetail(user, id);
  if (!review) notFound();
  const self = review.kind === "SELF";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/performance?view=reviews"
        className="inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Reviews
      </Link>
      <header className="flex items-center gap-4">
        <Avatar name={review.reviewee.name} src={review.reviewee.avatarUrl} size="xl" />
        <div className="min-w-0">
          <p className="eyebrow">
            {review.cycle} · {TITLE[review.kind]}
          </p>
          <h1 className="font-display-soft text-display font-medium text-ink">
            {self && review.isSubject ? "Your self review" : review.reviewee.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-body text-ink-muted">
            {review.reviewee.title}
            <StatusPill
              tone={
                review.status === "SUBMITTED"
                  ? "success"
                  : review.status === "IN_PROGRESS"
                    ? "warning"
                    : "neutral"
              }
            >
              {review.status === "SUBMITTED"
                ? "Submitted"
                : review.status === "IN_PROGRESS"
                  ? "Draft"
                  : "Not started"}
            </StatusPill>
          </p>
        </div>
      </header>
      <Card className="max-w-3xl">
        <CardBody className="py-6">
          {review.kind === "PEER" && review.editable && (
            <p className="mb-6 rounded-control bg-surface-sunken px-4 py-3 text-small text-ink-muted">
              What you write goes to {review.reviewee.name}, and your name isn&apos;t attached.
              Their manager and the people team can see who wrote it.
            </p>
          )}
          {review.editable ? <ReviewForm review={review} /> : <ReviewView review={review} />}
        </CardBody>
      </Card>
    </div>
  );
}

export default function ReviewPage({ params }: PageProps<"/performance/reviews/[id]">) {
  return (
    <PageContainer className="max-w-4xl">
      <Suspense fallback={<ProfileSkeleton />}>
        <Review params={params} />
      </Suspense>
    </PageContainer>
  );
}
