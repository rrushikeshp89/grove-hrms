"use client";

import { BarSeries, ChartCard, Heatmap, Legend, TrendArea } from "@/components/charts/charts";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { formatNumber, formatPercent } from "@/lib/format";

import { clockLabel } from "../logic/metrics";
import type { AttendanceReport, LeaveReport } from "../queries";

const days = (n: number) => (Number.isInteger(n) ? formatNumber(n) : n.toFixed(1));

/* ─── Leave ────────────────────────────────────────────────────────────── */

export function LeaveTrends({ data }: { data: LeaveReport }) {
  const series = data.types.map((t, i) => ({
    key: t.code,
    label: t.name,
    color: `var(--chart-${(i % 6) + 1})`,
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard
        title="Leave taken"
        description="Approved working days off, by type"
        className="lg:col-span-2"
        height={260}
        actions={<Legend series={series} />}
        table={{
          columns: ["Period", ...data.types.map((t) => t.name)],
          rows: data.rows.map((r) => [r.label, ...data.types.map((t) => days(r[t.code] ?? 0))]),
        }}
      >
        <BarSeries data={data.rows} x="label" series={series} stacked format={days} />
      </ChartCard>
      <Card>
        <CardHeader
          title="Days off per person"
          description={`${days(data.total)} days across ${data.people} people`}
        />
        <ul className="flex flex-col gap-2 px-5 pt-4 pb-5">
          {data.perDepartment.map((d) => (
            <li key={d.name} className="flex items-baseline gap-3 text-small">
              <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
              <span className="text-caption text-ink-subtle">{d.people} people</span>
              <span className="w-10 text-right num font-medium text-ink">
                {d.perPerson.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ─── Attendance ───────────────────────────────────────────────────────── */

export function AttendancePatterns({ data }: { data: AttendanceReport }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard
        title="When people arrive"
        description="Clock-ins by weekday and time of day"
        className="lg:col-span-2"
        height={240}
        table={{
          columns: ["Day", ...data.grid.columns],
          rows: data.grid.rows.map((r, i) => [r, ...data.grid.values[i]!]),
        }}
      >
        <Heatmap
          rows={data.grid.rows}
          columns={data.grid.columns}
          values={data.grid.values}
          format={(n) => `${formatNumber(n)} arrivals`}
        />
      </ChartCard>
      <Card className="flex flex-col gap-5 p-5">
        <Stat
          variant="hero"
          label="On time"
          value={data.onTime}
          format={(n) => formatPercent(n)}
          context={`of ${formatNumber(data.days)} days worked`}
        />
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Typical arrival"
            value={data.averageArrival ?? 0}
            format={(n) => (data.averageArrival == null ? "—" : clockLabel(n))}
          />
          <Stat
            label="Average day"
            value={data.averageHours ?? 0}
            format={(n) => (data.averageHours == null ? "—" : `${n.toFixed(1)} h`)}
          />
        </div>
      </Card>
      <ChartCard
        title="On-time arrivals"
        description="Share of days started within the grace period"
        className="lg:col-span-3"
        height={200}
        table={{
          columns: ["Period", "On time", "Average day"],
          rows: data.trend.map((t) => [
            t.label,
            formatPercent(t.onTime),
            `${t.hours.toFixed(1)} h`,
          ]),
        }}
      >
        <TrendArea
          data={data.trend}
          x="label"
          format={(n) => formatPercent(n)}
          domain={[0.5, 1]}
          series={[{ key: "onTime", label: "On time" }]}
        />
      </ChartCard>
    </div>
  );
}
