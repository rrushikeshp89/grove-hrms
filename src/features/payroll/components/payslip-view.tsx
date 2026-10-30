import { Download } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/format";

import type { PayslipDetail } from "../queries";

const fmt = (n: number) => formatMoney(n);

function Lines({
  title,
  lines,
  total,
  totalLabel,
  prorated,
}: {
  title: string;
  lines: PayslipDetail["lines"];
  total: number;
  totalLabel: string;
  prorated: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="pt-2">
        <table className="w-full text-left text-body">
          <caption className="sr-only">{title}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr className="border-b border-hairline">
                <td className="py-2.5 text-ink-muted">None this month</td>
                <td className="py-2.5 text-right num text-ink">{fmt(0)}</td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.name} className="border-b border-hairline last:border-0">
                <th scope="row" className="py-2.5 font-normal text-ink">
                  {l.name}
                  {prorated && l.fullMinor !== l.amountMinor && (
                    <span className="block text-caption text-ink-subtle">
                      Full month {fmt(l.fullMinor)}
                    </span>
                  )}
                </th>
                <td className="py-2.5 text-right num text-ink">{fmt(l.amountMinor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong">
              <th scope="row" className="pt-3 text-left font-semibold text-ink">
                {totalLabel}
              </th>
              <td className="pt-3 text-right num font-semibold text-ink">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </CardBody>
    </Card>
  );
}

export function PayslipView({ slip, downloadHref }: { slip: PayslipDetail; downloadHref: string }) {
  const prorated = slip.paidDays < slip.workingDays;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Net pay</p>
          <p className="font-display-soft num text-display-xl font-medium text-ink">
            {fmt(slip.netMinor)}
          </p>
          <p className="mt-1 text-body text-ink-muted">
            {slip.label} · {slip.paidDays} of {slip.workingDays} days paid
            {slip.status !== "FINALIZED" && (
              <Badge tone="warning" className="ml-2">
                Not final yet
              </Badge>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href={downloadHref} prefetch={false}>
            <Download aria-hidden /> Download PDF
          </Link>
        </Button>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Lines
          title="Earnings"
          lines={slip.lines.filter((l) => l.kind === "EARNING")}
          total={slip.grossMinor}
          totalLabel="Gross earnings"
          prorated={prorated}
        />
        <Lines
          title="Deductions"
          lines={slip.lines.filter((l) => l.kind === "DEDUCTION")}
          total={slip.deductionsMinor}
          totalLabel="Total deductions"
          prorated={false}
        />
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody>
          <DescriptionList
            columns={3}
            items={[
              { term: "Employee", detail: slip.employee.name },
              { term: "Employee ID", detail: slip.employee.code, mono: true },
              { term: "Designation", detail: slip.employee.title },
              { term: "Department", detail: slip.employee.department },
              { term: "Location", detail: slip.employee.location },
              {
                term: "Loss of pay",
                detail: slip.lopDays ? `${slip.lopDays} days` : "None",
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
