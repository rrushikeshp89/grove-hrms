import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { CardGridSkeleton } from "@/components/ui/states";
import { DepartmentsView } from "@/features/org/components/departments-view";
import { getDepartments } from "@/features/org/queries";
import { getJobOptions } from "@/features/people/queries";
import { can } from "@/lib/rbac";
import { actorOf, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Departments" };

async function Departments() {
  const user = await requireUser();
  const canManage = can(actorOf(user), "org.manage");
  const [departments, options] = await Promise.all([
    getDepartments(),
    canManage ? getJobOptions() : null,
  ]);
  return <DepartmentsView departments={departments} options={options} canManage={canManage} />;
}

export default function DepartmentsPage() {
  return (
    <PageContainer className="max-w-7xl">
      <Suspense
        fallback={
          <>
            <PageHeader
              eyebrow="Organization"
              title="Departments"
              description="How Northwind Grove is organized, who leads each team, and the job titles inside it."
            />
            <div className="mt-8">
              <CardGridSkeleton count={6} />
            </div>
          </>
        }
      >
        <Departments />
      </Suspense>
    </PageContainer>
  );
}
