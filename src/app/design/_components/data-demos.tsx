"use client";

import { format, parseISO } from "date-fns";
import { Bell, Search, SearchX, Users } from "lucide-react";
import * as React from "react";

import {
  BarSeries,
  ChartCard,
  Donut,
  Funnel,
  Heatmap,
  Legend,
  TrendArea,
} from "@/components/charts/charts";
import { DensityToggle } from "@/components/shell/preference-controls";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { columnsFor, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetHeader } from "@/components/ui/overlay";
import { DescriptionList } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";

import {
  ARRIVALS,
  DEPARTMENTS,
  FUNNEL,
  HEADCOUNT,
  HIRES_EXITS,
  LEAVE_BY_TYPE,
  PEOPLE,
  type SamplePerson,
} from "../_data/sample";

const STATUS: Record<SamplePerson["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  onLeave: { label: "On leave", tone: "highlight" },
  onboarding: { label: "Onboarding", tone: "info" },
  notice: { label: "Notice period", tone: "warning" },
};

const col = columnsFor<SamplePerson>();
const columns = col.columns([
  col.accessor("name", {
    header: "Person",
    sortFn: "text",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.original.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.original.name}</p>
          <p className="truncate text-caption text-ink-subtle compact:hidden">
            {row.original.designation}
          </p>
        </div>
      </div>
    ),
  }),
  col.accessor("code", {
    header: "ID",
    cell: (info) => <span className="font-mono text-small text-ink-muted">{info.getValue()}</span>,
  }),
  col.accessor("department", { header: "Department", sortFn: "text" }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => {
      const s = STATUS[info.getValue()];
      return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
    },
  }),
  col.accessor("joined", {
    header: "Joined",
    cell: (info) => (
      <span className="text-ink-muted">{format(parseISO(info.getValue()), "d MMM yyyy")}</span>
    ),
  }),
  col.accessor("leaveBalance", {
    header: "Leave left",
    meta: { align: "end" },
    cell: (info) => <span className="font-medium">{info.getValue()} d</span>,
  }),
]);

export function TableDemo() {
  const [query, setQuery] = React.useState("");
  const [preview, setPreview] = React.useState<SamplePerson | null>(null);
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PEOPLE;
    return PEOPLE.filter((p) =>
      [p.name, p.code, p.department, p.designation].some((v) => v.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Filter people"
          leadingIcon={<Search />}
          placeholder="Filter by name, ID or team"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <DensityToggle />
      </div>
      <DataTable
        caption="Sample employees"
        columns={columns}
        data={rows}
        getRowId={(p) => p.id}
        selectable
        onRowClick={setPreview}
        initialSorting={[{ id: "name", desc: false }]}
        bulkActions={(selected, clear) => (
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              toast.success(
                `Reminder sent to ${selected.length} ${selected.length === 1 ? "person" : "people"}`,
                {
                  description: "They'll see it in their notifications.",
                },
              );
              clear();
            }}
          >
            <Bell aria-hidden /> Send reminder
          </Button>
        )}
        empty={
          <EmptyState
            compact
            icon={SearchX}
            satellites={[Users, Search]}
            title={`No one matches “${query}”`}
            description="Try a first name, an employee ID like GRV-0042, or a department."
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                Clear filter
              </Button>
            }
          />
        }
      />
      <p className="text-small text-ink-subtle">
        Click a row or press Enter to preview. Arrow keys move between rows. Shift-click checkboxes
        to select a range.
      </p>

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent>
          {preview && (
            <>
              <SheetHeader title={preview.name} description={preview.designation} />
              <SheetBody className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <Avatar name={preview.name} size="lg" />
                  <div className="flex flex-col gap-1.5">
                    <StatusPill tone={STATUS[preview.status].tone}>
                      {STATUS[preview.status].label}
                    </StatusPill>
                    <span className="font-mono num text-small text-ink-muted">{preview.code}</span>
                  </div>
                </div>
                <DescriptionList
                  columns={1}
                  items={[
                    { term: "Department", detail: preview.department },
                    { term: "Location", detail: preview.location },
                    { term: "Joined", detail: format(parseISO(preview.joined), "d MMMM yyyy") },
                    { term: "Leave left", detail: `${preview.leaveBalance} days` },
                  ]}
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ChartsDemo() {
  const [range, setRange] = React.useState<"6m" | "12m">("12m");
  const headcount = range === "12m" ? HEADCOUNT : HEADCOUNT.slice(-6);
  const leaveSeries = [
    { key: "earned", label: "Earned" },
    { key: "casual", label: "Casual" },
    { key: "sick", label: "Sick" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <ChartCard
        className="lg:col-span-4"
        title="Headcount"
        description="Active employees at month end"
        actions={
          <SegmentedControl
            aria-label="Range"
            size="sm"
            value={range}
            onValueChange={setRange}
            options={[
              { value: "6m", label: "6 months" },
              { value: "12m", label: "12 months" },
            ]}
          />
        }
        table={{
          columns: ["Month", "Headcount"],
          rows: headcount.map((d) => [d.month, d.headcount]),
        }}
      >
        <TrendArea data={headcount} x="month" series={[{ key: "headcount", label: "Headcount" }]} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-2"
        title="By department"
        table={{
          columns: ["Department", "People"],
          rows: DEPARTMENTS.map((d) => [d.label, d.value]),
        }}
      >
        <Donut data={DEPARTMENTS} centerValue="106" centerLabel="people" />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="Hires and exits"
        description="Last six months"
        actions={
          <Legend
            series={[
              { key: "hires", label: "Hires" },
              { key: "exits", label: "Exits" },
            ]}
          />
        }
        table={{
          columns: ["Month", "Hires", "Exits"],
          rows: HIRES_EXITS.map((d) => [d.month, d.hires, d.exits]),
        }}
      >
        <BarSeries
          data={HIRES_EXITS}
          x="month"
          series={[
            { key: "hires", label: "Hires" },
            { key: "exits", label: "Exits" },
          ]}
        />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="Leave taken by type"
        description="Days, per quarter"
        actions={<Legend series={leaveSeries} />}
        table={{
          columns: ["Quarter", "Earned", "Casual", "Sick"],
          rows: LEAVE_BY_TYPE.map((d) => [d.quarter, d.earned, d.casual, d.sick]),
        }}
      >
        <BarSeries data={LEAVE_BY_TYPE} x="quarter" series={leaveSeries} stacked />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="Hiring funnel"
        description="All roles, last 12 months · stage-to-stage conversion on the right"
        table={{ columns: ["Stage", "Candidates"], rows: FUNNEL.map((s) => [s.label, s.value]) }}
      >
        <Funnel stages={FUNNEL} />
      </ChartCard>
      <ChartCard
        className="lg:col-span-3"
        title="When people arrive"
        description="Clock-ins by weekday and half hour, last 90 days"
        table={{
          columns: ["Day", ...ARRIVALS.columns],
          rows: ARRIVALS.rows.map((r, i) => [r, ...ARRIVALS.values[i]!]),
        }}
      >
        <Heatmap rows={ARRIVALS.rows} columns={ARRIVALS.columns} values={ARRIVALS.values} />
      </ChartCard>
    </div>
  );
}
