import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileSkeleton } from "@/components/ui/states";
import { TaskList } from "@/features/lifecycle/components/task-list";
import { checklistDetail } from "@/features/lifecycle/queries";
import { can } from "@/lib/rbac";
import { dbDate } from "@/lib/tz";
import { actorOf, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Checklist" };

async function Checklist({ params }: { params: PageProps<"/lifecycle/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await checklistDetail(user, id);
  if (!c) notFound();
  const onboarding = c.kind === "ONBOARDING";
  const when = format(dbDate(c.startDate), "EEEE, d MMMM");
  const started = c.startDate <= c.today;

  return (
    <div className="flex flex-col gap-6">
      {can(actorOf(user), "lifecycle.read") && (
        <Link
          href="/lifecycle"
          className="inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Everyone
        </Link>
      )}
      <header className="flex min-w-0 items-center gap-4">
        <Avatar name={c.person.name} src={c.person.avatarUrl} size="xl" />
        <div className="min-w-0">
          <p className="eyebrow">{onboarding ? "Onboarding" : "Offboarding"}</p>
          <h1 className="font-display-soft text-display font-medium text-ink">
            <Link href={`/people/${c.person.id}`} className="hover:text-accent">
              {c.isMine ? "Your checklist" : c.person.name}
            </Link>
          </h1>
          <p className="mt-1 text-body text-ink-muted">
            {c.person.title} · {c.person.department}
            {c.person.manager && ` · Reports to ${c.person.manager}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-ink-muted">
            {onboarding
              ? `${started ? "Joined" : "First day"} ${when}`
              : `${started ? "Left" : "Last day"} ${when}`}
            {!onboarding && c.person.exitReason && <Badge>{c.person.exitReason}</Badge>}
          </p>
        </div>
      </header>
      <TaskList key={c.tasks.map((t) => `${t.id}:${!!t.completedAt}`).join()} checklist={c} />
    </div>
  );
}

export default function ChecklistPage({ params }: PageProps<"/lifecycle/[id]">) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense fallback={<ProfileSkeleton />}>
        <Checklist params={params} />
      </Suspense>
    </PageContainer>
  );
}
