import { FileStack, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/primitives";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import { DocumentList } from "@/features/documents/components/document-list";
import { PersonPicker } from "@/features/documents/components/person-picker";
import { UploadSheet } from "@/features/documents/components/upload-sheet";
import { folderFor, people, policies } from "@/features/documents/queries";
import { SectionTabs } from "@/features/time/components/section-tabs";
import { can } from "@/lib/rbac";
import { actorOf, requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Documents" };

async function Documents({
  searchParams,
}: {
  searchParams: PageProps<"/documents">["searchParams"];
}) {
  const user = await requirePermission("documents.read");
  const sp = await searchParams;
  const manage = can(actorOf(user), "documents.manage");
  const view =
    sp.view === "policies" ? "policies" : sp.view === "people" && manage ? "people" : "mine";
  const personId = typeof sp.person === "string" ? sp.person : null;
  const everyone = manage ? await people() : [];
  const subject = view === "people" ? everyone.find((p) => p.id === personId) : undefined;
  const docs =
    view === "policies"
      ? await policies(user)
      : view === "people"
        ? subject
          ? await folderFor(user, subject.id)
          : []
        : user.employee
          ? await folderFor(user, user.employee.id)
          : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-48 flex-1">
          <SectionTabs
            label="Document folders"
            current={
              view === "policies"
                ? "/documents?view=policies"
                : view === "people"
                  ? "/documents?view=people"
                  : "/documents"
            }
            tabs={[
              { href: "/documents", label: "My documents" },
              { href: "/documents?view=policies", label: "Company policies" },
              ...(manage ? [{ href: "/documents?view=people", label: "People" }] : []),
            ]}
          />
        </div>
        {(user.employee || manage) && (view === "mine" || manage) && (
          <UploadSheet
            manage={manage}
            people={everyone}
            defaultTarget={view === "policies" ? "policy" : "self"}
          />
        )}
      </div>
      {view === "people" && <PersonPicker people={everyone} value={subject?.id ?? null} />}
      <Card>
        <CardHeader
          title={
            view === "policies"
              ? "Policy library"
              : view === "people"
                ? subject
                  ? `${subject.name}'s folder`
                  : "A person's folder"
                : "Your folder"
          }
          description={
            view === "policies"
              ? "How we work, in writing. Everyone can read these."
              : view === "people"
                ? "Everything the people team can open"
                : "Private to you and the people team"
          }
        />
        {docs.length === 0 ? (
          view === "people" ? (
            <EmptyState
              compact
              icon={FolderOpen}
              title={subject ? "Nothing in this folder" : "Choose someone to open their folder"}
              description={
                subject
                  ? "Use Upload to add a document for them."
                  : "You'll see everything the people team can open for that person."
              }
            />
          ) : view === "policies" ? (
            <EmptyState
              compact
              icon={FileStack}
              title="No policies published yet"
              description="The people team adds policies here, and everyone can read them."
            />
          ) : (
            <EmptyState
              compact
              icon={FolderOpen}
              title="Your folder is empty"
              description="Keep certificates, ID proofs and signed contracts here. Only you and the people team can open them."
            />
          )
        ) : (
          <div className="mt-3 border-t border-hairline">
            <DocumentList docs={docs} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Company"
        title="Documents"
        description="Your files, and the policies everyone works by."
      />
      <div className="mt-8">
        <Suspense fallback={<TableSkeleton rows={5} columns={3} />}>
          <Documents searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
