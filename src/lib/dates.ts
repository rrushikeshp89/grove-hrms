/**
 * "2 years, 3 months" style tenure between a join date and today.
 * Calendar-month based, so 31 Jan → 28 Feb counts as a month.
 */
export function tenure(from: Date, to: Date = new Date()): string {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 864e5));
    if (days === 0) return "Joined today";
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years > 0 && `${years} year${years === 1 ? "" : "s"}`,
    rest > 0 && `${rest} month${rest === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.join(", ");
}
