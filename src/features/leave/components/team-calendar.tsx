import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Palmtree } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { dbDate, isoOf, isoWeekday, type ISODate } from "@/lib/tz";
import { cn } from "@/lib/utils";

import type { teamCalendar } from "../queries";

type Data = Awaited<ReturnType<typeof teamCalendar>>;

function monthHref(year: number, month: number, dept: string | null) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const m = isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, 1).slice(0, 7);
  return `/leave/calendar?month=${m}${dept ? `&department=${dept}` : ""}`;
}

/**
 * People down the side, days across. Full days are filled, half days are
 * half filled, and pending requests are outlined so nobody plans around
 * leave that isn't approved yet.
 */
export function TeamCalendar({
  data,
  year,
  month,
  today,
  department,
  departments,
}: {
  data: Data;
  year: number;
  month: number;
  today: ISODate;
  department: string | null;
  departments: { code: string; name: string }[];
}) {
  const holidays = new Map(data.holidays.filter((h) => !h.optional).map((h) => [h.day, h.name]));
  const awayCount = data.people.filter((p) => Object.keys(p.away).length > 0).length;
  const title = format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy");

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-heading font-semibold text-ink">{title}</h2>
          <p className="text-small text-ink-muted">
            {awayCount} of {data.people.length}{" "}
            {data.people.length === 1 ? "person has" : "people have"} leave this month
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canFilterDepartments && (
            <nav aria-label="Department" className="flex flex-wrap gap-1">
              <Button asChild size="sm" variant={department ? "ghost" : "quiet"}>
                <Link href={`/leave/calendar?month=${year}-${String(month).padStart(2, "0")}`}>
                  Everyone
                </Link>
              </Button>
              {departments.map((d) => (
                <Button
                  key={d.code}
                  asChild
                  size="sm"
                  variant={department === d.code ? "quiet" : "ghost"}
                >
                  <Link
                    href={`/leave/calendar?month=${year}-${String(month).padStart(2, "0")}&department=${d.code}`}
                  >
                    {d.name}
                  </Link>
                </Button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Previous month">
              <Link href={monthHref(year, month - 1, department)} scroll={false}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon-sm" aria-label="Next month">
              <Link href={monthHref(year, month + 1, department)} scroll={false}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {data.people.length === 0 ? (
        <EmptyState
          compact
          icon={Palmtree}
          title="No one to show"
          description="Pick another department or month."
        />
      ) : (
        <div
          className="mt-4 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={`Team leave for ${title}, scrollable`}
        >
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Who is on leave each day in {title}</caption>
            <thead>
              <tr className="border-y border-hairline bg-surface-sunken">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-52 bg-surface-sunken px-4 py-2 text-caption font-medium text-ink-muted"
                >
                  Person
                </th>
                {data.days.map((d) => {
                  const weekend = isoWeekday(d) >= 6;
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={cn(
                        "min-w-8 px-0 py-1.5 text-center text-caption font-medium",
                        weekend ? "text-ink-subtle" : "text-ink-muted",
                        d === today && "text-accent",
                      )}
                      title={holidays.get(d)}
                    >
                      <span className="block">{format(dbDate(d), "EEEEE")}</span>
                      <span className={cn("block num", d === today && "font-semibold")}>
                        {Number(d.slice(8))}
                      </span>
                      {holidays.has(d) && (
                        <span
                          aria-hidden
                          className="mx-auto mt-0.5 block size-1 rounded-full bg-highlight"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.people.map((p) => (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal"
                  >
                    <Link
                      href={`/people/${p.id}`}
                      className="flex items-center gap-2.5 hover:text-accent"
                    >
                      <Avatar name={p.name} src={p.avatarUrl} size="xs" />
                      <span className="min-w-0">
                        <span className="block truncate text-small font-medium text-ink">
                          {p.name}
                        </span>
                        <span className="block truncate text-caption text-ink-subtle">
                          {p.title}
                        </span>
                      </span>
                    </Link>
                  </th>
                  {data.days.map((d) => {
                    const a = p.away[d];
                    const weekend = isoWeekday(d) >= 6;
                    const holiday = holidays.get(d);
                    return (
                      <td
                        key={d}
                        className={cn(
                          "h-11 p-0.5",
                          (weekend || holiday) && "bg-surface-sunken/70",
                          d === today && "bg-accent-subtle/40",
                        )}
                      >
                        {a && (
                          <span
                            title={`${a.type}${a.pending ? " (pending)" : ""}${a.portion < 1 ? ", half day" : ""}`}
                            className={cn(
                              "block h-full rounded-sm",
                              a.pending
                                ? "border-2 border-dashed border-highlight bg-highlight-subtle/50"
                                : "bg-highlight",
                              a.portion < 1 && "h-1/2 translate-y-1/2",
                            )}
                          >
                            <span className="sr-only">
                              {p.name}: {a.type}
                              {a.pending ? ", pending" : ""}
                              {a.portion < 1 ? ", half day" : ""}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-5 border-t border-hairline px-5 py-3 text-caption text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-xs bg-highlight" /> On leave
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-xs border-2 border-dashed border-highlight" />{" "}
          Pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-3 rounded-xs bg-highlight" /> Half day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-highlight" /> Holiday
        </span>
      </div>
    </Card>
  );
}
