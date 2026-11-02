import { MapPin, SearchX, UserRoundSearch, Users } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";

import { displayName, STATUS_META } from "../format";
import type { DirectoryPerson } from "../queries";
import { PeopleTable } from "./people-table";

export type DirectoryRow = Omit<DirectoryPerson, "joinDate"> & { joinDate: string };

function PersonCard({ person }: { person: DirectoryRow }) {
  const status = STATUS_META[person.status];
  const name = displayName(person);
  return (
    <Link
      href={`/people/${person.id}`}
      prefetch={false}
      className="group block h-full rounded-card focus-visible:outline-offset-4"
      aria-label={`${name}, ${person.designation.title}`}
    >
      <Card
        interactive
        className="flex h-full flex-col items-center gap-3 px-4 pt-6 pb-5 text-center"
      >
        <Avatar name={name} src={person.avatarUrl} size="lg" />
        <div className="w-full min-w-0">
          <p className="truncate text-body font-semibold text-ink group-hover:text-accent">
            {name}
          </p>
          <p className="truncate text-small text-ink-muted">{person.designation.title}</p>
        </div>
        <p className="flex max-w-full items-center gap-1 text-caption text-ink-subtle">
          <span className="min-w-0 truncate">{person.department.name}</span>
          <span aria-hidden>·</span>
          <MapPin className="size-3 shrink-0" aria-hidden />
          {person.location.isRemote ? "Remote" : "Bengaluru"}
        </p>
        {person.status !== "ACTIVE" && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
      </Card>
    </Link>
  );
}

/**
 * Rendered on the server: the grid has no state of its own, and a hundred
 * hydrated cards is most of what makes this page slow on a phone.
 */
export function PeopleResults({
  people,
  view,
  query,
  filtered,
}: {
  people: DirectoryRow[];
  view: "grid" | "table";
  query: string;
  filtered: boolean;
}) {
  if (people.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={query ? SearchX : UserRoundSearch}
          satellites={[Users]}
          title={query ? `No one matches “${query}”` : "No one fits those filters"}
          description={
            query
              ? "Try a first name, a team like “design”, a skill like “Kubernetes”, or an ID like GRV-0042."
              : filtered
                ? "Loosen a filter or clear them to see everyone."
                : "There's no one in the directory yet."
          }
        />
      </Card>
    );
  }

  if (view === "table") return <PeopleTable people={people} />;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {people.map((p) => (
        <li key={p.id} className="[contain-intrinsic-size:auto_11rem] [content-visibility:auto]">
          <PersonCard person={p} />
        </li>
      ))}
    </ul>
  );
}
