const LOCALE = "en-IN";

export type DayPart = "morning" | "afternoon" | "evening";

/** The time-aware greeting used on home screens. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

export function greeting(name: string, hour: number): string {
  return `Good ${dayPart(hour)}, ${name}`;
}

/** Money is stored in minor units (paise). */
export function formatMoney(minor: number, currency = "INR", opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 0,
  }).format(minor / 100);
}

export function formatNumber(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(LOCALE, opts).format(n);
}

export function formatPercent(ratio: number, digits = 0) {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(ratio);
}

/** "Priya Raman" -> "PR"; single names get one letter. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
