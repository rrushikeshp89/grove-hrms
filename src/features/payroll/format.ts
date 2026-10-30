import type { Tone } from "@/components/ui/badge";

export const RUN_STATUS: Record<
  "DRAFT" | "IN_REVIEW" | "FINALIZED",
  { label: string; tone: Tone }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  FINALIZED: { label: "Final", tone: "success" },
};
