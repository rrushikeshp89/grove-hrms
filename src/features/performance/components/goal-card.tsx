import { format } from "date-fns";
import { Target } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/progress";
import { dbDate } from "@/lib/tz";

import { GOAL_STATUS_META } from "../logic/goals";
import type { GoalCard as Goal } from "../queries";

export function GoalCard({ goal, showOwner = false }: { goal: Goal; showOwner?: boolean }) {
  const meta = GOAL_STATUS_META[goal.status];
  return (
    <li>
      <Card className="relative flex h-full flex-col gap-3 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-body font-semibold text-ink">
              <Link
                href={`/performance/goals/${goal.id}`}
                className="after:absolute after:inset-0 after:rounded-card hover:text-accent"
              >
                {goal.title}
              </Link>
            </h2>
            {goal.parent && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-small text-ink-muted">
                <Target className="size-3.5 shrink-0" aria-hidden /> Supports {goal.parent.title}
              </p>
            )}
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-small">
            <span className="text-ink-muted">
              {goal.keyResultCount > 0
                ? `${goal.keyResultsDone} of ${goal.keyResultCount} key results`
                : "Tracked by check-ins"}
            </span>
            <span className="num font-medium text-ink">{goal.progress}%</span>
          </div>
          <ProgressBar
            value={goal.progress}
            tone={
              goal.status === "OFF_TRACK"
                ? "danger"
                : goal.status === "AT_RISK"
                  ? "warning"
                  : "accent"
            }
            label={`${goal.title}: ${goal.progress}% complete`}
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-small text-ink-subtle">
          {showOwner && goal.owner ? (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={goal.owner.name} src={goal.owner.avatarUrl} size="xs" />
              <span className="truncate text-ink-muted">{goal.owner.name}</span>
            </span>
          ) : (
            <span>{goal.alignedCount > 0 ? `${goal.alignedCount} aligned` : ""}</span>
          )}
          {goal.dueDate && <span>Due {format(dbDate(goal.dueDate), "d MMM yyyy")}</span>}
        </div>
      </Card>
    </li>
  );
}
