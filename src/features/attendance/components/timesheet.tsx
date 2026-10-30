"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Clock3, PenLine } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { clockTime, dbDate, isoOf } from "@/lib/tz";
import { cn } from "@/lib/utils";

import { DAY_META } from "../format";
import { formatDuration } from "../logic/evaluate";
import type { Timesheet as TimesheetData, TimesheetRow } from "../queries";
import { REGULARIZE_WINDOW_DAYS } from "../schemas";
import { RegularizeSheet } from "./regularize-sheet";

function monthHref(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return `/attendance?month=${isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, 1).slice(0, 7)}`;
}

function Notes({ row }: { row: TimesheetRow }) {
  const parts: string[] = [];
  if (row.holiday) parts.push(row.holiday);
  if (row.leave)
    parts.push(
      row.leave.portion < 1 ? `Half day of ${row.leave.type.toLowerCase()}` : row.leave.type,
    );
  if (row.lateByMinutes) parts.push(`${formatDuration(row.lateByMinutes)} late`);
  if (row.earlyByMinutes) parts.push(`left ${formatDuration(row.earlyByMinutes)} early`);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-muted">
      {parts.join(" · ")}
      {row.correction === "PENDING" && <Badge tone="warning">Correction pending</Badge>}
      {row.correction === "APPROVED" && <Badge tone="success">Corrected</Badge>}
    </span>
  );
}

export function Timesheet({
  data,
  year,
  month,
}: {
  data: TimesheetData;
  year: number;
  month: number;
}) {
  const [correcting, setCorrecting] = React.useState<TimesheetRow | null>(null);
  const tz = data.tz;
  const windowStart = (() => {
    const d = new Date(`${data.today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - REGULARIZE_WINDOW_DAYS);
    return d.toISOString().slice(0, 10);
  })();
  const canCorrect = (r: TimesheetRow) =>
    r.day <= data.today &&
    r.day >= windowStart &&
    r.day >= data.joinDate &&
    r.correction !== "PENDING" &&
    ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "IN_PROGRESS", "PARTIAL_LEAVE"].includes(r.kind);
  const isCurrentMonth = data.today.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`;
  const title = format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy");
  const rows = isCurrentMonth ? data.days.filter((d) => d.day <= data.today) : data.days;
  const visible = [...rows].reverse();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={title}
          description={isCurrentMonth ? "So far this month" : undefined}
          action={
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon-sm" aria-label="Previous month">
                <Link href={monthHref(year, month - 1)} scroll={false}>
                  <ChevronLeft />
                </Link>
              </Button>
              {!isCurrentMonth && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/attendance" scroll={false}>
                    This month
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                className={cn(isCurrentMonth && "pointer-events-none opacity-40")}
              >
                <Link
                  href={monthHref(year, month + 1)}
                  scroll={false}
                  aria-disabled={isCurrentMonth}
                  tabIndex={isCurrentMonth ? -1 : undefined}
                >
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-4 px-5 pt-4 pb-5 sm:grid-cols-4">
          <Stat label="Days in" value={data.summary.present} />
          <Stat label="Late arrivals" value={data.summary.late} />
          <Stat
            label="Average day"
            value={data.summary.averageMinutes}
            format={(n) => formatDuration(Math.round(n))}
          />
          <Stat
            label="Leave taken"
            value={data.summary.leave}
            format={(n) => (Math.round(n * 2) / 2).toString()}
            suffix="days"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Attendance for {title}</caption>
          <thead className="hidden sm:table-header-group">
            <tr className="border-b border-hairline bg-surface-sunken text-caption text-ink-muted">
              <th scope="col" className="h-10 px-cell font-medium">
                Day
              </th>
              <th scope="col" className="px-cell font-medium">
                Status
              </th>
              <th scope="col" className="px-cell font-medium">
                In
              </th>
              <th scope="col" className="px-cell font-medium">
                Out
              </th>
              <th scope="col" className="px-cell text-right font-medium">
                Worked
              </th>
              <th scope="col" className="px-cell font-medium">
                Notes
              </th>
              <th scope="col" className="px-cell">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const meta = DAY_META[r.kind];
              const muted = r.kind === "WEEKEND" || r.kind === "FUTURE" || r.kind === "NOT_JOINED";
              return (
                <tr
                  key={r.day}
                  className={cn(
                    "border-b border-hairline last:border-0",
                    "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 sm:table-row sm:p-0",
                    muted && "bg-surface-sunken/40 text-ink-subtle",
                    r.day === data.today && "bg-accent-subtle/40 text-ink",
                  )}
                >
                  <th
                    scope="row"
                    className="text-left text-body font-medium whitespace-nowrap sm:h-row sm:px-cell"
                  >
                    <span
                      className={cn(muted && r.day !== data.today ? "text-ink-subtle" : "text-ink")}
                    >
                      {format(dbDate(r.day), "EEE d MMM")}
                    </span>
                    {r.day === data.today && (
                      <span className="ml-2 text-caption text-accent">Today</span>
                    )}
                  </th>
                  <td className="justify-self-end sm:px-cell">
                    {meta ? (
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    ) : r.kind === "WEEKEND" ? (
                      <span className="text-small">Weekend</span>
                    ) : r.day === data.today && r.kind === "FUTURE" ? (
                      <StatusPill tone="neutral">Not in yet</StatusPill>
                    ) : null}
                  </td>
                  <td className="font-mono num text-small sm:px-cell">
                    <span className="text-ink-subtle sm:hidden">In </span>
                    {r.clockInAt ? clockTime(new Date(r.clockInAt), tz) : muted ? "" : "—"}
                  </td>
                  <td className="justify-self-end font-mono num text-small sm:justify-self-auto sm:px-cell">
                    <span className="text-ink-subtle sm:hidden">Out </span>
                    {r.clockOutAt ? (
                      clockTime(new Date(r.clockOutAt), tz)
                    ) : r.kind === "IN_PROGRESS" ? (
                      <Clock3
                        className="inline size-3.5 text-accent"
                        aria-label="Still clocked in"
                      />
                    ) : muted ? (
                      ""
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hidden text-right num text-small whitespace-nowrap sm:table-cell sm:px-cell">
                    {r.workedMinutes ? formatDuration(r.workedMinutes) : ""}
                  </td>
                  <td className="col-span-2 sm:px-cell">
                    <Notes row={r} />
                  </td>
                  <td className="col-span-2 sm:w-24 sm:px-cell sm:text-right">
                    {canCorrect(r) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCorrecting(r)}
                        aria-label={`Correct ${format(dbDate(r.day), "EEEE d MMMM")}`}
                      >
                        <PenLine aria-hidden /> Correct
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <RegularizeSheet
        day={correcting?.day ?? null}
        defaults={{
          clockIn: correcting?.clockInAt ? clockTime(new Date(correcting.clockInAt), tz) : "",
          clockOut: correcting?.clockOutAt ? clockTime(new Date(correcting.clockOutAt), tz) : "",
        }}
        onOpenChange={(o) => !o && setCorrecting(null)}
      />
    </div>
  );
}
