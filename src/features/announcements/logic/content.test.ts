import { describe, expect, it } from "vitest";

import { docToText, inAudience, previewText, sanitizeDoc } from "./content";

const p = (text: string, marks?: object[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

describe("sanitizeDoc", () => {
  it("keeps allowed nodes and marks", () => {
    const doc = sanitizeDoc({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] },
        p("Bold and italic", [{ type: "bold" }, { type: "italic" }]),
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [p("One")] }],
        },
      ],
    });
    expect(doc.content.map((n) => n.type)).toEqual(["heading", "paragraph", "bulletList"]);
    expect(doc.content[1]!.content![0]!.marks).toEqual([{ type: "bold" }, { type: "italic" }]);
  });

  it("drops unknown nodes and marks, including scripts and images", () => {
    const doc = sanitizeDoc({
      type: "doc",
      content: [
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "image", attrs: { src: "javascript:alert(1)" } },
        p("fine", [{ type: "highlight" }, { type: "textStyle", attrs: { color: "red" } }]),
      ],
    });
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0]!.content![0]).toEqual({ type: "text", text: "fine" });
  });

  it("only allows web and mail links", () => {
    const link = (href: string) => p("x", [{ type: "link", attrs: { href } }]);
    const marks = (href: string) =>
      sanitizeDoc({ type: "doc", content: [link(href)] }).content[0]!.content![0]!.marks;
    expect(marks("https://example.com/a")).toEqual([
      { type: "link", attrs: { href: "https://example.com/a" } },
    ]);
    expect(marks("mailto:people@northwindgrove.in")).toHaveLength(1);
    expect(marks("javascript:alert(1)")).toBeUndefined();
    expect(marks("data:text/html,<b>x</b>")).toBeUndefined();
    expect(marks("not a url")).toBeUndefined();
  });

  it("clamps heading levels and survives junk", () => {
    const h = sanitizeDoc({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Big" }] }],
    });
    expect(h.content[0]!.attrs!.level).toBe(2);
    expect(sanitizeDoc(null)).toEqual({ type: "doc", content: [] });
    expect(sanitizeDoc("nope")).toEqual({ type: "doc", content: [] });
    expect(sanitizeDoc({ content: "x" })).toEqual({ type: "doc", content: [] });
  });

  it("limits nesting depth", () => {
    let node: object = p("deep");
    for (let i = 0; i < 20; i++) node = { type: "blockquote", content: [node] };
    const doc = sanitizeDoc({ type: "doc", content: [node] });
    expect(JSON.stringify(doc)).not.toContain("deep");
  });
});

describe("text", () => {
  const doc = sanitizeDoc({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Office closed" }] },
      p("The office is closed on Friday for Diwali, and everyone should enjoy the long weekend."),
    ],
  });
  it("flattens a document to searchable text", () => {
    expect(docToText(doc)).toBe(
      "Office closed The office is closed on Friday for Diwali, and everyone should enjoy the long weekend.",
    );
  });
  it("trims previews with an ellipsis", () => {
    const t = previewText(doc, 40);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t.endsWith("…")).toBe(true);
    expect(previewText(doc, 500)).toBe(docToText(doc));
  });
});

describe("inAudience", () => {
  const person = { departmentId: "eng", locationId: "blr" };
  it("reaches everyone when no audience is set", () => {
    expect(inAudience(person, null)).toBe(true);
    expect(inAudience(person, {})).toBe(true);
    expect(inAudience(person, { departmentIds: [], locationIds: [] })).toBe(true);
  });
  it("matches by department, location, or both", () => {
    expect(inAudience(person, { departmentIds: ["eng", "des"] })).toBe(true);
    expect(inAudience(person, { departmentIds: ["des"] })).toBe(false);
    expect(inAudience(person, { locationIds: ["remote"] })).toBe(false);
    expect(inAudience(person, { departmentIds: ["eng"], locationIds: ["remote"] })).toBe(false);
    expect(inAudience(person, { departmentIds: ["eng"], locationIds: ["blr"] })).toBe(true);
  });
});
