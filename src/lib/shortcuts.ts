/**
 * Keyboard shortcut parsing and matching. Pure so it can be unit tested;
 * the React side lives in components/shell/actions-provider.tsx.
 *
 * Spec format: steps separated by spaces, modifiers joined with "+".
 *   "mod+k"  -> Cmd+K on macOS, Ctrl+K elsewhere
 *   "g d"    -> press g, then d
 *   "?"      -> the question mark, however the layout produces it
 */

export type KeyStep = { key: string; mod: boolean; shift: boolean; alt: boolean };

export type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

const ALIASES: Record<string, string> = { esc: "escape", space: " ", slash: "/" };

export function parseShortcut(spec: string): KeyStep[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((chord) => {
      const parts = chord.toLowerCase().split("+");
      const raw = parts.pop() ?? "";
      const key = ALIASES[raw] ?? raw;
      return {
        key,
        mod: parts.includes("mod"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
      };
    });
}

/** Keys whose glyph already implies Shift on most layouts. */
const SHIFTED_GLYPHS = new Set('?!@#$%^&*()_{}|:"<>~'.split(""));

export function matchesStep(step: KeyStep, e: KeyEventLike, isMac: boolean): boolean {
  if (e.key.toLowerCase() !== step.key) return false;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod !== step.mod) return false;
  // the "other" platform modifier must not be held
  if (isMac ? e.ctrlKey : e.metaKey) return false;
  if (e.altKey !== step.alt) return false;
  if (!SHIFTED_GLYPHS.has(step.key) && e.shiftKey !== step.shift) return false;
  return true;
}

export type Binding = { id: string; steps: KeyStep[] };

const MODIFIER_KEYS = new Set(["shift", "control", "meta", "alt"]);

/**
 * Feeds key events one at a time and reports a completed binding. Multi-step
 * sequences ("g d") must be typed within `timeoutMs` of each other.
 */
export function createSequenceMatcher(bindings: Binding[], isMac: boolean, timeoutMs = 1000) {
  let buffer: KeyEventLike[] = [];
  let lastAt = -Infinity;

  return function feed(e: KeyEventLike, now: number): string | null {
    if (MODIFIER_KEYS.has(e.key.toLowerCase())) return null;
    if (now - lastAt > timeoutMs) buffer = [];
    lastAt = now;
    buffer = [...buffer, e].slice(-3);

    // Prefer the longest sequence that ends with this key press.
    let best: Binding | null = null;
    for (const b of bindings) {
      if (b.steps.length > buffer.length) continue;
      const tail = buffer.slice(-b.steps.length);
      const ok = b.steps.every((s, i) => matchesStep(s, tail[i]!, isMac));
      if (ok && (!best || b.steps.length > best.steps.length)) best = b;
    }
    if (best) buffer = [];
    return best?.id ?? null;
  };
}

function capLabel(key: string): string {
  if (key === " ") return "Space";
  if (key === "escape") return "Esc";
  if (key.length === 1) return key.toUpperCase();
  return key[0]!.toUpperCase() + key.slice(1);
}

/** Human-readable keycaps for the cheat sheet and palette. */
export function formatShortcut(spec: string, isMac: boolean): string[][] {
  return parseShortcut(spec).map((s) => {
    const caps: string[] = [];
    if (s.mod) caps.push(isMac ? "⌘" : "Ctrl");
    if (s.alt) caps.push(isMac ? "⌥" : "Alt");
    if (s.shift) caps.push(isMac ? "⇧" : "Shift");
    caps.push(capLabel(s.key));
    return caps;
  });
}

/** Don't fire single-key shortcuts while someone is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  return !!el.closest("input, textarea, select, [contenteditable='true'], [role='textbox']");
}
