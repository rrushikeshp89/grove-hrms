import { differenceInYears, format } from "date-fns";
import {
  Briefcase,
  ChevronRight,
  CirclePlus,
  Contact,
  Lock,
  Mail,
  MapPin,
  Network,
  Pencil,
  ShieldCheck,
  Sprout,
  UserPen,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { tenure } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/roles";

import type { ActivityItem } from "../activity";
import { displayName, EMPLOYMENT_LABELS, STATUS_META } from "../format";
import type { JobOptions, PersonRef, Profile } from "../queries";
import { EditableSection } from "./editable-section";
import { EmergencyContacts, JobForm, PersonalForm, PrivateForm } from "./profile-forms";
import { CopyButton, ProfileTabs, type ProfileTab } from "./profile-tabs";

function PersonLink({ person, aside }: { person: PersonRef; aside?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={`/people/${person.id}`}
        className="group -mx-2 flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-surface-hover"
      >
        <Avatar name={displayName(person)} src={person.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-ink group-hover:text-accent">
            {displayName(person)}
          </span>
          <span className="block truncate text-small text-ink-muted">
            {person.designation.title}
          </span>
        </span>
        {aside}
      </Link>
    </li>
  );
}

function PeopleList({ people, empty }: { people: PersonRef[]; empty: string }) {
  if (people.length === 0) return <p className="text-small text-ink-muted">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {people.map((p) => (
        <PersonLink
          key={p.id}
          person={p}
          aside={
            p.status !== "ACTIVE" && (
              <StatusPill tone={STATUS_META[p.status].tone}>
                {STATUS_META[p.status].label}
              </StatusPill>
            )
          }
        />
      ))}
    </ul>
  );
}

const ACTIVITY_ICON = {
  joined: Sprout,
  created: CirclePlus,
  job: Briefcase,
  profile: Pencil,
  private: Lock,
  contact: Contact,
} as const;

const ACTIVITY_TONE = {
  joined: "highlight",
  created: "accent",
  job: "accent",
  profile: "neutral",
  private: "neutral",
  contact: "info",
} as const;

function Activity({ items }: { items: ActivityItem[] }) {
  const timeline: TimelineItem[] = items.map((a) => ({
    id: a.id,
    icon: ACTIVITY_ICON[a.kind],
    tone: ACTIVITY_TONE[a.kind],
    title: (
      <>
        {a.title}
        {a.actor && <span className="text-ink-muted"> by {a.actor}</span>}
      </>
    ),
    body: a.detail,
    at: a.at,
    atLabel: format(new Date(a.at), "d MMM yyyy"),
  }));
  return <Timeline items={timeline} />;
}

export function ProfileView({
  profile,
  activity,
  jobOptions,
  tab,
}: {
  profile: Profile;
  activity: ActivityItem[];
  jobOptions: JobOptions | null;
  tab: string;
}) {
  const { employee: e, access, privateDetails: p, reportingLine, peers, isSelf } = profile;
  const name = displayName(e);
  const status = STATUS_META[e.status];
  const address = (p?.address ?? {}) as {
    area?: string | null;
    city?: string | null;
    state?: string | null;
  };
  const firstName = e.preferredName ?? e.firstName;

  const about = (
    <EditableSection
      title="About"
      canEdit={access.editPersonal}
      view={
        <div className="flex flex-col gap-4">
          {e.bio ? (
            <p className="text-body text-ink">{e.bio}</p>
          ) : (
            <p className="text-body text-ink-muted">
              {isSelf
                ? "Add a line about your work and what people can ask you about."
                : `${firstName} hasn't written a bio yet.`}
            </p>
          )}
          {e.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {e.skills.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
          )}
          {(e.pronouns || e.preferredName) && (
            <DescriptionList
              items={[
                ...(e.preferredName ? [{ term: "Goes by", detail: e.preferredName }] : []),
                ...(e.pronouns ? [{ term: "Pronouns", detail: e.pronouns }] : []),
              ]}
            />
          )}
        </div>
      }
      form={
        <PersonalForm
          defaults={{
            employeeId: e.id,
            preferredName: e.preferredName ?? "",
            pronouns: e.pronouns ?? "",
            bio: e.bio ?? "",
            skills: e.skills,
          }}
        />
      }
    />
  );

  const job = (
    <EditableSection
      title="Job"
      description={access.editJob ? undefined : "Maintained by HR"}
      canEdit={access.editJob && !!jobOptions}
      view={
        <DescriptionList
          items={[
            { term: "Designation", detail: e.designation.title },
            { term: "Department", detail: e.department.name },
            {
              term: "Reports to",
              detail: e.manager ? (
                <Link className="text-accent hover:underline" href={`/people/${e.manager.id}`}>
                  {displayName(e.manager)}
                </Link>
              ) : (
                "No one"
              ),
            },
            { term: "Location", detail: e.location.name },
            { term: "Employment", detail: EMPLOYMENT_LABELS[e.employmentType] },
            { term: "Status", detail: <StatusPill tone={status.tone}>{status.label}</StatusPill> },
            {
              term: "Joined",
              detail: `${format(e.joinDate, "d MMMM yyyy")} · ${tenure(e.joinDate, e.exitDate ?? new Date())}`,
            },
            { term: "Employee ID", detail: e.employeeCode, mono: true },
            ...(e.exitDate
              ? [
                  {
                    term: "Left",
                    detail: `${format(e.exitDate, "d MMMM yyyy")}${e.exitReason ? ` · ${e.exitReason}` : ""}`,
                  },
                ]
              : []),
            ...(e.user ? [{ term: "Grove access", detail: ROLE_LABELS[e.user.role] }] : []),
          ]}
        />
      }
      form={
        jobOptions && (
          <JobForm
            options={jobOptions}
            defaults={{
              employeeId: e.id,
              departmentId: e.departmentId,
              designationId: e.designationId,
              locationId: e.locationId,
              managerId: e.managerId,
              employmentType: e.employmentType,
              status: e.status,
              joinDate: e.joinDate.toISOString().slice(0, 10),
            }}
          />
        )
      }
    />
  );

  const privateSection = p && (
    <div className="grid gap-4 lg:grid-cols-2">
      <EditableSection
        title="Private details"
        description={
          isSelf
            ? "Only you, your managers and HR can see these."
            : `Visible to ${firstName}, their managers and HR.`
        }
        canEdit={access.editPrivate}
        view={
          <DescriptionList
            columns={1}
            items={[
              {
                term: "Mobile",
                detail: p.phone ? (
                  <span className="font-mono num text-small">{p.phone}</span>
                ) : (
                  "Not added"
                ),
              },
              { term: "Personal email", detail: p.personalEmail ?? "Not added" },
              {
                term: "Date of birth",
                detail: p.dateOfBirth
                  ? `${format(p.dateOfBirth, "d MMMM yyyy")} · ${differenceInYears(new Date(), p.dateOfBirth)} years`
                  : "Not added",
              },
              {
                term: "Lives in",
                detail:
                  [address.area, address.city, address.state].filter(Boolean).join(", ") ||
                  "Not added",
              },
            ]}
          />
        }
        form={
          <PrivateForm
            defaults={{
              employeeId: e.id,
              phone: p.phone ?? "",
              personalEmail: p.personalEmail ?? "",
              dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
              area: address.area ?? "",
              city: address.city ?? "",
              state: address.state ?? "",
            }}
          />
        }
      />
      <Card>
        <CardHeader
          title="Emergency contacts"
          description="Called in this order if something happens at work."
        />
        <CardBody>
          <EmergencyContacts
            employeeId={e.id}
            firstName={firstName}
            canEdit={access.editPrivate}
            contacts={p.emergencyContacts.map((c) => ({
              id: c.id,
              name: c.name,
              relationship: c.relationship,
              phone: c.phone,
              isPrimary: c.isPrimary,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );

  const team = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Reporting line" description="From the top of the company down" />
        <CardBody>
          {reportingLine.length === 0 ? (
            <p className="text-small text-ink-muted">
              {firstName} leads the company, so there&apos;s no one above.
            </p>
          ) : (
            <ol className="flex flex-col">
              {reportingLine.map((m, i) => (
                <li key={m.id} className="flex items-center">
                  <span
                    aria-hidden
                    className="w-5 shrink-0 text-ink-subtle"
                    style={{ marginLeft: i * 10 }}
                  >
                    {i > 0 && <ChevronRight className="size-3.5 rotate-45" />}
                  </span>
                  <ul className="flex-1">
                    <PersonLink person={m} />
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="Direct reports"
            description={
              e.reports.length
                ? `${e.reports.length} ${e.reports.length === 1 ? "person" : "people"}`
                : undefined
            }
          />
          <CardBody className="pt-2">
            <PeopleList people={e.reports} empty={`No one reports to ${firstName}.`} />
          </CardBody>
        </Card>
        {peers.length > 0 && (
          <Card>
            <CardHeader
              title="Works alongside"
              description={e.manager ? `Also reporting to ${displayName(e.manager)}` : undefined}
            />
            <CardBody className="pt-2">
              <PeopleList people={peers} empty="" />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );

  const tabs: ProfileTab[] = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            {about}
            {job}
          </div>
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Contact" />
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    {
                      term: "Work email",
                      detail: (
                        <a className="text-accent hover:underline" href={`mailto:${e.workEmail}`}>
                          {e.workEmail}
                        </a>
                      ),
                    },
                    ...(p?.phone
                      ? [
                          {
                            term: "Mobile",
                            detail: (
                              <a
                                className="font-mono num text-small hover:text-accent"
                                href={`tel:${p.phone}`}
                              >
                                {p.phone}
                              </a>
                            ),
                          },
                        ]
                      : []),
                    { term: "Location", detail: e.location.name },
                  ]}
                />
              </CardBody>
            </Card>
            {e.manager && (
              <Card>
                <CardHeader title="Manager" />
                <CardBody className="pt-1">
                  <ul>
                    <PersonLink person={e.manager} />
                  </ul>
                </CardBody>
              </Card>
            )}
            {!access.seePrivate && (
              <p className="flex items-start gap-2 px-1 text-small text-ink-subtle">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                Private details and history are visible to {firstName}, their managers and HR.
              </p>
            )}
          </div>
        </div>
      ),
    },
    { value: "team", label: "Team", content: team },
    ...(privateSection ? [{ value: "personal", label: "Personal", content: privateSection }] : []),
    ...(access.seePrivate
      ? [
          {
            value: "activity",
            label: "Activity",
            content: (
              <Card>
                <CardHeader title="History" description="Changes to this profile, newest first" />
                <CardBody>
                  <Activity items={activity} />
                </CardBody>
              </Card>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar name={name} src={e.avatarUrl} size="xl" className="size-24 text-display" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display-soft text-display font-medium text-ink">{name}</h1>
            {e.pronouns && <span className="text-body text-ink-subtle">{e.pronouns}</span>}
            {isSelf && <Badge tone="accent">You</Badge>}
          </div>
          <p className="mt-1 text-heading font-normal text-ink-muted">{e.designation.title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-ink-muted">
            {e.status !== "ACTIVE" && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
            <Link
              href={`/people?department=${e.department.code}`}
              className="inline-flex items-center gap-1.5 hover:text-accent"
            >
              <Users className="size-3.5" aria-hidden /> {e.department.name}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden /> {e.location.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-mono num">{e.employeeCode}</span>
              <CopyButton value={e.employeeCode} label="Copy employee ID" />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={`mailto:${e.workEmail}`}>
              <Mail aria-hidden /> Email
            </a>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/org?focus=${e.id}`}>
              <Network aria-hidden /> Org chart
            </Link>
          </Button>
          {isSelf && (
            <Button asChild variant="ghost">
              <Link href="/settings">
                <UserPen aria-hidden /> Account
              </Link>
            </Button>
          )}
        </div>
      </header>
      <ProfileTabs tabs={tabs} initial={tab} />
    </div>
  );
}
