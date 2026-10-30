"use client";

import { BarSeries, ChartCard, Donut, Legend, TrendArea } from "@/components/charts/charts";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Stat } from "@/components/ui/stat";
import { EMPLOYMENT_LABELS } from "@/features/people/format";
import { formatNumber, formatPercent } from "@/lib/format";

import type { PeopleReport } from "../queries";

const pct1 = (n: number) => formatPercent(n, 1);

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

/** The hero: one number the whole page is anchored on, and its shape over time. */
export function HeadcountOverview({ data, label }: { data: PeopleReport; label: string }) {
  const first = data.attrition.opening;
  const last = data.attrition.closing;
  const net = last - first;
  return (
    <ChartCard
      title="Headcount"
      description={`People employed at the end of each period, ${label}`}
      className="lg:col-span-2"
      height={220}
      table={{
        columns: ["Period", "Headcount", "Joined", "Left"],
        rows: data.series.map((p) => [p.label, p.headcount, p.joiners, p.leavers]),
      }}
    >
      <div className="grid h-full gap-6 sm:grid-cols-[12rem_1fr]">
        <div className="flex flex-col justify-between gap-4">
          <Stat
            variant="hero"
            label="Today's team"
            value={last}
            context={
              <span>
                {net === 0 ? "No change" : `${signed(net)} since the start`} ·{" "}
                {formatNumber(data.joiners)} joined, {formatNumber(data.attrition.leavers)} left
              </span>
            }
          />
          <Stat label="Working remotely" value={data.remote} suffix={`of ${last}`} />
        </div>
        <TrendArea
          data={data.series}
          x="label"
          series={[{ key: "headcount", label: "Headcount" }]}
        />
      </div>
    </ChartCard>
  );
}

export function JoinersLeavers({ data }: { data: PeopleReport }) {
  const series = [
    { key: "joiners", label: "Joined", color: "var(--chart-1)" },
    { key: "leavers", label: "Left", color: "var(--chart-3)" },
  ];
  return (
    <ChartCard
      title="Arrivals and departures"
      description="Who joined and who left in each period"
      height={220}
      actions={<Legend series={series} />}
      table={{
        columns: ["Period", "Joined", "Left"],
        rows: data.series.map((p) => [p.label, p.joiners, p.leavers]),
      }}
    >
      <BarSeries data={data.series} x="label" series={series} />
    </ChartCard>
  );
}

export function DepartmentMix({ data, filtered }: { data: PeopleReport; filtered: boolean }) {
  const types = data.employmentTypes.map((t) => ({
    label: EMPLOYMENT_LABELS[t.key as keyof typeof EMPLOYMENT_LABELS] ?? t.key,
    value: t.value,
  }));
  const total = types.reduce((s, t) => s + t.value, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title={filtered ? "By role" : "By department"}
        description={
          filtered
            ? "The most common job titles in this team"
            : "Headcount at the end of the period"
        }
        height={280}
        table={{
          columns: [filtered ? "Role" : "Department", "People"],
          rows: (filtered ? data.roles : data.departments).map((d) => [d.key, d.value]),
        }}
      >
        <BarSeries
          data={(filtered ? data.roles : data.departments).map((d) => ({
            name: d.key,
            people: d.value,
          }))}
          x="name"
          layout="horizontal"
          series={[{ key: "people", label: "People" }]}
        />
      </ChartCard>
      <ChartCard
        title="By contract"
        description="How people are employed"
        height={280}
        table={{ columns: ["Contract", "People"], rows: types.map((t) => [t.label, t.value]) }}
      >
        <Donut data={types} centerValue={formatNumber(total)} centerLabel="people" />
      </ChartCard>
    </div>
  );
}

export function Attrition({ data }: { data: PeopleReport }) {
  const a = data.attrition;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-6 p-5">
        <Stat
          variant="hero"
          label="Attrition, annualized"
          value={a.annualized}
          format={pct1}
          context={`${a.leavers} ${a.leavers === 1 ? "person" : "people"} left, ${pct1(a.rate)} of the average team`}
        />
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Average headcount"
            value={a.average}
            format={(n) => formatNumber(Math.round(n))}
          />
          <Stat
            label="Typical tenure at exit"
            value={data.tenureAtExit ?? 0}
            format={(n) =>
              data.tenureAtExit == null
                ? "—"
                : n >= 24
                  ? `${(n / 12).toFixed(1)} yrs`
                  : `${Math.round(n)} mo`
            }
          />
        </div>
      </Card>
      <ChartCard
        title="Attrition over time"
        description="Leavers over that period's average headcount"
        height={200}
        table={{
          columns: ["Period", "Left", "Rate"],
          rows: data.monthlyAttrition.map((m) => [m.label, m.leavers, pct1(m.rate)]),
        }}
      >
        <BarSeries
          data={data.monthlyAttrition}
          x="label"
          format={pct1}
          series={[{ key: "rate", label: "Attrition", color: "var(--chart-3)" }]}
        />
      </ChartCard>
      <Card>
        <CardHeader title="Why people left" description="Reasons recorded at exit" />
        {data.reasons.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-body text-ink-muted">
            Nobody left in this period. That&apos;s worth noticing too.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5 px-5 pt-4 pb-5">
            {data.reasons.map((r) => (
              <li
                key={r.reason}
                className="grid grid-cols-[1fr_auto] items-center gap-3 text-small"
              >
                <span className="text-ink">{r.reason}</span>
                <span className="num font-medium text-ink-muted">{r.n}</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-chart-3"
                    style={{ width: `${(r.n / data.reasons[0]!.n) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
