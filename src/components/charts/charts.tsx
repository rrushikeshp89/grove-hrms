"use client";

import { Table2, ChartColumn } from "lucide-react";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Categorical order. Single-series charts use accent only. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

const axis = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--ink-subtle)", fontSize: 12 },
} as const;

export type Series = { key: string; label: string; color?: string };

/* ─── Frame: title, controls, and a data-table fallback ────────────────── */

export function ChartCard({
  title,
  description,
  actions,
  table,
  children,
  className,
  height = 240,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Same data as rows, for screen readers and anyone who prefers numbers. */
  table: { columns: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              aria-label={asTable ? "Show as chart" : "Show as table"}
              className="grid size-8 place-items-center rounded-control text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            >
              {asTable ? <ChartColumn className="size-4" /> : <Table2 className="size-4" />}
            </button>
          </div>
        }
      />
      <div className="px-3 pt-4 pb-4 sm:px-5" style={{ minHeight: height }}>
        {asTable ? (
          <div className="overflow-auto" style={{ maxHeight: height }}>
            <table className="w-full text-left text-small">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-hairline text-ink-muted">
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={cn("py-2 font-medium", i > 0 && "text-right")}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    {r.map((v, j) => (
                      <td key={j} className={cn("py-1.5 num text-ink", j > 0 && "text-right")}>
                        {typeof v === "number" ? formatNumber(v) : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            role="img"
            aria-label={`${title}. Use the table button to read the values.`}
            style={{ height }}
          >
            {children}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Tooltip ──────────────────────────────────────────────────────────── */

type TooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: unknown; name?: unknown; value?: unknown; color?: string }>;
  label?: unknown;
  format?: (n: number) => string;
};

function ChartTooltip({ active, payload, label, format = formatNumber }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-control border border-hairline bg-surface px-3 py-2 shadow-md">
      {label != null && (
        <p className="mb-1.5 text-caption font-medium text-ink-muted">{String(label)}</p>
      )}
      <ul className="flex flex-col gap-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2 text-small">
            <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 text-ink-muted">{String(p.name)}</span>
            <span className="num font-medium text-ink">{format(Number(p.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s, i) => (
        <li key={s.key} className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ─── Area ─────────────────────────────────────────────────────────────── */

export function TrendArea({
  data,
  x,
  series,
  format,
  zeroBased = false,
  domain,
}: {
  data: Record<string, string | number>[];
  x: string;
  series: Series[];
  format?: (n: number) => string;
  /** Counts that only drift (headcount) read better on a fitted axis. */
  zeroBased?: boolean;
  /** A fixed axis, for ratios where a fitted one would exaggerate noise. */
  domain?: [number, number];
}) {
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? (series.length === 1 ? "var(--accent)" : CHART_COLORS[i]);
            return (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={x} {...axis} dy={6} />
        <YAxis
          {...axis}
          width={format ? 52 : 44}
          allowDecimals={!!domain}
          domain={domain ?? (zeroBased ? [0, "auto"] : ["auto", "auto"])}
          tickFormatter={(v: number) => (format ?? formatNumber)(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
          content={(p) => <ChartTooltip {...p} format={format} />}
        />
        {series.map((s, i) => {
          const color = s.color ?? (series.length === 1 ? "var(--accent)" : CHART_COLORS[i]);
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${id}-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              animationDuration={700}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Bar ──────────────────────────────────────────────────────────────── */

export function BarSeries({
  data,
  x,
  series,
  stacked,
  layout = "vertical",
  format,
}: {
  data: Record<string, string | number>[];
  x: string;
  series: Series[];
  stacked?: boolean;
  /** "vertical" = upright bars; "horizontal" = bars run left to right. */
  layout?: "vertical" | "horizontal";
  format?: (n: number) => string;
}) {
  const horizontal = layout === "horizontal";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -12 }}
        barGap={3}
        barCategoryGap={horizontal ? 8 : "28%"}
      >
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--chart-grid)" />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              {...axis}
              allowDecimals={!!format}
              tickFormatter={(v: number) => (format ?? formatNumber)(v)}
            />
            <YAxis type="category" dataKey={x} {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} dy={6} />
            <YAxis
              {...axis}
              width={format ? 52 : 44}
              allowDecimals={!!format}
              tickFormatter={(v: number) => (format ?? formatNumber)(v)}
            />
          </>
        )}
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={(p) => <ChartTooltip {...p} format={format} />}
        />
        {series.map((s, i) => {
          const last = i === series.length - 1;
          const radius: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? "a" : undefined}
              fill={s.color ?? (series.length === 1 ? "var(--accent)" : CHART_COLORS[i])}
              radius={!stacked || last ? radius : 0}
              maxBarSize={horizontal ? 18 : 28}
              animationDuration={600}
            />
          );
        })}
      </RBarChart>
    </ResponsiveContainer>
  );
}

/* ─── Donut ────────────────────────────────────────────────────────────── */

export function Donut({
  data,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[];
  centerLabel: string;
  centerValue: string;
}) {
  return (
    <div className="@container h-full">
      <div className="flex h-full flex-col items-center justify-center gap-4 @sm:flex-row">
        <div className="relative size-40 shrink-0 @sm:size-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="var(--surface)"
                strokeWidth={2}
                animationDuration={700}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={(p) => <ChartTooltip {...p} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display-soft num text-display font-medium text-ink">
                {centerValue}
              </p>
              <p className="text-caption text-ink-subtle">{centerLabel}</p>
            </div>
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 @sm:flex @sm:w-auto @sm:min-w-44 @sm:flex-col">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 text-small">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink-muted">{d.label}</span>
              <span className="num font-medium text-ink">{formatNumber(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Funnel ───────────────────────────────────────────────────────────── */

/** Hiring funnel: each stage's bar is sized against the first stage. */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const top = stages[0]?.value || 1;
  return (
    <ol className="flex h-full flex-col justify-center gap-2.5">
      {stages.map((s, i) => {
        const pct = s.value / top;
        const prev = stages[i - 1]?.value;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3">
            <span className="truncate text-small text-ink-muted">{s.label}</span>
            <div className="h-7 overflow-hidden rounded-sm bg-surface-sunken">
              <div
                className="flex h-full items-center rounded-sm bg-accent px-2 transition-[width] duration-700 ease-out-soft"
                style={{ width: `${Math.max(pct * 100, 8)}%` }}
              >
                <span className="num text-caption font-semibold text-accent-fg">
                  {formatNumber(s.value)}
                </span>
              </div>
            </div>
            <span className="text-right num text-caption text-ink-subtle">
              {conv != null ? `${conv}%` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Heatmap ──────────────────────────────────────────────────────────── */

/**
 * A rows × columns grid with five steps of accent. Used for attendance
 * patterns (weekday × arrival hour) where a bar chart would hide the shape.
 */
export function Heatmap({
  rows,
  columns,
  values,
  format = (n) => formatNumber(n),
}: {
  rows: string[];
  columns: string[];
  values: number[][];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...values.flat());
  const step = (v: number) => Math.min(4, Math.floor((v / max) * 5));
  const fills = [
    "bg-surface-sunken",
    "bg-accent/20",
    "bg-accent/40",
    "bg-accent/65",
    "bg-accent",
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `2.5rem repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        <span />
        {columns.map((c) => (
          <span key={c} className="text-center num text-caption text-ink-subtle">
            {c}
          </span>
        ))}
        {rows.map((r, ri) => (
          <React.Fragment key={r}>
            <span className="self-center text-caption text-ink-subtle">{r}</span>
            {columns.map((c, ci) => {
              const v = values[ri]?.[ci] ?? 0;
              return (
                <span
                  key={c}
                  title={`${r} ${c}: ${format(v)}`}
                  className={cn("h-8 rounded-xs", fills[step(v)])}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-caption text-ink-subtle">
        Fewer
        {fills.map((f) => (
          <span key={f} aria-hidden className={cn("size-3 rounded-xs", f)} />
        ))}
        More
      </div>
    </div>
  );
}
