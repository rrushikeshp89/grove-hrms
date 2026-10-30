import type { Tone } from "@/components/ui/badge";

import type { DayKind } from "./logic/timesheet";

export const DAY_META: Record<DayKind, { label: string; tone: Tone } | null> = {
  PRESENT: { label: "On time", tone: "success" },
  LATE: { label: "Late", tone: "warning" },
  HALF_DAY: { label: "Half day", tone: "info" },
  ABSENT: { label: "No record", tone: "danger" },
  ON_LEAVE: { label: "On leave", tone: "highlight" },
  PARTIAL_LEAVE: { label: "Half-day leave", tone: "highlight" },
  HOLIDAY: { label: "Holiday", tone: "accent" },
  WEEKEND: null,
  FUTURE: null,
  NOT_JOINED: null,
  IN_PROGRESS: { label: "Clocked in", tone: "accent" },
};

export const TEAM_STATE_META = {
  late: { label: "Late", tone: "warning" },
  notYet: { label: "Not in yet", tone: "neutral" },
  in: { label: "In", tone: "success" },
  out: { label: "Clocked out", tone: "info" },
  leave: { label: "On leave", tone: "highlight" },
  away: { label: "Holiday", tone: "accent" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
