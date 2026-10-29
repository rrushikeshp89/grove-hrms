import { describe, expect, it } from "vitest";

import { dayPart, formatMoney, greeting, initials } from "./format";

describe("greeting", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [23, "evening"],
    [2, "evening"],
  ] as const)("hour %i is %s", (hour, part) => {
    expect(dayPart(hour)).toBe(part);
  });

  it("addresses the person by name", () => {
    expect(greeting("Priya", 9)).toBe("Good morning, Priya");
  });
});

describe("formatMoney", () => {
  it("formats paise as rupees with Indian digit grouping", () => {
    expect(formatMoney(12_34_567_00)).toBe("₹12,34,567");
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Priya Lakshmi Raman")).toBe("PR");
    expect(initials("Ade")).toBe("A");
    expect(initials("  ")).toBe("");
  });
});
