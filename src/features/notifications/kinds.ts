import { AtSign, Bell, CheckCheck, Inbox, Info, Megaphone, type LucideIcon } from "lucide-react";

import type { Tone } from "@/components/ui/badge";

/** One look per kind, so a notification reads at a glance. */
export const KIND_META: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  APPROVAL_REQUESTED: { label: "Needs your decision", icon: Inbox, tone: "warning" },
  APPROVAL_DECIDED: { label: "Decision", icon: CheckCheck, tone: "success" },
  REMINDER: { label: "Reminder", icon: Bell, tone: "info" },
  ANNOUNCEMENT: { label: "Announcement", icon: Megaphone, tone: "accent" },
  MENTION: { label: "Mention", icon: AtSign, tone: "highlight" },
  SYSTEM: { label: "Update", icon: Info, tone: "neutral" },
};

export const kindMeta = (kind: string) => KIND_META[kind] ?? KIND_META.SYSTEM!;
