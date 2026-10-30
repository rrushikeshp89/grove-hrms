import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { HolidaysAdmin } from "@/features/settings/components/holidays-admin";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { holidaysAdmin } from "@/features/settings/queries";
import { todayIn } from "@/lib/tz";
import { requirePermission, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Holidays" };

async function Tabs() {
  const user = await requireUser();
  return <SettingsTabs role={user.role} />;
}

async function Holidays({
  searchParams,
}: {
  searchParams: PageProps<"/settings/holidays">["searchParams"];
}) {
  await requirePermission("leave.configure");
  const sp = await searchParams;
  const thisYear = Number(todayIn().slice(0, 4));
  const year = typeof sp.year === "string" && /^20\d\d$/.test(sp.year) ? Number(sp.year) : thisYear;
  const location = typeof sp.location === "string" ? sp.location : null;
  const data = await holidaysAdmin(year, location);
  const href = (patch: { year?: number; location?: string | null }) => {
    const p = new URLSearchParams();
    p.set("year", String(patch.year ?? year));
    const loc = patch.location === undefined ? location : patch.location;
    if (loc) p.set("location", loc);
    return `/settings/holidays?${p}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Year" className="flex gap-1">
          {data.years.map((y) => (
            <Button key={y} asChild size="sm" variant={y === year ? "quiet" : "ghost"}>
              <Link href={href({ year: y })} aria-current={y === year ? "page" : undefined}>
                {y}
              </Link>
            </Button>
          ))}
        </nav>
        <nav aria-label="Location" className="flex gap-1">
          <Button asChild size="sm" variant={!location ? "quiet" : "ghost"}>
            <Link href={href({ location: null })} aria-current={!location ? "page" : undefined}>
              Everywhere
            </Link>
          </Button>
          {data.locations.map((l) => (
            <Button key={l.id} asChild size="sm" variant={l.id === location ? "quiet" : "ghost"}>
              <Link
                href={href({ location: l.id })}
                aria-current={l.id === location ? "page" : undefined}
              >
                {l.name}
              </Link>
            </Button>
          ))}
        </nav>
      </div>
      <HolidaysAdmin year={year} holidays={data.holidays} locations={data.locations} />
    </div>
  );
}

export default function HolidaySettingsPage({ searchParams }: PageProps<"/settings/holidays">) {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        eyebrow="Administration"
        title="Holidays"
        description="The company calendar. Holidays are skipped when leave is counted."
      />
      <div className="mt-8 flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <Tabs />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
          <Holidays searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
