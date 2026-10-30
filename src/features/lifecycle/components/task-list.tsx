"use client";

import { format } from "date-fns";
import { CalendarClock, Check } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { celebrate } from "@/components/ui/celebrate";
import { Checkbox } from "@/components/ui/choice";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/progress";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

import { toggleTask } from "../actions";
import {
  ASSIGNEES,
  ASSIGNEE_LABELS,
  checklistProgress,
  dueLabel,
  type Assignee,
} from "../logic/checklist";
import type { ChecklistDetail, ChecklistTaskRow } from "../queries";

function TaskRow({
  task,
  done,
  today,
  onToggle,
}: {
  task: ChecklistTaskRow;
  done: boolean;
  today: string;
  onToggle: (task: ChecklistTaskRow, done: boolean) => void;
}) {
  const overdue = !done && task.dueDate < today;
  const id = `task-${task.id}`;
  return (
    <li className="flex items-start gap-3 border-b border-hairline py-3 last:border-0">
      <span className="pt-0.5">
        <Checkbox
          id={id}
          checked={done}
          disabled={!task.canTick}
          onCheckedChange={(v) => onToggle(task, v === true)}
          aria-label={task.title}
        />
      </span>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={cn(
            "text-body",
            done ? "text-ink-muted line-through decoration-hairline" : "text-ink",
            task.canTick && "cursor-pointer",
          )}
        >
          {task.title}
        </label>
        {task.description && !done && (
          <p className="text-small text-ink-subtle">{task.description}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small text-ink-muted">
          {done ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5 text-success" aria-hidden />
              {task.completedBy ? `Done by ${task.completedBy}` : "Done"}
              {task.completedAt && ` on ${format(new Date(task.completedAt), "d MMM")}`}
            </span>
          ) : (
            <span className={cn(overdue && "font-medium text-danger")}>
              {dueLabel(task.dueDate, today)}
            </span>
          )}
        </p>
      </div>
      {task.assignee && (
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="max-w-32 truncate text-small text-ink-subtle">{task.assignee.name}</span>
          <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="xs" />
        </span>
      )}
    </li>
  );
}

/**
 * Tasks grouped by who owns them. Ticks land immediately and roll back if
 * the server refuses; finishing the last one is a milestone worth marking.
 */
export function TaskList({ checklist }: { checklist: ChecklistDetail }) {
  const [state, setState] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(checklist.tasks.map((t) => [t.id, !!t.completedAt])),
  );
  const [, startTransition] = React.useTransition();
  const { kind, today, person } = checklist;

  const merged = checklist.tasks.map((t) => ({
    dueDate: t.dueDate,
    completedAt: state[t.id] ? (t.completedAt ?? "now") : null,
  }));
  const progress = checklistProgress(merged, today);
  const groups = ASSIGNEES.map((role) => ({
    role,
    tasks: checklist.tasks.filter((t) => t.assigneeRole === role),
  })).filter((g) => g.tasks.length > 0);

  function onToggle(task: ChecklistTaskRow, done: boolean) {
    setState((s) => ({ ...s, [task.id]: done }));
    startTransition(async () => {
      const r = await toggleTask({ taskId: task.id, done });
      if (!r.ok) {
        setState((s) => ({ ...s, [task.id]: !done }));
        toast.error("Couldn't update that task", { description: r.error });
        return;
      }
      if (r.data.complete) {
        celebrate();
        toast.success(
          kind === "ONBOARDING"
            ? `${person.name.split(" ")[0]} is fully onboarded`
            : "Offboarding complete",
          {
            description:
              kind === "ONBOARDING"
                ? "Every task is done. Welcome to the team, properly."
                : "Everything's wrapped up. Thank you for a thoughtful goodbye.",
          },
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-5 p-5">
        <ProgressRing
          value={progress.percent}
          size={72}
          stroke={7}
          tone={progress.complete ? "success" : "accent"}
          label={`${progress.done} of ${progress.total} tasks done`}
        >
          <span className="num text-body font-semibold text-ink">{progress.percent}%</span>
        </ProgressRing>
        <div>
          <p className="text-heading font-semibold text-ink">
            {progress.complete
              ? "All done"
              : `${progress.total - progress.done} ${progress.total - progress.done === 1 ? "task" : "tasks"} to go`}
          </p>
          <p className="text-small text-ink-muted">
            {progress.done} of {progress.total} done
          </p>
          {progress.overdue > 0 && (
            <Badge tone="danger" className="mt-1.5">
              <CalendarClock aria-hidden /> {progress.overdue} overdue
            </Badge>
          )}
        </div>
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {groups.map((g) => {
          const done = g.tasks.filter((t) => state[t.id]).length;
          return (
            <Card key={g.role}>
              <CardHeader
                title={ASSIGNEE_LABELS[kind][g.role as Assignee]}
                description={`${done} of ${g.tasks.length} done`}
              />
              <ul className="px-5 pb-2">
                {g.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    done={!!state[t.id]}
                    today={today}
                    onToggle={onToggle}
                  />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
