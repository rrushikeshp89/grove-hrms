"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import * as React from "react";

import { snappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Press-and-hold to confirm. A ring fills while held; letting go early
 * rewinds it. Enter/Space confirm immediately so keyboard users aren't
 * asked to hold a key. Used for clock in/out, where an accidental tap
 * matters.
 */
export function HoldButton({
  onConfirm,
  holdMs = 650,
  label,
  sublabel,
  icon,
  tone = "accent",
  disabled,
  className,
}: {
  onConfirm: () => void;
  holdMs?: number;
  label: string;
  sublabel?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "accent" | "neutral";
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const ring = useTransform(progress, [0, 1], [0, 1]);
  const anim = React.useRef<ReturnType<typeof animate> | null>(null);
  const [pulse, setPulse] = React.useState(0);

  const confirm = React.useCallback(() => {
    setPulse((p) => p + 1);
    onConfirm();
  }, [onConfirm]);

  function start() {
    if (disabled) return;
    anim.current?.stop();
    anim.current = animate(progress, 1, {
      duration: (holdMs / 1000) * (1 - progress.get()),
      ease: "linear",
      onComplete: () => {
        confirm();
        animate(progress, 0, { duration: 0.35, delay: 0.25 });
      },
    });
  }

  function cancel() {
    if (progress.get() >= 1) return;
    anim.current?.stop();
    animate(progress, 0, { duration: 0.2 });
  }

  const size = 132;
  const stroke = 5;
  const r = (size - stroke) / 2;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-description="Press and hold, or press Enter"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          confirm();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={snappy}
      className={cn(
        "group relative grid shrink-0 touch-none place-items-center rounded-full select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
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
          className={tone === "accent" ? "stroke-accent" : "stroke-ink"}
          style={{ pathLength: ring }}
        />
      </svg>
      <motion.span
        key={pulse}
        initial={pulse && !reduce ? { scale: 0.9 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
        className={cn(
          "relative grid size-[104px] place-items-center rounded-full shadow-press transition-colors duration-200",
          tone === "accent"
            ? "bg-accent text-accent-fg group-hover:bg-accent-hover"
            : "bg-ink text-bg",
        )}
      >
        <span className="flex flex-col items-center gap-1">
          <span className="[&_svg]:size-6">{icon}</span>
          <span className="text-small font-semibold">{label}</span>
          {sublabel && <span className="font-mono num text-caption opacity-80">{sublabel}</span>}
        </span>
      </motion.span>
    </motion.button>
  );
}
