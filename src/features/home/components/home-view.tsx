import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  Inbox,
  MapPin,
  PartyPopper,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill, STATUS_TONES } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { tenure } from "@/lib/dates";
import { GRANTS, PERMISSIONS, type Permission, type Scope } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/roles";
import type { CurrentUser } from "@/server/session";

import type { HomeData, HomePerson } from "../queries";
import { Greeting } from "./greeting";

const STATUS_LABEL = {
  ONBOARDING: ["Onboarding", STATUS_TONES.onboarding],
  ACTIVE: ["Active", STATUS_TONES.active],
  ON_LEAVE: ["On leave", STATUS_TONES.onLeave],
  NOTICE: ["Notice period", STATUS_TONES.notice],
  EXITED: ["Exited", STATUS_TONES.exited],
} as const;

const displayName = (p: Pick<HomePerson, "firstName" | "lastName" | "preferredName">) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

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

function ProfileCard({ me }: { me: NonNullable<HomeData["me"]> }) {
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-col items-center gap-3 pt-6 text-center">
        <Avatar name={displayName(me)} src={me.avatarUrl} size="xl" />
        <div>
          <p className="font-display-soft text-title font-medium text-ink">{displayName(me)}</p>
          <p className="text-body text-ink-muted">{me.designation.title}</p>
        </div>
        <p className="flex items-center gap-1.5 text-small text-ink-subtle">
          <MapPin className="size-3.5" aria-hidden />
          {me.department.name} · {me.location.name}
        </p>
      </CardBody>
      <CardBody className="border-t border-hairline">
        <DescriptionList
          columns={1}
          className="gap-y-3"
          items={[
            { term: "Employee ID", detail: me.employeeCode, mono: true },
            {
              term: "Joined",
              detail: `${format(me.joinDate, "d MMM yyyy")} · ${tenure(me.joinDate)}`,
            },
            {
              term: "Reports to",
              detail: me.manager
                ? displayName(me.manager)
                : "No one. You're at the top of the org chart.",
            },
          ]}
        />
      </CardBody>
    </Card>
  );
}

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
          <ul className="divide-y divide-hairline">
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
            <ul className="divide-y divide-hairline">
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

function CompanyCard({ company }: { company: NonNullable<HomeData["company"]> }) {
  const max = Math.max(...company.departments.map((d) => d.count), 1);
  return (
    <Card>
      <CardHeader title="Company at a glance" description="Everyone currently employed" />
      <CardBody className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-6">
          <Stat variant="hero" label="Headcount" value={company.active} context="people" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Joined, last 30 days" value={company.joiners} />
            <Stat label="Serving notice" value={company.onNotice} />
          </div>
        </div>
        <div>
          <p className="mb-3 eyebrow">By department</p>
          <ul className="flex flex-col gap-2.5">
            {company.departments.map((d) => (
              <li
                key={d.id}
                className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-small"
              >
                <span className="truncate text-ink-muted">{d.name}</span>
                <ProgressBar value={(d.count / max) * 100} label={`${d.name}: ${d.count} people`} />
                <span className="text-right num font-medium text-ink">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardBody>
      <CardBody className="border-t border-hairline">
        <p className="mb-1 inline-flex items-center gap-1.5 eyebrow">
          <UserPlus className="size-3.5" aria-hidden /> Newest joiners
        </p>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {company.recent.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              aside={
                <span className="text-small text-ink-subtle">{format(p.joinDate, "d MMM")}</span>
              }
            />
          ))}
        </ul>
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

const SCOPE_LABEL: Record<Scope, string> = {
  own: "for yourself",
  team: "for your team",
  all: "company-wide",
};

function AccessCard({ user }: { user: CurrentUser }) {
  const grants = Object.entries(GRANTS[user.role]) as [Permission, Scope][];
  const shown = grants.filter(([p]) => p !== "employee.read").slice(0, 8);
  return (
    <Card>
      <CardHeader
        title="What you can do"
        description={`As ${ROLE_LABELS[user.role]}, checked on the server for every request`}
        action={<ShieldCheck className="size-5 text-ink-subtle" aria-hidden />}
      />
      <CardBody className="pt-2">
        <ul className="flex flex-col gap-2">
          {shown.map(([p, scope]) => (
            <li key={p} className="flex items-start gap-2 text-small">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              <span className="text-ink">
                {PERMISSIONS[p]} <span className="text-ink-subtle">{SCOPE_LABEL[scope]}</span>
              </span>
            </li>
          ))}
        </ul>
        {grants.length > shown.length + 1 && (
          <p className="mt-3 text-small text-ink-subtle">
            and {grants.length - shown.length - 1} more
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function HomeView({ user, data }: { user: CurrentUser; data: HomeData }) {
  const me = data.me;
  const firstName = me?.preferredName ?? me?.firstName ?? user.name.split(" ")[0] ?? "there";
  const reports = me?.reports.length ?? 0;
  const summary = data.company
    ? `${data.company.active} people across ${data.company.departments.length} departments, ${data.company.joiners} joined in the last 30 days.`
    : reports > 0
      ? `You look after ${reports} people. Here's your team and what's coming up.`
      : "Here's your team and what's coming up.";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Greeting firstName={firstName} summary={summary} />
        <Badge tone="accent" size="md" className="self-start sm:self-auto">
          <ShieldCheck aria-hidden /> {ROLE_LABELS[user.role]}
        </Badge>
      </div>

      {!me ? (
        <Card>
          <EmptyState
            icon={Inbox}
            satellites={[Users]}
            title="Your account isn't linked to an employee yet"
            description="HR links accounts to employee records. Once that's done, your profile and team show up here."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            <ProfileCard me={me} />
            <HolidaysCard holidays={data.holidays} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-2">
            {data.company && <CompanyCard company={data.company} />}
            <TeamCard data={data} />
            <AccessCard user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
