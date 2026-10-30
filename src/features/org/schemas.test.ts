import { describe, expect, it } from "vitest";

import { departmentSchema, designationSchema } from "./schemas";

describe("departmentSchema", () => {
  const base = {
    name: "Engineering",
    code: "eng",
    description: "",
    colorToken: "chart-1" as const,
    headId: null,
  };

  it("uppercases codes and nulls an empty description", () => {
    expect(departmentSchema.parse(base)).toMatchObject({ code: "ENG", description: null });
  });

  it("rejects codes that aren't 2–6 letters", () => {
    for (const code of ["E", "ENGINEERS", "EN6", "E-N"]) {
      expect(departmentSchema.safeParse({ ...base, code }).success, code).toBe(false);
    }
  });
});

describe("designationSchema", () => {
  it("accepts numeric strings from form inputs", () => {
    expect(
      designationSchema.parse({ departmentId: "d", title: "Staff Engineer", level: "4" }).level,
    ).toBe(4);
  });

  it("keeps levels within the ladder", () => {
    expect(
      designationSchema.safeParse({ departmentId: "d", title: "CEO", level: 12 }).success,
    ).toBe(false);
  });
});
