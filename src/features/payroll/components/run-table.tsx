"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";

import type { RunDetail } from "../queries";

export function RunTable({ rows }: { rows: RunDetail["payslips"] }) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => `${r.name} ${r.code} ${r.department}`.toLowerCase().includes(needle))
    : rows;
  return (
    <div>
      <div className="border-b border-hairline p-3">
        <Input
          type="search"
          aria-label="Search this run"
          placeholder="Search by name, ID or team"
          leadingIcon={<Search aria-hidden />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div
        className="max-h-[32rem] overflow-auto"
        tabIndex={0}
        role="region"
        aria-label="Payslips in this run"
      >
        <table className="w-full min-w-[40rem] text-left text-body">
          <caption className="sr-only">Payslips in this run</caption>
          <thead className="sticky top-0 bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th scope="col" className="h-10 px-4 font-medium">
                Person
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Paid days
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Gross
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Deductions
              </th>
              <th scope="col" className="px-4 text-right font-medium">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className="border-b border-hairline last:border-0 hover:bg-surface-hover"
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <Link href={`/pay/${r.id}`} className="flex items-center gap-3">
                    <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.name}</span>
                      <span className="block truncate text-small text-ink-muted">
                        {r.department}
                      </span>
                    </span>
                  </Link>
                </th>
                <td className="px-3 text-right num text-ink">
                  {r.paidDays}
                  <span className="text-ink-subtle"> / {r.workingDays}</span>
                  {r.lopDays > 0 && (
                    <Badge tone="warning" className="ml-2">
                      {r.lopDays} LOP
                    </Badge>
                  )}
                </td>
                <td className="px-3 text-right num text-ink">{formatMoney(r.grossMinor)}</td>
                <td className="px-3 text-right num text-ink-muted">
                  {formatMoney(r.deductionsMinor)}
                </td>
                <td className="px-4 text-right num font-medium text-ink">
                  {formatMoney(r.netMinor)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  No one matches &ldquo;{q}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
