import type { Tone } from "@/components/ui/badge";

type Named = { firstName: string; lastName: string; preferredName?: string | null };

/** People choose what they're called; the directory respects it. */
export function displayName(p: Named) {
  return `${p.preferredName || p.firstName} ${p.lastName}`;
}

export const STATUS_META = {
  ONBOARDING: { label: "Onboarding", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  ON_LEAVE: { label: "On leave", tone: "highlight" },
  NOTICE: { label: "Notice period", tone: "warning" },
  EXITED: { label: "Former employee", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export const EMPLOYMENT_LABELS = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
} as const;
