import { describe, expect, it } from "vitest";

import {
  dayRange,
  describeAction,
  diffJson,
  domainLabel,
  domainOf,
  entityHref,
  filtersToQuery,
  parseFilters,
} from "./logic";

describe("describeAction", () => {
  it("names the actions the app writes", () => {
    expect(describeAction("payroll.run.finalize")).toBe("Finalized a pay run");
    expect(describeAction("request.reject")).toBe("Declined a request");
  });
  it("tidies anything it doesn't know", () => {
    expect(describeAction("vendor.invoice_paid")).toBe("Vendor invoice paid");
  });
  it("groups by the first part", () => {
    expect(domainOf("payroll.run.finalize")).toBe("payroll");
    expect(domainLabel("payroll")).toBe("Payroll");
    expect(domainLabel("weird")).toBe("Weird");
  });
});

describe("entityHref", () => {
  it("links to pages that exist, and nothing else", () => {
    expect(entityHref("Employee", "e1")).toBe("/people/e1");
    expect(entityHref("PayrollRun", "r1")).toBe("/payroll/r1");
    expect(entityHref("Candidate", "c1")).toBe("/hiring/candidates/c1");
    expect(entityHref("Document", "d1")).toBeNull();
  });
});

describe("diffJson", () => {
  it("marks changed, added and removed keys, changed first", () => {
    const rows = diffJson(
      { title: "Engineer", level: 3, team: "Web" },
      { title: "Senior Engineer", level: 3, manager: "Priya" },
    );
    expect(rows.map((r) => [r.key, r.change])).toEqual([
      ["title", "changed"],
      ["manager", "added"],
      ["team", "removed"],
      ["level", "same"],
    ]);
    expect(rows[0]).toMatchObject({ before: "Engineer", after: "Senior Engineer" });
    expect(rows.find((r) => r.key === "level")).toMatchObject({ before: "3", after: "3" });
  });

  it("copes with nothing on one side, and with nested values", () => {
    expect(diffJson(null, { status: "ACTIVE" })).toEqual([
      { key: "status", before: null, after: "ACTIVE", change: "added" },
    ]);
    const nested = diffJson({ audience: { ids: [1] } }, { audience: { ids: [1, 2] } });
    expect(nested[0]).toMatchObject({
      change: "changed",
      before: '{"ids":[1]}',
      after: '{"ids":[1,2]}',
    });
    expect(diffJson(undefined, undefined)).toEqual([]);
  });

  it("wraps a bare value so it can still be shown", () => {
    expect(diffJson("old", "new")[0]).toMatchObject({ key: "value", before: "old", after: "new" });
  });
});

describe("filters", () => {
  it("reads the URL, trimming and ignoring bad dates", () => {
    const f = parseFilters({
      actor: " u1 ",
      domain: "payroll",
      from: "2026-10-01",
      to: "not-a-date",
      q: "",
    });
    expect(f).toEqual({
      actor: "u1",
      domain: "payroll",
      entity: null,
      from: "2026-10-01",
      to: null,
      q: null,
    });
  });
  it("puts a reversed range the right way round", () => {
    const f = parseFilters({ from: "2026-10-30", to: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-10-30"]);
  });
  it("round-trips through a query string", () => {
    const f = parseFilters({ domain: "leave", q: "arjun" });
    expect(filtersToQuery(f)).toBe("domain=leave&q=arjun");
  });
  it("turns a day range into instants that include the whole last day", () => {
    const r = dayRange("2026-10-01", "2026-10-02");
    // IST midnight is 18:30 UTC the day before.
    expect(r.gte?.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(r.lt?.toISOString()).toBe("2026-10-02T18:30:00.000Z");
    expect(dayRange(null, null)).toEqual({ gte: undefined, lt: undefined });
  });
});
