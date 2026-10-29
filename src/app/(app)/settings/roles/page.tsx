import { Minus } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { TableSkeleton } from "@/components/ui/states";
import { PERMISSION_AREAS } from "@/features/roles/matrix";
import { db } from "@/lib/db";
import { GRANTS, PERMISSIONS, type Scope } from "@/lib/rbac";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "Roles & access" };

const SCOPE: Record<Scope, { label: string; tone: Tone }> = {
  own: { label: "Own", tone: "neutral" },
  team: { label: "Team", tone: "info" },
  all: { label: "Everyone", tone: "accent" },
};

const ROLE_SUMMARY = {
  EMPLOYEE: "Their own records, plus the directory.",
  TEAM_MANAGER: "Everything about the people who report to them, directly or not.",
  HR_MANAGER: "Company-wide people operations, without the audit log or role changes.",
  SUPER_ADMIN: "Everything, including security and access.",
} as const;

async function RoleCounts() {
  const counts = await db.user.groupBy({ by: ["role"], _count: { _all: true } });
  const byRole = new Map(counts.map((c) => [c.role, c._count._all]));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ROLES.map((role) => (
        <Card key={role} className="p-5">
          <Stat label={ROLE_LABELS[role]} value={byRole.get(role) ?? 0} suffix="people" />
          <p className="mt-2 text-small text-ink-muted">{ROLE_SUMMARY[role]}</p>
        </Card>
      ))}
    </div>
  );
}

function Matrix() {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Permissions by role"
        description="Own: records about yourself. Team: you and everyone below you in the org chart. Everyone: the whole company."
      />
      <div
        className="mt-4 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Permissions by role, scrollable"
      >
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">Which permissions each role has, and at what scope</caption>
          <thead>
            <tr className="border-y border-hairline bg-surface-sunken">
              <th scope="col" className="h-10 px-5 text-caption font-medium text-ink-muted">
                Permission
              </th>
              {ROLES.map((r) => (
                <th
                  key={r}
                  scope="col"
                  className="h-10 px-3 text-center text-caption font-medium text-ink-muted"
                >
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_AREAS.map(({ area, permissions }) => (
            <tbody key={area}>
              <tr>
                <th
                  colSpan={ROLES.length + 1}
                  scope="colgroup"
                  className="px-5 pt-5 pb-1.5 text-left eyebrow"
                >
                  {area}
                </th>
              </tr>
              {permissions.map((p) => (
                <tr key={p} className="border-b border-hairline last:border-0">
                  <th scope="row" className="h-row px-5 text-body font-normal text-ink">
                    {PERMISSIONS[p]}
                  </th>
                  {ROLES.map((r) => {
                    const scope = GRANTS[r][p];
                    return (
                      <td key={r} className="px-3 text-center">
                        {scope ? (
                          <Badge tone={SCOPE[scope].tone}>{SCOPE[scope].label}</Badge>
                        ) : (
                          <>
                            <Minus className="mx-auto size-4 text-ink-subtle" aria-hidden />
                            <span className="sr-only">No access</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <CardBody className="border-t border-hairline text-small text-ink-muted">
        These rules are checked on the server for every page and action, so hiding a button is never
        the only protection.
      </CardBody>
    </Card>
  );
}

/** One gate for the whole page, before anything role-specific streams. */
async function RolesContent() {
  await requirePermission("roles.read");
  return (
    <div className="mt-8 flex flex-col gap-6">
      <Suspense fallback={<div className="h-32" aria-busy />}>
        <RoleCounts />
      </Suspense>
      <Matrix />
    </div>
  );
}

export default function RolesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Roles & access"
        description="Grove has four roles. Each permission applies at a scope: your own records, your team, or everyone."
      />
      <Suspense
        fallback={
          <div className="mt-8">
            <TableSkeleton rows={8} columns={5} />
          </div>
        }
      >
        <RolesContent />
      </Suspense>
    </PageContainer>
  );
}
