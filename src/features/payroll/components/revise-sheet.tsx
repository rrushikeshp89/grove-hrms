"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from "@/components/ui/overlay";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/format";
import { addDays } from "@/lib/tz";

import { reviseSalary } from "../actions";
import { computePayslip, standardStructure } from "../logic/compute";
import type { StructureRow } from "../queries";
import { structureSchema, type StructureInput } from "../schemas";

export function ReviseSheet({
  person,
  today,
  onOpenChange,
}: {
  person: StructureRow | null;
  today: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const firstOfNext = React.useMemo(() => {
    const [y, m] = today.split("-").map(Number) as [number, number];
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }, [today]);
  const form = useForm<StructureInput, unknown, z.output<typeof structureSchema>>({
    resolver: zodResolver(structureSchema),
    values: {
      employeeId: person?.id ?? "",
      annualCtcRupees: person?.annualCtcMinor ? person.annualCtcMinor / 100 : 0,
      effectiveFrom: firstOfNext,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const ctc = Number(useWatch({ control: form.control, name: "annualCtcRupees" })) || 0;
  const preview = React.useMemo(
    () =>
      ctc >= 120_000
        ? computePayslip({ components: standardStructure(ctc * 100), workingDays: 22, lopDays: 0 })
        : null,
    [ctc],
  );

  const submit = form.handleSubmit(async () => {
    const r = await reviseSalary(form.getValues());
    if (!r.ok) {
      for (const [f, m] of Object.entries(r.fieldErrors ?? {}))
        form.setError(f as keyof StructureInput, { message: m[0] });
      if (!r.fieldErrors) toast.error("Salary not saved", { description: r.error });
      return;
    }
    toast.success("Salary revised", { description: "It applies from the date you chose." });
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Sheet open={!!person} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader
          title="Revise salary"
          description="Components follow the standard split. Past payslips never change."
        />
        <form onSubmit={submit} noValidate className="contents">
          <SheetBody className="grid content-start gap-4">
            {person && (
              <div className="flex items-center gap-3">
                <Avatar name={person.name} src={person.avatarUrl} size="md" />
                <div>
                  <p className="text-body font-medium text-ink">{person.name}</p>
                  <p className="text-small text-ink-muted">{person.title}</p>
                </div>
              </div>
            )}
            <Field label="Yearly CTC (₹)" error={errors.annualCtcRupees?.message}>
              <Input
                type="number"
                inputMode="numeric"
                step={1000}
                {...form.register("annualCtcRupees")}
              />
            </Field>
            <Field
              label="Effective from"
              hint={`Not before ${formatDate(addDays(today, 1))} if a month is already paid.`}
              error={errors.effectiveFrom?.message}
            >
              <Input type="date" {...form.register("effectiveFrom")} />
            </Field>
            {preview && (
              <div className="rounded-control border border-hairline bg-surface-sunken p-4">
                <p className="mb-2 eyebrow">A full month would look like</p>
                <ul className="flex flex-col gap-1.5 text-small">
                  {preview.lines.map((l) => (
                    <li key={l.name} className="flex justify-between gap-3">
                      <span className="text-ink-muted">{l.name}</span>
                      <span className="num text-ink">
                        {l.kind === "DEDUCTION" && "−"}
                        {formatMoney(l.amountMinor)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 border-t border-border-strong pt-1.5 font-medium">
                    <span className="text-ink">Net pay</span>
                    <span className="num text-ink">{formatMoney(preview.netMinor)}</span>
                  </li>
                </ul>
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Save aria-hidden /> Save revision
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** The people list with a Revise button per row. */
export function StructuresTable({ rows, today }: { rows: StructureRow[]; today: string }) {
  const [editing, setEditing] = React.useState<StructureRow | null>(null);
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => `${r.name} ${r.title} ${r.department}`.toLowerCase().includes(needle))
    : rows;
  return (
    <>
      <div className="border-b border-hairline p-3">
        <Input
          type="search"
          aria-label="Search people"
          placeholder="Search by name, title or team"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div
        className="max-h-[36rem] overflow-auto"
        tabIndex={0}
        role="region"
        aria-label="Salary structures"
      >
        <table className="w-full min-w-[34rem] text-left text-body">
          <caption className="sr-only">Salary structures</caption>
          <thead className="sticky top-0 bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th scope="col" className="h-10 px-4 font-medium">
                Person
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Yearly CTC
              </th>
              <th scope="col" className="px-3 font-medium">
                Effective from
              </th>
              <th scope="col" className="px-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-3">
                    <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.name}</span>
                      <span className="block truncate text-small text-ink-muted">{r.title}</span>
                    </span>
                  </span>
                </th>
                <td className="px-3 text-right num text-ink">
                  {r.annualCtcMinor ? (
                    formatMoney(r.annualCtcMinor)
                  ) : (
                    <span className="text-ink-subtle">Not set</span>
                  )}
                </td>
                <td className="px-3 text-small text-ink-muted">
                  {r.effectiveFrom ? formatDate(r.effectiveFrom) : ""}
                </td>
                <td className="px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(r)}
                    aria-label={`Revise salary for ${r.name}`}
                  >
                    Revise
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReviseSheet person={editing} today={today} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}
