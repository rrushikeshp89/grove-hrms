import { dbDate, type ISODate } from "@/lib/tz";

export type KeyResultLike = { startValue: number; targetValue: number; currentValue: number };

/** How far one key result has come, 0 to 100. Works for targets that go down too. */
export function keyResultPercent(kr: KeyResultLike): number {
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const done = (kr.currentValue - kr.startValue) / span;
  return Math.round(Math.min(1, Math.max(0, done)) * 100);
}

/** A goal's progress is the average of its key results; with none, it's set by hand. */
export function goalProgress(krs: readonly KeyResultLike[]): number | null {
  if (krs.length === 0) return null;
  return Math.round(krs.reduce((s, k) => s + keyResultPercent(k), 0) / krs.length);
}

export type GoalStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "DONE";

export const GOAL_STATUS_META = {
  ON_TRACK: { label: "On track", tone: "success" },
  AT_RISK: { label: "At risk", tone: "warning" },
  OFF_TRACK: { label: "Off track", tone: "danger" },
  DONE: { label: "Done", tone: "accent" },
} as const;

const daysBetween = (a: ISODate, b: ISODate) =>
  Math.round((dbDate(b).getTime() - dbDate(a).getTime()) / 864e5);

/**
 * A suggested status from how far along a goal is against how much of its
 * time has passed. People can override it at check-in; it's a starting
 * point, not a verdict.
 */
export function suggestStatus(input: {
  progress: number;
  start: ISODate;
  due: ISODate | null;
  today: ISODate;
}): GoalStatus {
  if (input.progress >= 100) return "DONE";
  if (!input.due) return "ON_TRACK";
  const total = Math.max(1, daysBetween(input.start, input.due));
  const elapsed = Math.min(total, Math.max(0, daysBetween(input.start, input.today)));
  const gap = (elapsed / total) * 100 - input.progress;
  if (gap <= 10) return "ON_TRACK";
  if (gap <= 25) return "AT_RISK";
  return "OFF_TRACK";
}

/** "3 of 5 key results" style summary pieces. */
export function formatValue(value: number, unit: string | null): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

/* ─── Review cycles ────────────────────────────────────────────────────── */

export const CYCLE_STEPS = [
  "DRAFT",
  "SELF_REVIEW",
  "MANAGER_REVIEW",
  "CALIBRATION",
  "CLOSED",
] as const;
export type CycleStatus = (typeof CYCLE_STEPS)[number];

export const CYCLE_META: Record<CycleStatus, { label: string; blurb: string }> = {
  DRAFT: { label: "Draft", blurb: "Not started. Nobody sees it yet." },
  SELF_REVIEW: { label: "Self reviews", blurb: "Everyone writes about their own period." },
  MANAGER_REVIEW: { label: "Manager reviews", blurb: "Managers write about their reports." },
  CALIBRATION: {
    label: "Calibration",
    blurb: "HR compares ratings across teams before results go out.",
  },
  CLOSED: { label: "Closed", blurb: "Results are shared with each person." },
};

export function nextCycleStatus(status: CycleStatus): CycleStatus | null {
  const i = CYCLE_STEPS.indexOf(status);
  return CYCLE_STEPS[i + 1] ?? null;
}

export type ReviewKind = "SELF" | "MANAGER" | "PEER";

export type Question = { id: string; prompt: string; hint?: string };

export const QUESTIONS: Record<ReviewKind, Question[]> = {
  SELF: [
    {
      id: "proud",
      prompt: "What are you proudest of this period?",
      hint: "Pick the work that mattered, not the most work.",
    },
    { id: "learned", prompt: "Where did you fall short, and what did you learn?" },
    { id: "next", prompt: "What do you want to focus on next?" },
  ],
  MANAGER: [
    {
      id: "strengths",
      prompt: "Where did they do their best work?",
      hint: "Be specific: a project, a decision, a moment.",
    },
    { id: "grow", prompt: "What would make the biggest difference to their growth?" },
    { id: "impact", prompt: "How did they affect the people and work around them?" },
  ],
  PEER: [
    { id: "well", prompt: "What do they do especially well?" },
    { id: "different", prompt: "What could they do differently to be even better to work with?" },
  ],
};

export const RATING_LABELS = [
  "",
  "Needs significant improvement",
  "Partly meets expectations",
  "Meets expectations",
  "Exceeds expectations",
  "Outstanding",
] as const;

export type Answers = Record<string, string>;

/** What's missing before a review can be submitted. Empty means it's ready. */
export function reviewProblems(
  kind: ReviewKind,
  answers: Answers,
  rating: number | null,
): string[] {
  const out: string[] = [];
  for (const q of QUESTIONS[kind]) {
    if ((answers[q.id] ?? "").trim().length < 10) out.push(q.id);
  }
  if (rating == null || rating < 1 || rating > 5) out.push("rating");
  return out;
}

export function ratingSummary(ratings: readonly (number | null)[]) {
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  let n = 0;
  for (const r of ratings) {
    if (r == null || r < 1 || r > 5) continue;
    counts[r - 1]!++;
    total += r;
    n++;
  }
  return { counts, count: n, average: n ? Math.round((total / n) * 10) / 10 : null };
}

/** Manager rating minus self rating: positive means they rate you higher than you did. */
export function ratingGap(self: number | null, manager: number | null): number | null {
  return self == null || manager == null ? null : manager - self;
}

/** Which part of a cycle each kind of review can be written in. */
export function canWriteReview(kind: ReviewKind, cycle: CycleStatus): boolean {
  if (kind === "MANAGER") return cycle === "MANAGER_REVIEW";
  return cycle === "SELF_REVIEW" || cycle === "MANAGER_REVIEW";
}

/**
 * Whether a manager rating is visible to its subject: only once the cycle has
 * closed, so nobody learns their rating mid-calibration.
 */
export const resultsShared = (cycle: CycleStatus) => cycle === "CLOSED";
