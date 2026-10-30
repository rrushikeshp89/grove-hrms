"use client";

import { Coffee, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/choice";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { gentle } from "@/lib/motion";
import { clockTime } from "@/lib/tz";

import { TEAM_STATE_META } from "../format";
import { formatDuration } from "../logic/evaluate";
import type { TeamTodayRow } from "../queries";

type Filter = "all" | keyof typeof TEAM_STATE_META;

export function TeamToday({ rows, tz }: { rows: TeamTodayRow[]; tz?: string }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const counts = Object.fromEntries(
    (Object.keys(TEAM_STATE_META) as (keyof typeof TEAM_STATE_META)[]).map((k) => [
      k,
      rows.filter((r) => r.state === k).length,
    ]),
  ) as Record<keyof typeof TEAM_STATE_META, number>;
  const shown = filter === "all" ? rows : rows.filter((r) => r.state === filter);
  const options = [
    { value: "all" as const, label: `Everyone · ${rows.length}` },
    ...(Object.keys(TEAM_STATE_META) as (keyof typeof TEAM_STATE_META)[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({ value: k, label: `${TEAM_STATE_META[k].label} · ${counts[k]}` })),
  ];

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Coffee}
          title="No one reports to you"
          description="When people join your team, you'll see who's in, who's late and who's away here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto pb-1">
        <SegmentedControl<Filter>
          aria-label="Show"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={options}
        />
      </div>
      <Card>
        <ul className="divide-y divide-hairline">
          <AnimatePresence initial={false}>
            {shown.map((r) => {
              const meta = TEAM_STATE_META[r.state];
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={gentle}
                >
                  <Link
                    href={`/people/${r.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover"
                  >
                    <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {r.name}
                      </span>
                      <span className="flex items-center gap-1 truncate text-small text-ink-muted">
                        {r.title}
                        {r.remote && (
                          <>
                            <span aria-hidden>·</span>
                            <MapPin className="size-3" aria-hidden /> Remote
                          </>
                        )}
                      </span>
                    </span>
                    <span className="hidden text-right text-small text-ink-muted sm:block">
                      {r.clockInAt && (
                        <span className="font-mono num">
                          {clockTime(new Date(r.clockInAt), tz)}
                          {r.clockOutAt && ` – ${clockTime(new Date(r.clockOutAt), tz)}`}
                        </span>
                      )}
                      {r.lateByMinutes > 0 && (
                        <span className="block text-caption text-warning">
                          {formatDuration(r.lateByMinutes)} late
                        </span>
                      )}
                      {r.leave && <span className="block text-caption">{r.leave.type}</span>}
                      {r.holiday && r.state === "away" && (
                        <span className="block text-caption">{r.holiday}</span>
                      )}
                    </span>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </Card>
    </div>
  );
}
