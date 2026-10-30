/**
 * Announcement bodies are stored as a Tiptap document (JSON). Because the
 * JSON arrives from a browser, it is never trusted: `sanitizeDoc` rebuilds
 * it from an allow-list of nodes and marks, so nothing else can be stored
 * or rendered.
 */

export type Mark = {
  type: "bold" | "italic" | "strike" | "code" | "link";
  attrs?: { href: string };
};
export type Node = {
  type: string;
  attrs?: { level?: number };
  text?: string;
  marks?: Mark[];
  content?: Node[];
};
export type Doc = { type: "doc"; content: Node[] };

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
]);
const MARKS = new Set(["bold", "italic", "strike", "code", "link"]);
const MAX_NODES = 2000;
const MAX_DEPTH = 8;

const safeHref = (href: unknown): string | null => {
  if (typeof href !== "string") return null;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

export function sanitizeDoc(input: unknown): Doc {
  let count = 0;
  const clean = (raw: unknown, depth: number): Node | null => {
    if (!raw || typeof raw !== "object" || depth > MAX_DEPTH || ++count > MAX_NODES) return null;
    const n = raw as Record<string, unknown>;
    if (n.type === "text") {
      if (typeof n.text !== "string" || n.text === "") return null;
      const marks = (Array.isArray(n.marks) ? n.marks : []).flatMap((m): Mark[] => {
        const mark = m as { type?: string; attrs?: { href?: unknown } };
        if (!mark?.type || !MARKS.has(mark.type)) return [];
        if (mark.type === "link") {
          const href = safeHref(mark.attrs?.href);
          return href ? [{ type: "link", attrs: { href } }] : [];
        }
        return [{ type: mark.type as Mark["type"] }];
      });
      return { type: "text", text: n.text.slice(0, 5000), ...(marks.length ? { marks } : {}) };
    }
    if (typeof n.type !== "string" || !BLOCKS.has(n.type)) return null;
    const out: Node = { type: n.type };
    if (n.type === "heading") {
      const level = (n.attrs as { level?: number } | undefined)?.level;
      out.attrs = { level: level === 3 ? 3 : 2 };
    }
    if (Array.isArray(n.content)) {
      const kids = n.content.flatMap((c) => {
        const k = clean(c, depth + 1);
        return k ? [k] : [];
      });
      if (kids.length) out.content = kids;
    }
    return out;
  };
  const root = input as { content?: unknown[] } | null;
  const content = (Array.isArray(root?.content) ? root.content : []).flatMap((c) => {
    const k = clean(c, 1);
    return k ? [k] : [];
  });
  return { type: "doc", content };
}

/** Plain text for search and previews, with a space between blocks. */
export function docToText(doc: Doc | null | undefined): string {
  const walk = (n: Node): string => {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return " ";
    const inner = (n.content ?? [])
      .map(walk)
      .join(n.type === "bulletList" || n.type === "orderedList" ? " " : "");
    return inner;
  };
  return (doc?.content ?? []).map(walk).join(" ").replace(/\s+/g, " ").trim();
}

export function previewText(doc: Doc, max = 160): string {
  const t = docToText(doc);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/* ─── Audience and reactions ───────────────────────────────────────────── */

export type Audience = { departmentIds?: string[]; locationIds?: string[] } | null;

/** Empty or missing means everyone; with both filters set, both must match. */
export function inAudience(
  person: { departmentId: string; locationId: string },
  audience: Audience,
): boolean {
  if (!audience) return true;
  const { departmentIds = [], locationIds = [] } = audience;
  const dept = departmentIds.length === 0 || departmentIds.includes(person.departmentId);
  const loc = locationIds.length === 0 || locationIds.includes(person.locationId);
  return dept && loc;
}

export const REACTIONS = ["like", "celebrate", "love", "insight"] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_LABELS: Record<ReactionKind, string> = {
  like: "Helpful",
  celebrate: "Celebrate",
  love: "Love it",
  insight: "Insightful",
};
