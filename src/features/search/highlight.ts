export type Segment = { text: string; match: boolean };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits text into runs that do and don't match the query, so a result can
 * show why it matched. Every word of the query counts, case is ignored, and
 * overlapping matches merge into one run.
 */
export function highlightSegments(text: string, query: string): Segment[] {
  const words = [...new Set(query.trim().split(/\s+/).filter(Boolean))]
    // Longest first, so "design" wins over "des" at the same position.
    .sort((a, b) => b.length - a.length);
  if (!text || words.length === 0) return text ? [{ text, match: false }] : [];

  const re = new RegExp(words.map(escape).join("|"), "gi");
  const out: Segment[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), match: false });
    const last = out[out.length - 1];
    // Back-to-back matches ("ab" + "cd" for "ab cd" in "abcd") read as one.
    if (last?.match && m.index === at) last.text += m[0];
    else out.push({ text: m[0], match: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out;
}
