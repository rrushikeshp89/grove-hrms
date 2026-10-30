import { differenceInCalendarDays, format } from "date-fns";
import { CalendarDays, MapPin, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { db } from "@/lib/db";
import { dbDate, isoFromDbDate, todayIn } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Holidays" };

async function Holidays({
  searchParams,
}: {
  searchParams: PageProps<"/holidays">["searchParams"];
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIn();
  const thisYear = Number(today.slice(0, 4));
  const year = typeof sp.year === "string" && /^20\d\d$/.test(sp.year) ? Number(sp.year) : thisYear;

  const [locations, me, years] = await Promise.all([
    db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    user.employee
      ? db.employee.findUnique({ where: { id: user.employee.id }, select: { locationId: true } })
      : null,
    db.holiday.findMany({ distinct: ["date"], select: { date: true } }),
  ]);
  const locationId =
    typeof sp.location === "string" && locations.some((l) => l.id === sp.location)
      ? sp.location
      : (me?.locationId ?? locations[0]?.id);
  const location = locations.find((l) => l.id === locationId);
  const holidays = await db.holiday.findMany({
    where: {
      date: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) },
      OR: [{ locationId: null }, { locationId }],
    },
    orderBy: { date: "asc" },
  });
  const availableYears = [...new Set(years.map((y) => y.date.getUTCFullYear()))].sort();
  const next = holidays.find((h) => isoFromDbDate(h.date) >= today && !h.isOptional);
  const byMonth = new Map<string, typeof holidays>();
  for (const h of holidays) {
    const m = format(h.date, "MMMM");
    byMonth.set(m, [...(byMonth.get(m) ?? []), h]);
  }
  const href = (patch: { year?: number; location?: string }) =>
    `/holidays?year=${patch.year ?? year}&location=${patch.location ?? locationId}`;
  const daysToNext = next ? differenceInCalendarDays(next.date, dbDate(today)) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Year" className="flex gap-1">
          {availableYears.map((y) => (
            <Button key={y} asChild size="sm" variant={y === year ? "quiet" : "ghost"}>
              <Link href={href({ year: y })} aria-current={y === year ? "page" : undefined}>
                {y}
              </Link>
            </Button>
          ))}
        </nav>
        <nav aria-label="Location" className="flex gap-1">
          {locations.map((l) => (
            <Button key={l.id} asChild size="sm" variant={l.id === locationId ? "quiet" : "ghost"}>
              <Link
                href={href({ location: l.id })}
                aria-current={l.id === locationId ? "page" : undefined}
              >
                <MapPin aria-hidden /> {l.name}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      {next && year === thisYear && (
        <Card className="flex flex-col gap-4 border-highlight/40 bg-highlight-subtle/40 p-6 sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-highlight text-highlight-fg">
            <PartyPopper className="size-7" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="eyebrow">Next holiday</p>
            <p className="font-display-soft text-title font-medium text-ink">{next.name}</p>
            <p className="text-body text-ink-muted">
              {format(next.date, "EEEE, d MMMM")} ·{" "}
              {daysToNext === 0 ? "today" : daysToNext === 1 ? "tomorrow" : `in ${daysToNext} days`}
            </p>
          </div>
        </Card>
      )}

      {holidays.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={`No holidays published for ${year}`}
            description="HR publishes next year's calendar towards the end of this one."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...byMonth].map(([monthName, list]) => (
            <Card key={monthName} className="p-5">
              <h2 className="mb-3 eyebrow">{monthName}</h2>
              <ul className="flex flex-col gap-3">
                {list.map((h) => {
                  const iso = isoFromDbDate(h.date);
                  const past = iso < today;
                  return (
                    <li key={h.id} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid w-12 shrink-0 place-items-center rounded-control border py-1.5 text-center",
                          past ? "border-hairline bg-surface" : "border-hairline bg-surface-sunken",
                        )}
                      >
                        <span
                          className={cn(
                            "font-display-soft num text-heading leading-none font-medium",
                            past ? "text-ink-muted" : "text-ink",
                          )}
                        >
                          {format(h.date, "d")}
                        </span>
                        <span className="text-caption text-ink-subtle">
                          {format(h.date, "EEE")}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-body",
                            past ? "text-ink-muted" : "text-ink",
                          )}
                        >
                          {h.name}
                        </span>
                        <span className="flex flex-wrap gap-1.5 pt-0.5">
                          {h.locationId && <Badge tone="info">{location?.name} only</Badge>}
                          {h.isOptional && <Badge>Optional</Badge>}
                          {past && <span className="text-caption text-ink-subtle">Passed</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <p className="text-small text-ink-subtle">
        Optional holidays are working days; take one as casual leave if you&apos;d like the day off.
      </p>
    </div>
  );
}

export default function HolidaysPage({ searchParams }: PageProps<"/holidays">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Time"
        title="Holidays"
        description="The company calendar for each location."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
          <Holidays searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
