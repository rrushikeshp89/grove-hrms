import { format } from "date-fns";
import { ClipboardCheck, Lock, PenLine } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { RatingDisplay } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/states";
import { dbDate } from "@/lib/tz";

import { QUESTIONS, RATING_LABELS, type ReviewKind } from "../logic/goals";
import type { CycleResult, ReviewDetail, ReviewTask } from "../queries";

const KIND_LABEL: Record<ReviewKind, string> = {
  SELF: "Your self review",
  MANAGER: "Manager review",
  PEER: "Peer feedback",
};

/** What this person owes in running cycles: self review, reports, and feedback they were asked for. */
export function ReviewTasks({ tasks }: { tasks: ReviewTask[] }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to write right now"
          description="When a review cycle opens, your self review and any reviews or feedback you owe show up here."
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="To write" description="Reviews and feedback waiting on you" />
      <ul className="mt-3 border-t border-hairline">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-3 border-b border-hairline px-5 py-4 last:border-0 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={t.reviewee.name} src={t.reviewee.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">
                  {t.isSelf ? KIND_LABEL.SELF : `${KIND_LABEL[t.kind]} for ${t.reviewee.name}`}
                </p>
                <p className="truncate text-small text-ink-muted">
                  {t.cycle}
                  {t.due && ` · due ${format(dbDate(t.due), "d MMM")}`}
                </p>
              </div>
            </div>
            {t.status === "SUBMITTED" ? (
              <div className="flex items-center gap-3">
                <StatusPill tone="success">Submitted</StatusPill>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/performance/reviews/${t.id}`}>View</Link>
                </Button>
              </div>
            ) : t.writable ? (
              <Button
                asChild
                size="sm"
                variant={t.status === "IN_PROGRESS" ? "secondary" : "primary"}
              >
                <Link href={`/performance/reviews/${t.id}`}>
                  <PenLine aria-hidden /> {t.status === "IN_PROGRESS" ? "Continue" : "Write"}
                </Link>
              </Button>
            ) : (
              <Badge tone="neutral">
                <Lock aria-hidden /> Opens with{" "}
                {t.kind === "MANAGER" ? "manager reviews" : "the cycle"}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Closed cycles: your two ratings side by side, what your manager wrote, and unattributed peer notes. */
export function Results({ results }: { results: CycleResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {results.map((r) => (
        <Card key={r.cycle}>
          <CardHeader
            title={`${r.cycle} results`}
            description={`Period ended ${format(dbDate(r.end), "d MMM yyyy")}`}
          />
          <CardBody className="grid gap-6 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="eyebrow">You rated yourself</p>
                <p className="mt-1">
                  {r.self ? (
                    <RatingDisplay value={r.self} />
                  ) : (
                    <span className="text-small text-ink-muted">No self review</span>
                  )}
                </p>
                {r.self && (
                  <p className="mt-0.5 text-small text-ink-muted">{RATING_LABELS[r.self]}</p>
                )}
              </div>
              <div>
                <p className="eyebrow">{r.managerName ?? "Your manager"} rated you</p>
                <p className="mt-1">
                  {r.manager ? (
                    <RatingDisplay value={r.manager} />
                  ) : (
                    <span className="text-small text-ink-muted">No manager review</span>
                  )}
                </p>
                {r.manager && (
                  <p className="mt-0.5 text-small text-ink-muted">{RATING_LABELS[r.manager]}</p>
                )}
              </div>
              {r.gap != null && (
                <p className="col-span-2 text-small text-ink-muted">
                  {r.gap === 0
                    ? "You and your manager see it the same way."
                    : r.gap > 0
                      ? "Your manager rated you higher than you rated yourself."
                      : "Your manager rated you lower than you rated yourself. Worth a conversation."}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {r.managerAnswers &&
                QUESTIONS.MANAGER.map((q) =>
                  r.managerAnswers![q.id] ? (
                    <div key={q.id}>
                      <p className="text-small font-medium text-ink">{q.prompt}</p>
                      <p className="mt-0.5 text-body whitespace-pre-line text-ink-muted">
                        {r.managerAnswers![q.id]}
                      </p>
                    </div>
                  ) : null,
                )}
              {r.peers.length > 0 && (
                <div>
                  <p className="mb-2 eyebrow">What colleagues said · {r.peers.length}</p>
                  <ul className="flex flex-col gap-3">
                    {r.peers.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-control bg-surface-sunken px-4 py-3 text-body text-ink-muted"
                      >
                        {QUESTIONS.PEER.map((q) => p.answers[q.id])
                          .filter(Boolean)
                          .join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/** A submitted (or someone else's) review, read-only. */
export function ReviewView({ review }: { review: ReviewDetail }) {
  return (
    <div className="flex flex-col gap-6">
      {review.questions.map((q) => (
        <div key={q.id}>
          <p className="text-body font-medium text-ink">{q.prompt}</p>
          <p className="mt-1 text-body whitespace-pre-line text-ink-muted">
            {review.answers[q.id] || "Not answered."}
          </p>
        </div>
      ))}
      <div>
        <p className="text-body font-medium text-ink">Overall rating</p>
        <p className="mt-1 flex items-center gap-3">
          {review.rating ? (
            <>
              <RatingDisplay value={review.rating} />
              <span className="text-small text-ink-muted">{RATING_LABELS[review.rating]}</span>
            </>
          ) : (
            <span className="text-small text-ink-muted">Not rated.</span>
          )}
        </p>
      </div>
      {review.submittedAt && (
        <p className="text-small text-ink-subtle">
          Submitted {format(new Date(review.submittedAt), "d MMMM yyyy")}
          {review.anonymous ? ". Written by a colleague." : `, by ${review.reviewer.name}.`}
        </p>
      )}
    </div>
  );
}
