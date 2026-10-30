import { describe, expect, it } from "vitest";

import { highlightSegments } from "./highlight";

describe("highlightSegments", () => {
  it("marks the matching part and keeps the original casing", () => {
    expect(highlightSegments("Priya Raman", "ram")).toEqual([
      { text: "Priya ", match: false },
      { text: "Ram", match: true },
      { text: "an", match: false },
    ]);
  });

  it("matches every word of the query, in any order", () => {
    const segments = highlightSegments("Senior Product Designer", "designer senior");
    expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual(["Senior", "Designer"]);
  });

  it("returns the text untouched when nothing matches or the query is empty", () => {
    expect(highlightSegments("Leave policy", "payroll")).toEqual([
      { text: "Leave policy", match: false },
    ]);
    expect(highlightSegments("Leave policy", "   ")).toEqual([
      { text: "Leave policy", match: false },
    ]);
    expect(highlightSegments("", "x")).toEqual([]);
  });

  it("treats regex characters as plain text", () => {
    expect(highlightSegments("C++ (senior) engineer", "c++ (sen")).toEqual([
      { text: "C++", match: true },
      { text: " ", match: false },
      { text: "(sen", match: true },
      { text: "ior) engineer", match: false },
    ]);
  });

  it("merges overlapping and adjacent matches into one run", () => {
    expect(highlightSegments("abcd", "ab cd")).toEqual([{ text: "abcd", match: true }]);
    expect(highlightSegments("design", "des design")).toEqual([{ text: "design", match: true }]);
  });

  it("always reassembles to the original text", () => {
    const text = "Q3 goal: Reduce time-to-hire (days)";
    const joined = highlightSegments(text, "time hire (d")
      .map((s) => s.text)
      .join("");
    expect(joined).toBe(text);
  });
});
