import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { TableSkeleton } from "@/components/ui/states";
import { TemplateEditor } from "@/features/lifecycle/components/template-editor";
import { templates } from "@/features/lifecycle/queries";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Checklist templates" };

async function Templates() {
  await requirePermission("lifecycle.manage");
  const rows = await templates();
  return (
    <div className="flex flex-col gap-6">
      {rows.map((t) => (
        <TemplateEditor key={t.id} template={t} />
      ))}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <PageContainer className="max-w-5xl">
      <Link
        href="/lifecycle"
        className="mb-3 inline-flex items-center gap-1 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Onboarding
      </Link>
      <PageHeader
        eyebrow="Talent"
        title="Checklist templates"
        description="What happens when someone joins or leaves. Changes apply to new checklists; anything running keeps its tasks."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={8} columns={3} />}>
          <Templates />
        </Suspense>
      </div>
    </PageContainer>
  );
}
