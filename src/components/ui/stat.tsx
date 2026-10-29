"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import * as React from "react";

import { easeOutSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Counts up to `value` once when it scrolls into view. Renders the final
 * value on the server and for reduced-motion users, so there's never a
 * flash of "0" without JavaScript.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-IN"),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const render = React.useEffectEvent((n: number) => format(n));

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const controls = animate(0, value, {
      duration,
      ease: easeOutSoft,
      onUpdate: (n) => {
        el.textContent = render(n);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  return (
    <span ref={ref} className={cn("num", className)}>
      {format(value)}
    </span>
  );
}

export type Trend = { direction: "up" | "down"; label: string; good: boolean };

function TrendLine({ trend }: { trend: Trend }) {
  const Icon = trend.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-small font-medium",
        trend.good ? "text-success" : "text-danger",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {trend.label}
    </span>
  );
}

/**
 * Hero variant: one big serif number with context, for the single figure a
 * screen is about. Inline variant: compact label/value pairs inside cards.
 */
export function Stat({
  label,
  value,
  format,
  suffix,
  trend,
  context,
  variant = "inline",
  className,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  trend?: Trend;
  context?: React.ReactNode;
  variant?: "hero" | "inline";
  className?: string;
}) {
  if (variant === "hero") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <span className="eyebrow">{label}</span>
        <div className="flex items-baseline gap-2">
          <CountUp
            value={value}
            format={format}
            className="font-display-soft text-display-xl font-medium text-ink"
          />
          {suffix && <span className="text-heading text-ink-muted">{suffix}</span>}
        </div>
        {(trend || context) && (
          <div className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
            {trend && <TrendLine trend={trend} />}
            {context}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-small text-ink-muted">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <CountUp value={value} format={format} className="text-title font-semibold text-ink" />
        {suffix && <span className="text-small text-ink-subtle">{suffix}</span>}
      </div>
      {trend && <TrendLine trend={trend} />}
    </div>
  );
}
