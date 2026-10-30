"use client";

import { ArrowRight, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { displayName } from "@/features/people/format";
import type { JobOptions } from "@/features/people/queries";
import { cn } from "@/lib/utils";

import type { DepartmentRow } from "../queries";
import { DepartmentSheet, swatchClass } from "./department-sheet";

export function DepartmentsView({
  departments,
  options,
  canManage,
}: {
  departments: DepartmentRow[];
  options: JobOptions | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const current = departments.find((d) => d.id === editing) ?? null;
  const max = Math.max(...departments.map((d) => d.headcount), 1);

  return (
    <>
      <PageHeader
        eyebrow="Organization"
        title="Departments"
        description="How Northwind Grove is organized, who leads each team, and the job titles inside it."
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> New department
            </Button>
          )
        }
      />
      <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => (
          <li key={d.id}>
            <Card className="flex h-full flex-col">
              <div className="flex items-start gap-3 px-5 pt-5">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", swatchClass(d.colorToken))}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-heading font-semibold text-ink">
                    {d.name}
                    <Badge className="font-mono">{d.code}</Badge>
                  </h2>
                  {d.description && (
                    <p className="mt-1 text-small text-ink-muted">{d.description}</p>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${d.name}`}
                    onClick={() => setEditing(d.id)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>

              <div className="flex items-end justify-between gap-4 px-5 pt-5">
                <div>
                  <p className="font-display-soft num text-display leading-none font-medium text-ink">
                    {d.headcount}
                  </p>
                  <p className="mt-1 text-small text-ink-muted">
                    {d.headcount === 1 ? "person" : "people"} · {d.designations.length} titles
                  </p>
                </div>
                {d.employees.length > 0 && (
                  <AvatarStack
                    people={d.employees.map((e) => ({ name: displayName(e), src: e.avatarUrl }))}
                    max={4}
                  />
                )}
              </div>
              <div className="px-5 pt-3 pb-5">
                <div className="h-1 overflow-hidden rounded-full bg-surface-active">
                  <div
                    className={cn("h-full rounded-full", swatchClass(d.colorToken))}
                    style={{ width: `${(d.headcount / max) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline px-5 py-3">
                {d.head ? (
                  <Link
                    href={`/people/${d.head.id}`}
                    className="flex min-w-0 items-center gap-2 text-small hover:text-accent"
                  >
                    <Avatar name={displayName(d.head)} src={d.head.avatarUrl} size="xs" />
                    <span className="truncate">
                      <span className="text-ink">{displayName(d.head)}</span>
                      <span className="text-ink-subtle"> · Head</span>
                    </span>
                  </Link>
                ) : (
                  <span className="text-small text-ink-subtle">No head assigned</span>
                )}
                <Link
                  href={`/people?department=${d.code}`}
                  className="inline-flex shrink-0 items-center gap-1 text-small font-medium text-accent hover:underline"
                >
                  People <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {canManage && options && (
        <DepartmentSheet
          department={current}
          options={options}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </>
  );
}
