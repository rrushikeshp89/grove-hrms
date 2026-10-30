"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  Cake,
  ChartLine,
  Megaphone,
  PartyPopper,
  Sparkles,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TrendArea } from "@/components/charts/charts";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { celebrate } from "@/components/ui/celebrate";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { formatDuration } from "@/features/attendance/logic/evaluate";
import { formatMoney, formatPercent } from "@/lib/format";
import { dbDate } from "@/lib/tz";

import type { HomeData, HomeMoment } from "../queries";
import { DayBar } from "./day-bar";

/* ─── Company pulse ────────────────────────────────────────────────────── */

export function CompanyPulse({ company }: { company: NonNullable<HomeData["company"]> }) {
  const { day } = company;
  const present = day.counts.in + day.counts.late + day.counts.out;
  return (
    <Card>
      <CardHeader
        title="Company at a glance"
        description="The last 12 months, and how today is going"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/analytics">
              <ChartLine aria-hidden /> Analytics
            </Link>
          </Button>
        }
      />
      <CardBody className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-5">
          <Stat
            variant="hero"
            label="Headcount"
            value={company.headcount}
            context={
              company.growth === 0
                ? "Same as a year ago"
                : `${company.growth > 0 ? "+" : ""}${company.growth} over the year`
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Attrition, annualized"
              value={company.attrition}
              format={(n) => formatPercent(n, 1)}
            />
            <Stat label="Joined, last 30 days" value={company.joiners} />
            <Stat label="Serving notice" value={company.onNotice} />
            <Stat
              label="Open roles"
              value={company.openRoles}
              suffix={`· ${company.openings} seats`}
            />
          </div>
        </div>
        <div
          role="img"
          aria-label={`Headcount over 12 months, from ${company.series[0]?.headcount} to ${company.headcount}`}
          className="h-44 md:h-auto md:min-h-44"
        >
          <TrendArea
            data={company.series}
            x="label"
            series={[{ key: "headcount", label: "Headcount" }]}
          />
        </div>
      </CardBody>
      <CardBody className="border-t border-hairline">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Today</p>
          <p className="text-small text-ink-muted">
            <span className="num font-medium text-ink">{present}</span> of {day.total} people have
            clocked in
          </p>
        </div>
        <DayBar counts={day.counts} total={day.total} />
      </CardBody>
    </Card>
  );
}

/* ─── Your month ───────────────────────────────────────────────────────── */

export function YourMonth({
  month,
  label,
}: {
  month: NonNullable<HomeData["month"]>;
  label: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Your month"
        description={`${label} so far`}
        action={<SeeAll href="/attendance">Timesheet</SeeAll>}
      />
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Days in" value={month.present} />
        <Stat label="Late arrivals" value={month.late} />
        <Stat
          label="Average day"
          value={month.averageMinutes}
          format={(n) => (month.averageMinutes ? formatDuration(Math.round(n)) : "—")}
        />
        <Stat
          label="Leave taken"
          value={month.leave}
          format={(n) => String(Math.round(n * 2) / 2)}
          suffix="days"
        />
      </CardBody>
    </Card>
  );
}

/* ─── Announcements ────────────────────────────────────────────────────── */

