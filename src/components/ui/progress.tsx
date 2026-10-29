"use client";

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { easeOutSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

const fillTone = {
  accent: "bg-accent",
  highlight: "bg-highlight",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

const strokeTone = {
  accent: "stroke-accent",
  highlight: "stroke-highlight",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
} as const;

type ProgressTone = keyof typeof fillTone;

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function ProgressBar({
  value,
  tone = "accent",
  label,
  className,
}: {
  value: number;
  tone?: ProgressTone;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const v = clamp(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-active", className)}
    >
      <motion.div
        className={cn("h-full origin-left rounded-full", fillTone[tone])}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: v / 100 }}
        transition={{ duration: 0.6, ease: easeOutSoft }}
      />
    </div>
  );
}

/** Draws in on mount. Children render in the center (a number, an icon). */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone = "accent",
  label,
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: ProgressTone;
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const v = clamp(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-active"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={strokeTone[tone]}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: v / 100 }}
          transition={{ duration: 0.8, ease: easeOutSoft, delay: 0.1 }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}
