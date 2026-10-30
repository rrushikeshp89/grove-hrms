"use client";

import { format } from "date-fns";
import { MessageSquarePlus, RotateCcw, Star, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { RatingInput } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { addNote, moveCandidate, restoreCandidate } from "../actions";
import { PIPELINE, STAGE_META, type PipelineStage } from "../logic/pipeline";
import type { CandidateDetail, RecruitmentOptions } from "../queries";
import { ConvertDialog } from "./convert-dialog";
import { RejectDialog } from "./reject-dialog";

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-small text-ink">
      <Star className="size-3.5 fill-current text-accent" aria-hidden />
      <span className="num font-medium">{value.toFixed(1)}</span>
      <span className="text-ink-subtle">out of 5</span>
    </span>
  );
}

/* ─── Notes ────────────────────────────────────────────────────────────── */

export function Notes({
  candidateId,
  notes,
  canWrite,
}: {
  candidateId: string;
  notes: CandidateDetail["notes"];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await addNote({ candidateId, body, rating });
      if (!r.ok) {
        setError(r.fieldErrors?.body?.[0] ?? r.error);
        return;
      }
      setBody("");
      setRating(null);
      setError(undefined);
      toast.success("Note added");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Notes" description="What the team thinks, with ratings" />
      {canWrite && (
        <CardBody className="border-b border-hairline">
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <Field label="Add a note" error={error}>
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="How did the conversation go?"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RatingInput value={rating} onChange={setRating} />
              <Button type="submit" variant="secondary" size="sm" loading={pending}>
                <MessageSquarePlus aria-hidden /> Add note
              </Button>
            </div>
          </form>
        </CardBody>
      )}
      {notes.length === 0 ? (
        <EmptyState
          compact
          icon={MessageSquarePlus}
          title="No notes yet"
          description="After a conversation, leave a note so the next interviewer starts ahead."
        />
      ) : (
        <ul className="flex flex-col px-5 py-1">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3 border-b border-hairline py-3.5 last:border-0">
              <Avatar name={n.author.name} src={n.author.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-body font-medium text-ink">{n.author.name}</p>
                  <time dateTime={n.createdAt} className="text-caption text-ink-subtle">
                    {format(new Date(n.createdAt), "d MMM yyyy")}
                  </time>
                </div>
                {n.rating != null && (
                  <p
                    className="mt-0.5 flex items-center gap-0.5"
                    aria-label={`${n.rating} out of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        aria-hidden
                        className={cn(
                          "size-3 text-ink-subtle",
                          i <= n.rating! && "fill-current text-accent",
                        )}
                      />
                    ))}
                  </p>
                )}
                <p className="mt-1 text-body whitespace-pre-line text-ink-muted">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─── Header actions ───────────────────────────────────────────────────── */

export function CandidateActions({
  candidate,
  canEdit,
  canHire,
  suggestedStart,
  options,
}: {
  candidate: CandidateDetail;
  canEdit: boolean;
  canHire: boolean;
  suggestedStart: string;
  options: Pick<RecruitmentOptions, "managers" | "takenEmails">;
}) {
  const router = useRouter();
  const [hiring, setHiring] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  if (!canEdit || candidate.stage === "HIRED") return null;

  if (candidate.stage === "REJECTED") {
    return (
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await restoreCandidate({ candidateId: candidate.id });
            if (!r.ok) toast.error("Couldn't bring them back", { description: r.error });
            else router.refresh();
          })
        }
      >
        <RotateCcw aria-hidden /> Bring back
      </Button>
    );
  }

  const next = PIPELINE[PIPELINE.indexOf(candidate.stage as PipelineStage) + 1];
  function move(stage: "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER") {
    startTransition(async () => {
      const r = await moveCandidate({
        candidateId: candidate.id,
        stage,
        aboveId: null,
        belowId: null,
      });
      if (!r.ok) toast.error("Couldn't move them", { description: r.error });
      else router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setRejecting(true)}>
        <UserX aria-hidden /> Not moving forward
      </Button>
      {candidate.stage === "OFFER" ? (
        canHire && (
          <Button onClick={() => setHiring(true)}>
            <UserCheck aria-hidden /> Convert to employee
          </Button>
        )
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button loading={pending}>Move to {next ? STAGE_META[next].label : ""}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PIPELINE.filter(
              (s): s is "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" =>
                s !== "HIRED" && s !== candidate.stage,
            ).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => move(s)}>
                {STAGE_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConvertDialog
        candidate={
          hiring
            ? {
                id: candidate.id,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
              }
            : null
        }
        hiringManagerId={candidate.job.hiringManagerId}
        suggestedStart={suggestedStart}
        options={options}
        onOpenChange={setHiring}
      />
      <RejectDialog
        candidate={rejecting ? { id: candidate.id, name: candidate.name } : null}
        onOpenChange={setRejecting}
      />
    </>
  );
}
