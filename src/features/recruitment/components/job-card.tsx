import { format } from "date-fns";
import { MapPin } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

import { JOB_STATUS_META, PIPELINE, STAGE_META, daysSince } from "../logic/pipeline";
import type { JobCard as Job } from "../queries";

const SHADES = {
  APPLIED: "bg-surface-active",
  SCREENING: "bg-accent/35",
  INTERVIEW: "bg-accent/65",
  OFFER: "bg-accent",
  HIRED: "bg-success",
} as const;

export function JobCard({ job, now }: { job: Job; now: Date }) {
  const meta = JOB_STATUS_META[job.status];
  const total = PIPELINE.reduce((n, s) => n + job.stages[s], 0);
  const days = daysSince(new Date(job.openedAt), now);
  return (
    <li>
      <Card className="relative flex h-full flex-col gap-3 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-heading font-semibold text-ink">
              <Link
                href={`/hiring/${job.id}`}
                className="after:absolute after:inset-0 after:rounded-card hover:text-accent"
              >
                {job.title}
              </Link>
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-small text-ink-muted">
              {job.department} <span aria-hidden>·</span>
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {job.location}
            </p>
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>

        {total > 0 ? (
          <div>
            <div
              aria-hidden
              className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-sunken"
            >
              {PIPELINE.filter((s) => job.stages[s] > 0).map((s) => (
                <span
                  key={s}
                  className={cn("h-full", SHADES[s])}
                  style={{ width: `${(job.stages[s] / total) * 100}%` }}
                />
              ))}
            </div>
            <p className="mt-2 text-small text-ink-muted">
              {PIPELINE.filter((s) => job.stages[s] > 0)
                .map((s) => `${job.stages[s]} ${STAGE_META[s].label.toLowerCase()}`)
                .join(" · ")}
            </p>
          </div>
        ) : (
          <p className="text-small text-ink-muted">No candidates yet.</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={job.hiringManager.name} src={job.hiringManager.avatarUrl} size="xs" />
            <span className="truncate text-small text-ink-muted">{job.hiringManager.name}</span>
          </span>
          <span className="shrink-0 text-small text-ink-subtle">
            {job.status === "CLOSED" && job.closedAt
              ? `Closed ${format(new Date(job.closedAt), "d MMM yyyy")}`
              : job.status === "DRAFT"
                ? `${job.openings} ${job.openings === 1 ? "opening" : "openings"}`
                : `${job.stages.HIRED} of ${job.openings} filled · ${days}d open`}
          </span>
        </div>
      </Card>
    </li>
  );
}
