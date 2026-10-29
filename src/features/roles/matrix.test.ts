import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/lib/rbac";

import { PERMISSION_AREAS } from "./matrix";

describe("PERMISSION_AREAS", () => {
  it("lists every permission exactly once", () => {
    const listed = PERMISSION_AREAS.flatMap((a) => a.permissions);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });
});
