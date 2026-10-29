"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as React from "react";

/**
 * Amber confetti for real milestones only (leave approved, onboarding done,
 * work anniversary). Call `celebrate()` from anywhere; the <Celebration />
 * host in the root layout renders the burst. Reduced-motion users get no
 * particles; the toast or copy that accompanies a milestone carries it.
 */

type Burst = { id: number; x: number; y: number };
const listeners = new Set<(b: Burst) => void>();
let nextId = 1;

export function celebrate(origin?: { x: number; y: number }) {
  const burst = {
    id: nextId++,
    x: origin?.x ?? (typeof window === "undefined" ? 0 : window.innerWidth / 2),
    y: origin?.y ?? (typeof window === "undefined" ? 0 : window.innerHeight / 3),
  };
  listeners.forEach((l) => l(burst));
}

// Deterministic pseudo-random so a burst looks organic but never jitters
// between renders.
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PIECES = 34;
const SHAPES = ["rounded-full", "rounded-[2px]", "rounded-full"] as const;
const COLORS = [
  "bg-highlight",
  "bg-highlight",
  "bg-highlight-subtle",
  "bg-accent",
  "bg-highlight-ink",
] as const;

function ConfettiBurst({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => {
        const s = burst.id * 100 + i;
        const angle = (i / PIECES) * Math.PI * 2 + rand(s) * 0.5;
        const dist = 90 + rand(s + 1) * 150;
        const size = 5 + rand(s + 2) * 5;
        return (
          <motion.span
            key={i}
            className={`absolute ${SHAPES[i % SHAPES.length]} ${COLORS[i % COLORS.length]}`}
            style={{
              left: burst.x,
              top: burst.y,
              width: size,
              height: size * (i % 3 === 1 ? 1.8 : 1),
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: [0, Math.sin(angle) * dist - 40, Math.sin(angle) * dist + 120],
              opacity: [1, 1, 0],
              rotate: (rand(s + 3) - 0.5) * 540,
              scale: 1,
            }}
            transition={{ duration: 1.3 + rand(s + 4) * 0.3, ease: [0.15, 0.7, 0.4, 1] }}
          />
        );
      })}
    </div>
  );
}

export function Celebration() {
  const reduce = useReducedMotion();
  const [bursts, setBursts] = React.useState<Burst[]>([]);

  React.useEffect(() => {
    const l = (b: Burst) => setBursts((all) => [...all, b]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (reduce) return null;
  return (
    <AnimatePresence>
      {bursts.map((b) => (
        <ConfettiBurst
          key={b.id}
          burst={b}
          onDone={() => setBursts((all) => all.filter((x) => x.id !== b.id))}
        />
      ))}
    </AnimatePresence>
  );
}
