"use client";

import { ChartCard, Funnel } from "@/components/charts/charts";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { formatPercent } from "@/lib/format";

import type { HiringReport } from "../queries";

const STAGE_LABELS = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
} as const;

export function Hiring({ data }: { data: HiringReport }) {
  const applied = data.funnel[0]!.count;
  const hired = data.funnel.at(-1)!.count;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard
        title="Hiring funnel"
        description="Candidates who applied in this period, by the furthest stage they reached"
        className="lg:col-span-2"
        height={240}
        table={{
          columns: ["Stage", "Candidates", "From previous stage"],
          rows: data.funnel.map((s) => [
            STAGE_LABELS[s.stage],
            s.count,
            s.conversion == null ? "—" : formatPercent(s.conversion),
          ]),
        }}
      >
        <Funnel
          stages={data.funnel.map((s) => ({ label: STAGE_LABELS[s.stage], value: s.count }))}
        />
      </ChartCard>
      <Card className="flex flex-col gap-5 p-5">
        <Stat
          variant="hero"
          label="Hired"
          value={data.hires}
          context={
            applied
              ? `${formatPercent(hired / applied, 1)} of applicants this period made it`
              : "No applications in this period"
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Typical time to hire"
            value={data.daysToHire ?? 0}
            format={(n) => (data.daysToHire == null ? "—" : `${Math.round(n)} days`)}
          />
          <Stat label="Open roles" value={data.openRoles} suffix={`· ${data.openings} seats`} />
          <Stat label="In the pipeline now" value={data.inPipeline} />
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader
          title="Where candidates come from"
          description="Applications and hires by source"
        />
        <div className="overflow-x-auto px-5 pt-2 pb-4">
          <table className="w-full min-w-[28rem] text-left text-small">
            <caption className="sr-only">Applications and hires by source</caption>
            <thead>
              <tr className="border-b border-hairline text-ink-muted">
                <th scope="col" className="py-2 font-medium">
                  Source
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Applied
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Hired
                </th>
                <th scope="col" className="w-2/5 py-2 pl-6 font-medium">
                  Hire rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((s) => {
                const rate = s.applied ? s.hired / s.applied : 0;
                const best = Math.max(
                  ...data.sources.map((x) => (x.applied ? x.hired / x.applied : 0)),
                  0.01,
                );
                return (
                  <tr key={s.source} className="border-b border-hairline last:border-0">
                    <th scope="row" className="py-2 font-normal text-ink">
                      {s.source}
                    </th>
                    <td className="py-2 text-right num text-ink">{s.applied}</td>
                    <td className="py-2 text-right num text-ink">{s.hired}</td>
                    <td className="py-2 pl-6">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${(rate / best) * 100}%` }}
                          />
                        </span>
                        <span className="w-12 text-right num text-ink-muted">
                          {formatPercent(rate, 1)}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
