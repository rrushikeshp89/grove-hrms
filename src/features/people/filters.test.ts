import { describe, expect, it } from "vitest";

import { activeFilterCount, DEFAULT_FILTERS, parseFilters, serializeFilters } from "./filters";

describe("parseFilters", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("reads every supported filter", () => {
    const f = parseFilters(
      new URLSearchParams(
        "q=priya&department=ENG&location=cmabc12345&status=NOTICE&type=CONTRACT&sort=joined-desc&view=table",
      ),
    );
    expect(f).toEqual({
      q: "priya",
      department: "ENG",
      location: "cmabc12345",
      status: "NOTICE",
      type: "CONTRACT",
      sort: "joined-desc",
      view: "table",
    });
  });

  it("ignores malformed or unknown values instead of failing", () => {
    const f = parseFilters({
      department: "eng; drop table",
      status: "FIRED",
      type: ["INTERN", "CONTRACT"],
      sort: "salary",
      view: "cards",
      location: "../etc",
    });
    expect(f).toMatchObject({
      department: null,
      status: null,
      type: "INTERN",
      sort: "name",
      view: "grid",
      location: null,
    });
  });

  it("trims and caps the search text", () => {
    expect(parseFilters({ q: `  ${"a".repeat(200)} ` }).q).toHaveLength(80);
  });
});

describe("serializeFilters", () => {
  it("omits defaults", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
    expect(serializeFilters({ q: "  " })).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const original = { ...DEFAULT_FILTERS, q: "rao", department: "FIN", view: "table" as const };
    expect(parseFilters(new URLSearchParams(serializeFilters(original)))).toEqual(original);
  });
});

describe("activeFilterCount", () => {
  it("counts narrowing filters, not search, sort or view", () => {
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, q: "x", sort: "department", view: "table" }),
    ).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, department: "ENG", status: "ACTIVE" })).toBe(2);
  });
});
