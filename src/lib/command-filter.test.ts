import { describe, expect, it } from "vitest";

import { commandScore } from "./command-filter";

describe("commandScore", () => {
  it("shows everything for an empty search", () => {
    expect(commandScore("Foundations", "  ")).toBe(1);
  });

  it("ranks a label prefix highest", () => {
    expect(commandScore("Components", "comp")).toBe(1);
  });

  it("matches the start of any word in the label", () => {
    expect(commandScore("Toggle dark mode", "dark")).toBeGreaterThan(0.8);
    expect(commandScore("Apply for leave", "app lea")).toBeGreaterThan(0.8);
  });

  it("falls back to keywords", () => {
    expect(commandScore("Foundations", "color", ["color", "type"])).toBeGreaterThan(0);
  });

  it("does not stitch letters across keywords", () => {
    expect(commandScore("Foundations", "dark", ["color", "type", "tokens", "spacing"])).toBe(0);
  });

  it("prefers a label hit over a keyword hit", () => {
    const label = commandScore("Toggle dark mode", "dark");
    const keyword = commandScore("Preferences", "dark", ["dark"]);
    expect(label).toBeGreaterThan(keyword);
  });
});
