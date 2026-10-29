import { describe, expect, it } from "vitest";

import {
  createSequenceMatcher,
  formatShortcut,
  matchesStep,
  parseShortcut,
  type KeyEventLike,
} from "./shortcuts";

const ev = (key: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("parseShortcut", () => {
  it("parses modifiers and sequences", () => {
    expect(parseShortcut("mod+k")).toEqual([{ key: "k", mod: true, shift: false, alt: false }]);
    expect(parseShortcut("g d").map((s) => s.key)).toEqual(["g", "d"]);
    expect(parseShortcut("esc")[0]?.key).toBe("escape");
  });
});

describe("matchesStep", () => {
  const modK = parseShortcut("mod+k")[0]!;

  it("maps mod to Cmd on macOS and Ctrl elsewhere", () => {
    expect(matchesStep(modK, ev("k", { metaKey: true }), true)).toBe(true);
    expect(matchesStep(modK, ev("k", { ctrlKey: true }), true)).toBe(false);
    expect(matchesStep(modK, ev("k", { ctrlKey: true }), false)).toBe(true);
    expect(matchesStep(modK, ev("k", { metaKey: true }), false)).toBe(false);
  });

  it("ignores the case of letter keys", () => {
    expect(matchesStep(modK, ev("K", { ctrlKey: true }), false)).toBe(true);
  });

  it("does not require Shift to be declared for shifted glyphs like ?", () => {
    const q = parseShortcut("?")[0]!;
    expect(matchesStep(q, ev("?", { shiftKey: true }), false)).toBe(true);
  });

  it("rejects extra modifiers", () => {
    const g = parseShortcut("g")[0]!;
    expect(matchesStep(g, ev("g", { ctrlKey: true }), false)).toBe(false);
    expect(matchesStep(g, ev("g", { altKey: true }), false)).toBe(false);
    expect(matchesStep(g, ev("G", { shiftKey: true }), false)).toBe(false);
  });
});

describe("createSequenceMatcher", () => {
  const bindings = [
    { id: "palette", steps: parseShortcut("mod+k") },
    { id: "go-design", steps: parseShortcut("g d") },
    { id: "help", steps: parseShortcut("?") },
  ];

  it("matches single chords", () => {
    const feed = createSequenceMatcher(bindings, false);
    expect(feed(ev("k", { ctrlKey: true }), 0)).toBe("palette");
  });

  it("matches a two-step sequence typed in time", () => {
    const feed = createSequenceMatcher(bindings, false);
    expect(feed(ev("g"), 0)).toBeNull();
    expect(feed(ev("d"), 400)).toBe("go-design");
  });

  it("drops a sequence when the second key comes too late", () => {
    const feed = createSequenceMatcher(bindings, false, 1000);
    feed(ev("g"), 0);
    expect(feed(ev("d"), 1500)).toBeNull();
  });

  it("ignores bare modifier presses between steps", () => {
    const feed = createSequenceMatcher(bindings, false);
    feed(ev("g"), 0);
    expect(feed(ev("Shift", { shiftKey: true }), 100)).toBeNull();
    expect(feed(ev("d"), 200)).toBe("go-design");
  });

  it("resets after a match so keys are not reused", () => {
    const feed = createSequenceMatcher(bindings, false);
    feed(ev("g"), 0);
    feed(ev("d"), 100);
    expect(feed(ev("d"), 200)).toBeNull();
  });
});

describe("formatShortcut", () => {
  it("renders platform keycaps", () => {
    expect(formatShortcut("mod+k", true)).toEqual([["⌘", "K"]]);
    expect(formatShortcut("mod+k", false)).toEqual([["Ctrl", "K"]]);
    expect(formatShortcut("g d", false)).toEqual([["G"], ["D"]]);
  });
});
