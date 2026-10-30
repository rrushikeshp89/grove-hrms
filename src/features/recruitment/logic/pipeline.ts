import type { Tone } from "@/components/ui/badge";

/** The stages a candidate moves through, in order. Rejection sits outside. */
export const PIPELINE = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
export type PipelineStage = (typeof PIPELINE)[number];
export type Stage = PipelineStage | "REJECTED";

export const STAGE_META: Record<Stage, { label: string; tone: Tone }> = {
  APPLIED: { label: "Applied", tone: "neutral" },
  SCREENING: { label: "Screening", tone: "info" },
  INTERVIEW: { label: "Interview", tone: "accent" },
  OFFER: { label: "Offer", tone: "highlight" },
  HIRED: { label: "Hired", tone: "success" },
  REJECTED: { label: "Not moving forward", tone: "danger" },
};

export const JOB_STATUS_META = {
  OPEN: { label: "Open", tone: "success" },
  ON_HOLD: { label: "On hold", tone: "warning" },
  DRAFT: { label: "Draft", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export const SOURCES = [
  "LinkedIn",
  "Referral",
  "Careers page",
  "Naukri",
  "Campus",
  "Agency",
] as const;

/**
 * A sort key that lands between two neighbours, so a drop only rewrites the
 * card that moved. `above` is the card that ends up before it.
 */
export function orderBetween(above: number | null, below: number | null): number {
  if (above === null && below === null) return 0;
  if (above === null) return below! - 1;
  if (below === null) return above + 1;
  return (above + below) / 2;
}

/**
 * Why a move isn't allowed, or null when it is. Hiring and rejecting have
 * their own flows (they ask for details), so a plain move never does either.
 */
export function moveProblem(from: Stage, to: Stage): string | null {
  if (from === to) return null;
  if (from === "HIRED") return "Hired candidates stay hired. Their story continues in onboarding.";
  if (to === "HIRED") return "Use Convert to employee to hire someone.";
  if (to === "REJECTED") return "Use Not moving forward, so the reason is recorded.";
  return null;
}

/** Where a rejected candidate goes back to: the furthest stage they reached. */
export function restoreStage(path: readonly Stage[]): PipelineStage {
  let best = 0;
  for (const s of path) {
    const i = PIPELINE.indexOf(s as PipelineStage);
    if (i > best && s !== "HIRED") best = i;
  }
  return PIPELINE[best]!;
}

export function stageCounts(stages: readonly Stage[]): Record<Stage, number> {
  const counts = { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0 };
  for (const s of stages) counts[s]++;
  return counts;
}

/** Whole days between two instants, never negative. */
export function daysSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 864e5));
}

const ascii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** first.last@domain, with a number when that's taken. */
export function suggestWorkEmail(
  firstName: string,
  lastName: string,
  taken: ReadonlySet<string>,
  domain = "northwindgrove.in",
): string {
  const base = [ascii(firstName), ascii(lastName)].filter(Boolean).join(".") || "new.joiner";
  let email = `${base}@${domain}`;
  for (let i = 2; taken.has(email); i++) email = `${base}${i}@${domain}`;
  return email;
}

/** Average of note ratings to one decimal, or null with none. */
export function averageRating(ratings: readonly (number | null)[]): number | null {
  const r = ratings.filter((x): x is number => typeof x === "number");
  if (!r.length) return null;
  return Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10;
}

/* ─── Job descriptions ─────────────────────────────────────────────────── */

type Doc = {
  type: "doc";
  content: { type: string; content?: { type: string; text?: string }[] }[];
};

/** Plain text with blank-line paragraphs ⇄ the stored document shape. */
export function docFromText(text: string): Doc {
  return {
    type: "doc",
    content: text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

export function textFromDoc(doc: unknown): string {
  const d = doc as Partial<Doc> | null;
  if (!d || !Array.isArray(d.content)) return "";
  return d.content
    .map((block) => (block.content ?? []).map((c) => c.text ?? "").join(""))
    .filter(Boolean)
    .join("\n\n");
}
