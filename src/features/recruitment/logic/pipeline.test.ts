import { describe, expect, it } from "vitest";

import {
  averageRating,
  daysSince,
  docFromText,
  moveProblem,
  orderBetween,
  restoreStage,
  stageCounts,
  suggestWorkEmail,
  textFromDoc,
} from "./pipeline";

describe("orderBetween", () => {
  it("lands between neighbours", () => {
    expect(orderBetween(1, 2)).toBe(1.5);
  });
  it("goes above the first card or below the last", () => {
    expect(orderBetween(null, 4)).toBe(3);
    expect(orderBetween(7, null)).toBe(8);
  });
  it("starts an empty column at zero", () => {
    expect(orderBetween(null, null)).toBe(0);
  });
});

describe("moveProblem", () => {
  it("allows moving along the pipeline in either direction", () => {
    expect(moveProblem("APPLIED", "INTERVIEW")).toBeNull();
    expect(moveProblem("OFFER", "SCREENING")).toBeNull();
    expect(moveProblem("INTERVIEW", "INTERVIEW")).toBeNull();
  });
  it("sends hiring and rejection through their own flows", () => {
    expect(moveProblem("OFFER", "HIRED")).toMatch(/Convert to employee/);
    expect(moveProblem("APPLIED", "REJECTED")).toMatch(/reason/);
  });
  it("never moves someone out of Hired", () => {
    expect(moveProblem("HIRED", "OFFER")).toMatch(/stay hired/);
  });
  it("lets a rejected candidate come back", () => {
    expect(moveProblem("REJECTED", "SCREENING")).toBeNull();
  });
});

describe("restoreStage", () => {
  it("returns to the furthest stage reached before rejection", () => {
    expect(restoreStage(["APPLIED", "SCREENING", "INTERVIEW", "REJECTED"])).toBe("INTERVIEW");
    expect(restoreStage(["APPLIED", "REJECTED"])).toBe("APPLIED");
  });
});

describe("helpers", () => {
  it("counts stages", () => {
    expect(stageCounts(["APPLIED", "APPLIED", "OFFER", "REJECTED"])).toMatchObject({
      APPLIED: 2,
      OFFER: 1,
      REJECTED: 1,
      HIRED: 0,
    });
  });

  it("counts whole days, never negative", () => {
    const d = new Date("2026-10-01T10:00:00Z");
    expect(daysSince(d, new Date("2026-10-03T09:00:00Z"))).toBe(1);
    expect(daysSince(d, new Date("2026-09-30T09:00:00Z"))).toBe(0);
  });

  it("suggests a work email, numbering clashes and dropping accents", () => {
    const taken = new Set(["ana.ramos@northwindgrove.in", "ana.ramos2@northwindgrove.in"]);
    expect(suggestWorkEmail("Ana", "Ramos", taken)).toBe("ana.ramos3@northwindgrove.in");
    expect(suggestWorkEmail("José", "D'Souza", new Set())).toBe("jose.dsouza@northwindgrove.in");
  });

  it("averages ratings, ignoring notes without one", () => {
    expect(averageRating([4, null, 5])).toBe(4.5);
    expect(averageRating([null])).toBeNull();
    expect(averageRating([3, 4, 4])).toBe(3.7);
  });

  it("round-trips descriptions through the stored document", () => {
    const text = "We're hiring.\n\nYou'll build things.";
    const doc = docFromText(`  ${text}\n\n\n`);
    expect(doc.content).toHaveLength(2);
    expect(textFromDoc(doc)).toBe(text);
    expect(textFromDoc(null)).toBe("");
  });
});