export function AnnouncementsCard({ data }: { data: HomeData["announcements"] }) {
  return (
    <Card>
      <CardHeader
        title="Announcements"
        description={data.unread ? `${data.unread} you haven't read` : "You're all caught up"}
        action={<SeeAll href="/announcements">All</SeeAll>}
      />
      {data.items.length === 0 ? (
        <EmptyState
          compact
          icon={Megaphone}
          title="Nothing new"
          description="Company news from the people team appears here."
        />
      ) : (
        <ul className="flex flex-col px-5 pt-1 pb-3">
          {data.items.map((a) => (
            <li key={a.id} className="border-b border-hairline last:border-0">
              <Link href="/announcements" className="block py-3 hover:text-accent">
                <span className="flex items-center gap-2 text-body font-medium text-ink">
                  {!a.read && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-accent"
                      role="img"
                      aria-label="Unread"
                    />
                  )}
                  <span className="truncate">{a.title}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-small text-ink-muted">
                  {a.preview}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─── Latest payslip ───────────────────────────────────────────────────── */

export function PayslipCard({ payslip }: { payslip: NonNullable<HomeData["payslip"]> }) {
  return (
    <Card>
      <CardHeader
        title="Latest payslip"
        description={payslip.label}
        action={<SeeAll href="/pay">Pay</SeeAll>}
      />
      <CardBody className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Net pay</p>
          <p className="font-display-soft num text-display font-medium text-ink">
            {formatMoney(payslip.netMinor)}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/pay/${payslip.id}`}>View</Link>
        </Button>
      </CardBody>
    </Card>
  );
}

/* ─── Moments ──────────────────────────────────────────────────────────── */

const CELEBRATED_KEY = "grove.celebrated-anniversary";

function when(m: HomeMoment) {
  if (m.kind === "joined")
    return m.daysAway === 0 ? "Joined today" : `Joined ${format(dbDate(m.day), "d MMM")}`;
  if (m.daysAway === 0) return "Today";
  if (m.daysAway === 1) return "Tomorrow";
  return format(dbDate(m.day), "EEE d MMM");
}

function what(m: HomeMoment) {
  if (m.kind === "birthday") return m.isMe ? "Your birthday" : "Birthday";
  if (m.kind === "anniversary") {
    const years = `${m.years} year${m.years === 1 ? "" : "s"}`;
    return m.isMe ? `Your ${years} at Northwind Grove` : `${years} at Northwind Grove`;
  }
  return m.isMe ? "Welcome aboard" : "New to the team";
}

const ICON = { birthday: Cake, anniversary: Sparkles, joined: Sprout } as const;

/**
 * Birthdays, work anniversaries and new joiners. Your own anniversary on
 * the day is a real milestone, so it gets the one celebration a year.
 */
export function Moments({ moments }: { moments: HomeMoment[] }) {
  React.useEffect(() => {
    const mine = moments.find((m) => m.isMe && m.kind === "anniversary" && m.daysAway === 0);
    if (!mine) return;
    const key = `${mine.day}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]");
    } catch {}
    if (seen.includes(key)) return;
    const t = setTimeout(() => {
      celebrate();
      toast.success(`Happy work anniversary`, { description: what(mine) + ". Thank you." });
      try {
        localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, key].slice(-10)));
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [moments]);

  return (
    <Card>
      <CardHeader
        title="Moments"
        description="Birthdays, anniversaries and new faces"
        action={<PartyPopper className="size-5 text-ink-subtle" aria-hidden />}
      />
      {moments.length === 0 ? (
        <EmptyState
          compact
          icon={Cake}
          satellites={[Sprout]}
          title="A quiet fortnight"
          description="No birthdays, anniversaries or new joiners in the next two weeks."
        />
      ) : (
        <ul className="flex flex-col px-5 pt-1 pb-3">
          {moments.map((m) => {
            const Icon = ICON[m.kind];
            const today = m.daysAway === 0;
            return (
              <li key={`${m.kind}-${m.personId}`} className="flex items-center gap-3 py-2.5">
                <span className="relative">
                  <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                  <span
                    aria-hidden
                    className={
                      today
                        ? "absolute -right-1.5 -bottom-1.5 grid size-4 place-items-center rounded-full bg-highlight text-highlight-fg ring-2 ring-surface"
                        : "absolute -right-1.5 -bottom-1.5 grid size-4 place-items-center rounded-full bg-surface-sunken text-ink-muted ring-2 ring-surface"
                    }
                  >
                    <Icon className="size-2.5" strokeWidth={2.25} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">
                    {m.isMe ? "You" : m.name}
                  </span>
                  <span className="block truncate text-small text-ink-muted">{what(m)}</span>
                </span>
                <span
                  className={
                    today ? "text-small font-medium text-ink" : "text-small text-ink-subtle"
                  }
                >
                  {when(m)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        {children} <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}
