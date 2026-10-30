import { describe, expect, it } from "vitest";

import {
  emergencyContactSchema,
  newEmployeeSchema,
  personalSchema,
  privateSchema,
} from "./schemas";

describe("personalSchema", () => {
  it("turns blank optional fields into null and dedupes skills", () => {
    const r = personalSchema.parse({
      employeeId: "e1",
      preferredName: "  ",
      pronouns: "she/her",
      bio: "",
      skills: ["React", "React", " Figma "],
    });
    expect(r).toEqual({
      employeeId: "e1",
      preferredName: null,
      pronouns: "she/her",
      bio: null,
      skills: ["React", "Figma"],
    });
  });

  it("caps the number of skills", () => {
    const r = personalSchema.safeParse({
      employeeId: "e1",
      preferredName: null,
      pronouns: null,
      bio: null,
      skills: Array.from({ length: 13 }, (_, i) => `s${i}`),
    });
    expect(r.success).toBe(false);
  });
});

describe("privateSchema", () => {
  const base = {
    employeeId: "e1",
    personalEmail: "",
    dateOfBirth: null,
    area: "",
    city: "",
    state: "",
  };

  it("normalizes Indian phone numbers", () => {
    expect(privateSchema.parse({ ...base, phone: "+91 98765 43210" }).phone).toBe("+919876543210");
    expect(privateSchema.parse({ ...base, phone: "" }).phone).toBeNull();
    expect(privateSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
  });

  it("validates personal email only when given", () => {
    expect(
      privateSchema.parse({ ...base, phone: "", personalEmail: " A@B.com " }).personalEmail,
    ).toBe("a@b.com");
    expect(privateSchema.safeParse({ ...base, phone: "", personalEmail: "nope" }).success).toBe(
      false,
    );
  });

  it("rejects impossible dates", () => {
    expect(privateSchema.safeParse({ ...base, phone: "", dateOfBirth: "1994-13-40" }).success).toBe(
      false,
    );
  });
});

describe("emergencyContactSchema", () => {
  it("requires a reachable phone number", () => {
    const r = emergencyContactSchema.safeParse({
      employeeId: "e1",
      name: "Sunita Mehta",
      relationship: "Mother",
      phone: "98-765-43210",
      isPrimary: true,
    });
    expect(r.success && r.data.phone).toBe("9876543210");
  });
});

describe("newEmployeeSchema", () => {
  it("only accepts company email addresses", () => {
    const r = newEmployeeSchema.safeParse({
      firstName: "Asha",
      lastName: "Poojary",
      workEmail: "asha@gmail.com",
      designationId: "d",
      departmentId: "d",
      locationId: "l",
      managerId: "m",
      employmentType: "FULL_TIME",
      joinDate: "2026-11-02",
    });
    expect(r.error?.issues[0]?.message).toBe("Work emails end in @northwindgrove.in");
  });
});
