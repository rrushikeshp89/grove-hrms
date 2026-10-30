"use client";

import { Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { RatingInput } from "@/components/ui/rating";
import { toast } from "@/components/ui/toaster";

import { declineFeedback, saveReview } from "../actions";
import { RATING_LABELS } from "../logic/goals";
import type { ReviewDetail } from "../queries";

/**
 * Writing a review: one box per question and a rating. Saving keeps a draft
 * anyone can return to; submitting locks it and tells you what's missing
 * first, in place, rather than after a trip to the server.
 */
export function ReviewForm({ review }: { review: ReviewDetail }) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, string>>(review.answers);
  const [rating, setRating] = React.useState<number | null>(review.rating);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const subjectName = review.kind === "SELF" ? "yourself" : review.reviewee.name;

  function send(submit: boolean) {
    startTransition(async () => {
      const r = await saveReview({ reviewId: review.id, answers, rating, submit });
      if (!r.ok) {
        const next: Record<string, string> = {};
        for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
          next[f.replace("answers.", "")] = m[0]!;
        setErrors(next);
        if (!r.fieldErrors) toast.error("Couldn't save", { description: r.error });
        return;
      }
      setErrors({});
      if (submit) {
        celebrate();
        toast.success("Review submitted", { description: "Thank you. It can't be edited now." });
        router.push("/performance?view=reviews");
      } else {
        toast.success("Draft saved");
        router.refresh();
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        send(true);
      }}
      className="flex flex-col gap-6"
    >
      {review.questions.map((q) => (
        <Field key={q.id} label={q.prompt} hint={q.hint} error={errors[q.id]}>
          <Textarea
            rows={4}
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
          />
        </Field>
      ))}
      <div>
        <p className="mb-1.5 text-body font-medium text-ink">
          Overall, how would you rate {subjectName}?
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <RatingInput value={rating} onChange={setRating} label={`Rating for ${subjectName}`} />
          <span className="text-small text-ink-muted">
            {rating ? RATING_LABELS[rating] : "Choose a rating"}
          </span>
        </div>
        {errors.rating && (
          <p role="alert" className="mt-1.5 text-small font-medium text-danger">
            {errors.rating}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => send(false)} disabled={pending}>
            <Save aria-hidden /> Save draft
          </Button>
          {review.kind === "PEER" && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await declineFeedback({ reviewId: review.id });
                  if (!r.ok) toast.error("Couldn't decline", { description: r.error });
                  else router.push("/performance?view=reviews");
                })
              }
            >
              Decline
            </Button>
          )}
        </div>
        <Button type="submit" loading={pending}>
          <Send aria-hidden /> Submit review
        </Button>
      </div>
    </form>
  );
}
