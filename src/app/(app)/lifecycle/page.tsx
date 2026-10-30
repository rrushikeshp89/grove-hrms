import { ClipboardList, Settings2, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { ChecklistRow } from "@/features/lifecycle/components/checklist-row";
import { StartOffboarding } from "@/features/lifecycle/components/start-offboarding";
import { checklists, offboardingOptions } from "@/features/lifecycle/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { can } from "@/lib/rbac";
import { addDays, todayIn } from "@/lib/tz";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Onboarding" };

async function Lifecycle({
  searchParams,
}: {
  searchParams: PageProps<"/lifecycle">["searchParams"];
}) {
  const user = await requirePermission("lifecycle.read");
  const sp = await searchParams;
  const view = sp.view === "done" ? "done" : "active";
  const manage = can(actorOf(user), "lifecycle.manage");
  const today = todayIn();
  const [items, people] = await Promise.all([
    checklists(user, view),
    manage ? offboardingOptions() : null,
  ]);
  const sections = [
    { title: "Onboarding", kind: "ONBOARDING" as const },
    { title: "Offboarding", kind: "OFFBOARDING" as const },
  ]
    .map((s) => ({ ...s, items: items.filter((i) => i.kind === s.kind) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-48 flex-1">
          <SectionTabs
            label="Checklists"
            current={view === "done" ? "/lifecycle?view=done" : "/lifecycle"}
            tabs={[
              { href: "/lifecycle", label: "In progress" },
              { href: "/lifecycle?view=done", label: "Finished" },
            ]}
          />
        </div>
        {manage && people && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost">
              <Link href="/lifecycle/templates">
                <Settings2 aria-hidden /> Templates
              </Link>
            </Button>
            <StartOffboarding people={people} defaultLastDay={addDays(today, 30)} />
          </div>
        )}
      </div>
      {sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            satellites={[Sprout]}
            title={view === "done" ? "Nothing finished yet" : "No one's joining or leaving"}
            description={
              view === "done"
                ? "Finished checklists stay here as a record."
                : "When someone is hired, their onboarding checklist appears here."
            }
          />
        </Card>
      ) : (
        sections.map((s) => (
          <Card key={s.kind}>
            <CardHeader
              title={s.title}
              description={`${s.items.length} ${s.items.length === 1 ? "person" : "people"}`}
            />
            <ul className="mt-3 border-t border-hairline">
              {s.items.map((i) => (
                <ChecklistRow key={i.id} item={i} today={today} />
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

export default function LifecyclePage({ searchParams }: PageProps<"/lifecycle">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Talent"
        title="Onboarding"
        description="Everyone joining or leaving, and what's left to do."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={5} columns={3} />}>
          <Lifecycle searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
