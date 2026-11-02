"use client";

import { useReducedMotion } from "motion/react";
import * as motion from "motion/react-m";
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
  const ring = React.useRef<SVGCircleElement>(null);
  const progress = React.useRef(0);
  const frame = React.useRef(0);
  const [pulse, setPulse] = React.useState(0);

  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** Moves the ring to `to` over `ms`, then calls `done`. */
  function run(to: number, ms: number, delay = 0, done?: () => void) {
    cancelAnimationFrame(frame.current);
    const from = progress.current;
    const started = performance.now() + delay;
    frame.current = requestAnimationFrame(function tick(now) {
      const t = ms > 0 ? Math.min(Math.max((now - started) / ms, 0), 1) : 1;
      progress.current = from + (to - from) * t;
      if (ring.current) {
        ring.current.style.strokeDashoffset = String(1 - progress.current);
        ring.current.style.opacity = progress.current > 0 ? "1" : "0";
      }
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else done?.();
    });
  }

  const confirm = React.useCallback(() => {
    setPulse((p) => p + 1);
    onConfirm();
  }, [onConfirm]);

  function start() {
    if (disabled) return;
    run(1, holdMs * (1 - progress.current), 0, () => {
      confirm();
      run(0, 350, 250);
    });
  }

  function cancel() {
    if (progress.current >= 1) return;
    run(0, 200);
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
        <circle
          ref={ring}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={tone === "accent" ? "stroke-accent" : "stroke-ink"}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          opacity={0}
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
