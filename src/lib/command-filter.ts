/**
 * Ranking for the command palette. cmdk's default fuzzy scorer matches
 * letters scattered across keywords ("dark" matches "foun-D-A-tions colo-R
 * K-eywords"), which surfaces the wrong thing first. People type the start of
 * a word, so we rank by that.
 *
 * Returns a score in [0, 1]; 0 hides the item.
 */
export function commandScore(value: string, search: string, keywords: string[] = []): number {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const label = value.toLowerCase();
  const terms = q.split(/\s+/);
  const words = label.split(/[\s/.\-]+/).filter(Boolean);
  const keys = keywords.map((k) => k.toLowerCase());

  if (label.startsWith(q)) return 1;
  // every typed term starts some word of the label
  if (terms.every((t) => words.some((w) => w.startsWith(t)))) return 0.9;
  if (label.includes(q)) return 0.75;
  if (terms.every((t) => keys.some((k) => k.startsWith(t)) || words.some((w) => w.startsWith(t)))) {
    return 0.6;
  }
  return 0;
}
