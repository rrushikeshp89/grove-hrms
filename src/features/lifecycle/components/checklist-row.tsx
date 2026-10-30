import { format } from "date-fns";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { dbDate, type ISODate } from "@/lib/tz";

import { dueLabel } from "../logic/checklist";
import type { ChecklistSummary } from "../queries";

export function ChecklistRow({ item, today }: { item: ChecklistSummary; today: ISODate }) {
  const { person, progress, next, kind } = item;
  const started = item.startDate <= today;
  const when = format(dbDate(item.startDate), "EEE d MMM");
  const anchor =
    kind === "ONBOARDING"
      ? started
        ? `Joined ${when}`
        : `Joins ${when}`
      : started
        ? `Left ${when}`
        : `Last day ${when}`;
  return (
    <li className="relative flex flex-col gap-3 border-b border-hairline px-5 py-4 transition-colors last:border-0 hover:bg-surface-hover sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.name} src={person.avatarUrl} size="md" />
        <div className="min-w-0">
          <Link
            href={`/lifecycle/${item.id}`}
            className="block truncate text-body font-medium text-ink after:absolute after:inset-0"
          >
            {person.name}
          </Link>
          <p className="truncate text-small text-ink-muted">
            {person.title} · {anchor}
          </p>
        </div>
      </div>
      <div className="min-w-0 sm:w-64">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-small">
          <span className="truncate text-ink-muted">
            {next
              ? `Next: ${next.title}`
              : item.completedAt
                ? `Finished ${format(new Date(item.completedAt), "d MMM")}`
                : "All done"}
          </span>
          <span className="shrink-0 num font-medium text-ink">
            {progress.done}/{progress.total}
          </span>
        </div>
        <ProgressBar
          value={progress.percent}
          label={`${person.name}: ${progress.done} of ${progress.total} tasks done`}
        />
      </div>
      <div className="flex w-28 shrink-0 sm:justify-end">
        {progress.overdue > 0 ? (
          <Badge tone="danger">{progress.overdue} overdue</Badge>
        ) : next ? (
          <span className="text-small whitespace-nowrap text-ink-subtle">
            {dueLabel(next.dueDate, today)}
          </span>
        ) : null}
      </div>
    </li>
  );
}
