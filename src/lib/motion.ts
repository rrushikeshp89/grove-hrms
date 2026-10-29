import type { Transition } from "motion/react";

/** Durations mirror the CSS tokens (150 / 200 / 250ms). */
export const duration = { fast: 0.15, base: 0.2, slow: 0.25 } as const;

/** Toggles, menus, press states. */
export const snappy: Transition = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 };

/** Panels, sheets, layout shifts. */
export const gentle: Transition = { type: "spring", stiffness: 260, damping: 30 };

export const easeOutSoft = [0.2, 0.8, 0.2, 1] as const;

/** Page/section entrance: an 8px rise and fade. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.slow, ease: easeOutSoft },
} as const;
