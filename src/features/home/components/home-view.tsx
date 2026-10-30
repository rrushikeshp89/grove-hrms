import { format } from "date-fns";
import { CalendarDays, CalendarPlus, Inbox, PartyPopper, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill, STATUS_TONES } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { ClockCard } from "@/features/attendance/components/clock-card";
import { formatDuration } from "@/features/attendance/logic/evaluate";
import { dueLabel } from "@/features/lifecycle/logic/checklist";
import { tenure } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/roles";
import { clockTime, dbDate, type ISODate } from "@/lib/tz";
import type { CurrentUser } from "@/server/session";

import type { HomeData, HomePerson } from "../queries";
import { DayBar } from "./day-bar";
import { Greeting } from "./greeting";
import { CompanyPulse, Moments, SeeAll, YourMonth } from "./widgets";

const STATUS_LABEL = {
  ONBOARDING: ["Onboarding", STATUS_TONES.onboarding],
  ACTIVE: ["Active", STATUS_TONES.active],
  ON_LEAVE: ["On leave", STATUS_TONES.onLeave],
  NOTICE: ["Notice period", STATUS_TONES.notice],
  EXITED: ["Exited", STATUS_TONES.exited],
} as const;

const displayName = (p: Pick<HomePerson, "firstName" | "lastName" | "preferredName">) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "Tue 3 Nov", "3 – 5 Nov", "28 Oct – 2 Nov". */
function shortRange(start: ISODate, end: ISODate) {
  const s = dbDate(start);
  const e = dbDate(end);
  if (start === end) return format(s, "EEE d MMM");
  if (start.slice(0, 7) === end.slice(0, 7)) return `${format(s, "d")} – ${format(e, "d MMM")}`;
  return `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
}

function PersonRow({ person, aside }: { person: HomePerson; aside?: React.ReactNode }) {
  const [label, tone] = STATUS_LABEL[person.status];
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={displayName(person)} src={person.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{displayName(person)}</p>
        <p className="truncate text-small text-ink-muted">{person.designation.title}</p>
      </div>
      {person.status !== "ACTIVE" && <StatusPill tone={tone}>{label}</StatusPill>}
      {aside}
    </li>
  );
}

/* ─── Approvals waiting on you ─────────────────────────────────────────── */

function NeedsYou({ approvals }: { approvals: NonNullable<HomeData["approvals"]> }) {
  return (
    <Card>
      <CardHeader
        title="Waiting on you"
        description={`${approvals.count} request${approvals.count === 1 ? "" : "s"} to decide`}
        action={<SeeAll href="/approvals">Open inbox</SeeAll>}
      />
      <ul className="flex flex-col px-5 pt-1 pb-3">
        {approvals.items.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 border-b border-hairline py-3 last:border-0"
          >
            <Avatar name={r.requester.name} src={r.requester.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">{r.requester.name}</p>
              <p className="truncate text-small text-ink-muted">
                {r.leave
                  ? `${r.leave.type} · ${shortRange(r.leave.start, r.leave.end)} · ${fmt(r.leave.days)} ${r.leave.days === 1 ? "day" : "days"}`
                  : r.correction
                    ? `Attendance correction · ${format(dbDate(r.correction.date), "EEE d MMM")}`
                    : "Request"}
              </p>
            </div>
            <span className="hidden text-small text-ink-subtle sm:inline">
              Sent {format(new Date(r.createdAt), "d MMM")}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─── Onboarding and offboarding tasks ─────────────────────────────────── */

function YourTasks({ tasks, today }: { tasks: HomeData["tasks"]; today: ISODate }) {
  return (
    <Card>
      <CardHeader
        title="Your tasks"
        description={`${tasks.count} open for people joining or leaving`}
      />
      <ul className="flex flex-col px-5 pt-1 pb-3">
        {tasks.items.map((t) => (
          <li key={t.id} className="border-b border-hairline last:border-0">
            <Link
              href={`/lifecycle/${t.checklistId}`}
              className="flex items-center gap-3 rounded-control py-2.5 hover:text-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{t.title}</span>
                <span className="block truncate text-small text-ink-muted">
                  {t.forSelf ? "Your " : `${t.person}'s `}
                  {t.kind === "ONBOARDING" ? "onboarding" : "offboarding"}
                </span>
              </span>
              <span
                className={
                  t.dueDate < today
                    ? "text-small font-medium text-danger"
                    : "text-small text-ink-subtle"
                }
              >
                {dueLabel(t.dueDate, today)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─── Your team's day (managers) ───────────────────────────────────────── */

const ATTENTION = {
  late: (p: { lateByMinutes: number }) => `${formatDuration(p.lateByMinutes)} late`,
  notYet: () => "Not in yet",
  leave: (p: { leave: string | null }) => p.leave ?? "On leave",
} as const;

function TeamDay({ team }: { team: NonNullable<HomeData["team"]> }) {
  return (
    <Card>
      <CardHeader
        title="Your team today"
        description={`${team.total} people across your teams`}
        action={<SeeAll href="/attendance/team">Team view</SeeAll>}
      />
      <CardBody className="flex flex-col gap-4">
        <DayBar counts={team.counts} total={team.total} />
        {team.attention.length > 0 && (
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {team.attention.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-body text-ink">{p.name}</span>
                <span className="text-small text-ink-muted">
                  {p.state === "late"
                    ? ATTENTION.late(p)
                    : p.state === "leave"
                      ? ATTENTION.leave(p)
                      : ATTENTION.notYet()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Your leave ───────────────────────────────────────────────────────── */

const RING_TONE = { EL: "accent", CL: "highlight", SL: "success" } as const;
const REQUEST_TONE = { PENDING: "warning", APPROVED: "success" } as const;

function YourLeave({ data }: { data: HomeData }) {
  return (
    <Card>
      <CardHeader
        title="Your leave"
        description={`Balances for ${data.today.slice(0, 4)}`}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/leave">
              <CalendarPlus aria-hidden /> Apply
            </Link>
          </Button>
        }
      />
      <CardBody>
        <ul className="grid grid-cols-3 gap-2">
          {data.balances.map((b) => {
            const total = b.summary.accrued + b.summary.carriedForward + b.summary.adjusted;
            return (
              <li key={b.typeId} className="flex flex-col items-center gap-2 text-center">
                <ProgressRing
                  value={total ? (b.summary.available / total) * 100 : 0}
                  size={64}
                  stroke={6}
                  tone={RING_TONE[b.code as keyof typeof RING_TONE] ?? "accent"}
                  label={`${b.name}: ${fmt(b.summary.available)} days left`}
                >
                  <span className="num text-heading font-semibold text-ink">
                    {fmt(b.summary.available)}
                  </span>
                </ProgressRing>
                <span className="text-small leading-tight text-ink-muted">{b.name}</span>
              </li>
            );
          })}
        </ul>
      </CardBody>
      <CardBody className="border-t border-hairline">
        <p className="mb-2 eyebrow">Coming up for you</p>
        {data.requests.length === 0 ? (
          <p className="text-small text-ink-muted">
            Nothing booked. A long weekend is closer than you think.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{r.type.name}</span>
                  <span className="block text-small text-ink-muted">
                    {shortRange(r.start, r.end)} · {fmt(r.days)} {r.days === 1 ? "day" : "days"}
                  </span>
                </span>
                <StatusPill tone={REQUEST_TONE[r.status as keyof typeof REQUEST_TONE]}>
                  {r.status === "PENDING" ? "Pending" : "Approved"}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── Team and holidays ────────────────────────────────────────────────── */

function TeamCard({ data }: { data: HomeData }) {
  const me = data.me!;
  if (me.reports.length > 0) {
    return (
      <Card>
        <CardHeader
          title="Your team"
          description={`${me.reports.length} direct report${me.reports.length === 1 ? "" : "s"}`}
          action={<Users className="size-5 text-ink-subtle" aria-hidden />}
        />
        <CardBody className="pt-1">
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {me.reports.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                aside={
                  <span className="hidden text-small text-ink-subtle sm:inline">
                    {tenure(p.joinDate)}
                  </span>
                }
              />
            ))}
          </ul>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Your team"
        action={<Users className="size-5 text-ink-subtle" aria-hidden />}
      />
      <CardBody className="pt-1">
        {me.manager && (
          <>
            <p className="mb-1 eyebrow">Manager</p>
            <ul>
              <PersonRow person={me.manager} />
            </ul>
          </>
        )}
        {data.teammates.length > 0 && (
          <>
            <p className="mt-4 mb-1 eyebrow">Teammates</p>
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {data.teammates.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function HolidaysCard({ holidays }: { holidays: HomeData["holidays"] }) {
  return (
    <Card>
      <CardHeader
        title="Coming up"
        description="Holidays for your location"
        action={<CalendarDays className="size-5 text-ink-subtle" aria-hidden />}
      />
      <CardBody className="pt-2">
        {holidays.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarDays}
            satellites={[PartyPopper]}
            title="No holidays left this year"
            description="Next year's calendar appears here as soon as HR publishes it."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span className="grid w-11 shrink-0 place-items-center rounded-control border border-hairline bg-surface-sunken py-1 text-center">
                  <span className="text-caption font-medium text-ink-subtle uppercase">
                    {format(h.date, "MMM")}
                  </span>
                  <span className="font-display-soft num text-heading leading-none font-medium text-ink">
                    {format(h.date, "d")}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{h.name}</span>
                  <span className="block text-small text-ink-subtle">{format(h.date, "EEEE")}</span>
                </span>
                {h.isOptional && <Badge>Optional</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ─── The greeting's one-line summary ──────────────────────────────────── */

function summaryFor(data: HomeData): string {
  const parts: string[] = [];
  const c = data.clock;
  if (c) {
    if (c.holiday) parts.push(`It's ${c.holiday}. Enjoy the day off.`);
    else if (c.leave?.portion === 1)
      parts.push(`You're on ${c.leave.type.toLowerCase()} today. Enjoy it.`);
    else if (!c.workDay) parts.push("It's the weekend. Nothing needs you here.");
    else if (c.clockInAt && c.clockOutAt)
      parts.push(`You clocked out at ${clockTime(new Date(c.clockOutAt), c.tz)}. Nice work today.`);
    else if (c.clockInAt)
      parts.push(`You've been in since ${clockTime(new Date(c.clockInAt), c.tz)}.`);
    else parts.push("You haven't clocked in yet.");
  }
  if (data.approvals?.count)
    parts.push(
      `${data.approvals.count} request${data.approvals.count === 1 ? " is" : "s are"} waiting on you.`,
    );
  else if (data.team)
    parts.push(
      `${data.team.counts.in + data.team.counts.late + data.team.counts.out} of your ${data.team.total} people are in.`,
    );
  if (data.company && !data.approvals?.count)
    parts.push(
      `${data.company.headcount} people at Northwind Grove, ${data.company.joiners} new this month.`,
    );
  const birthdays = data.moments.filter(
    (m) => m.kind === "birthday" && m.daysAway === 0 && !m.isMe,
  );
  if (birthdays.length)
    parts.push(
      birthdays.length === 1
        ? `It's ${birthdays[0]!.name.split(" ")[0]}'s birthday.`
        : `${birthdays.length} birthdays today.`,
    );
  return parts.join(" ") || "Here's what's happening today.";
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export function HomeView({ user, data }: { user: CurrentUser; data: HomeData }) {
  const me = data.me;
  const firstName = me?.preferredName ?? me?.firstName ?? user.name.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Greeting firstName={firstName} summary={summaryFor(data)} />
        <Badge tone="accent" size="md" className="self-start sm:self-auto">
          <ShieldCheck aria-hidden /> {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      {!me ? (
        <div className="flex flex-col gap-4">
          {data.company && <CompanyPulse company={data.company} />}
          <Card>
            <EmptyState
              icon={Inbox}
              satellites={[Users]}
              title="Your account isn't linked to an employee yet"
              description="HR links accounts to employee records. Once that's done, your attendance, leave and team show up here."
            />
          </Card>
        </div>
      ) : (
        // Phones read top to bottom: the clock, then what needs you, then the rest.
        // Wide screens keep the clock, moments and holidays in a side column.
        <div className="grid items-start gap-4 lg:grid-cols-3 lg:grid-rows-[auto_1fr]">
          {data.clock && (
            <section aria-label="Today" className="lg:col-start-3 lg:row-start-1">
              <ClockCard
                key={`${data.clock.today}-${data.clock.clockInAt}-${data.clock.clockOutAt}`}
                today={data.clock}
              />
            </section>
          )}
          <div className="flex flex-col gap-4 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {data.approvals && data.approvals.count > 0 && <NeedsYou approvals={data.approvals} />}
            {data.tasks.count > 0 && <YourTasks tasks={data.tasks} today={data.today} />}
            {data.company && <CompanyPulse company={data.company} />}
            {data.team && <TeamDay team={data.team} />}
            <YourLeave data={data} />
            {data.month && (
              <YourMonth month={data.month} label={format(dbDate(data.today), "MMMM")} />
            )}
            <TeamCard data={data} />
          </div>
          <div className="flex flex-col gap-4 lg:col-start-3 lg:row-start-2">
            <Moments moments={data.moments} />
            <HolidaysCard holidays={data.holidays} />
          </div>
        </div>
      )}
    </div>
  );
}
