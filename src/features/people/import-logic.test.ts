import { describe, expect, it } from "vitest";

import {
  TEMPLATE_CSV,
  parseEmploymentType,
  parseJoinDate,
  summarize,
  validateRows,
  type Lookups,
} from "./import-logic";
import { parseCsv } from "@/lib/csv";

const lookups: Lookups = {
  departments: [
    { id: "d-eng", name: "Engineering" },
    { id: "d-des", name: "Design" },
  ],
  designations: [
    { id: "g-swe", title: "Software Engineer", departmentId: "d-eng" },
    { id: "g-pd", title: "Product Designer", departmentId: "d-des" },
    { id: "g-any", title: "Intern", departmentId: null },
  ],
  locations: [
    { id: "l-blr", name: "Bengaluru office" },
    { id: "l-rem", name: "Remote (India)" },
  ],
  employees: [
    { id: "e-priya", workEmail: "priya.raman@northwindgrove.in", name: "Priya Raman" },
    { id: "e-arjun", workEmail: "arjun.mehta@northwindgrove.in", name: "Arjun Mehta" },
  ],
};

const base = {
  first_name: "Ananya",
  last_name: "Verma",
  work_email: "ananya.verma@northwindgrove.in",
  department: "Engineering",
  designation: "Software Engineer",
  location: "Bengaluru office",
  manager_email: "priya.raman@northwindgrove.in",
  employment_type: "Full time",
  join_date: "2026-12-01",
};

const run = (rows: Record<string, string>[]) => validateRows(rows, lookups, "2026-10-30");

describe("parsing helpers", () => {
  it("reads employment types loosely", () => {
    expect(parseEmploymentType("Full time")).toBe("FULL_TIME");
    expect(parseEmploymentType("PART-TIME")).toBe("PART_TIME");
    expect(parseEmploymentType("contractor")).toBe("CONTRACT");
    expect(parseEmploymentType("INTERN")).toBe("INTERN");
    expect(parseEmploymentType("volunteer")).toBeNull();
  });
  it("reads ISO and day-first dates, and rejects impossible ones", () => {
    expect(parseJoinDate("2026-12-01")).toBe("2026-12-01");
    expect(parseJoinDate("1/2/2026")).toBe("2026-02-01");
    expect(parseJoinDate("01.12.2026")).toBe("2026-12-01");
    expect(parseJoinDate("2026-02-30")).toBeNull();
    expect(parseJoinDate("31/04/2026")).toBeNull();
    expect(parseJoinDate("next week")).toBeNull();
  });
});

describe("validateRows", () => {
  it("accepts a good row and resolves every name to an id", () => {
    const [r] = run([base]);
    expect(r!.errors).toEqual([]);
    expect(r!.data).toMatchObject({
      workEmail: "ananya.verma@northwindgrove.in",
      departmentId: "d-eng",
      designationId: "g-swe",
      locationId: "l-blr",
      manager: { id: "e-priya" },
      employmentType: "FULL_TIME",
      joinDate: "2026-12-01",
    });
  });

  it("matches names loosely", () => {
    const [r] = run([
      {
        ...base,
        department: "  engineering ",
        location: "BENGALURU OFFICE",
        work_email: "A.Verma@NorthwindGrove.in",
      },
    ]);
    expect(r!.errors).toEqual([]);
    expect(r!.data!.workEmail).toBe("a.verma@northwindgrove.in");
  });

  it("says which required cells are empty", () => {
    const [r] = run([{ ...base, last_name: "", join_date: "" }]);
    expect(r!.data).toBeNull();
    expect(r!.errors).toEqual(expect.arrayContaining(["last name is empty", "join date is empty"]));
  });

  it("rejects the wrong email domain, and duplicates against Grove and within the file", () => {
    expect(run([{ ...base, work_email: "ana@gmail.com" }])[0]!.errors.join()).toMatch(
      /end in @northwindgrove.in/,
    );
    expect(
      run([{ ...base, work_email: "arjun.mehta@northwindgrove.in" }])[0]!.errors.join(),
    ).toMatch(/already belongs to Arjun Mehta/);
    const rows = run([base, { ...base, first_name: "Other" }]);
    expect(rows[0]!.data).not.toBeNull();
    expect(rows[1]!.errors.join()).toMatch(/also on line 2/);
  });

  it("finds designations only inside the chosen department", () => {
    expect(run([{ ...base, designation: "Product Designer" }])[0]!.errors.join()).toMatch(
      /isn't a designation in Engineering/,
    );
    expect(run([{ ...base, designation: "Intern" }])[0]!.errors).toEqual([]);
    expect(run([{ ...base, department: "Sales" }])[0]!.errors.join()).toMatch(
      /no department called "Sales"/,
    );
  });

  it("checks locations, types and dates", () => {
    const [r] = run([
      { ...base, location: "Mars", employment_type: "volunteer", join_date: "2026-02-30" },
    ]);
    expect(r!.errors.join()).toMatch(/no location called "Mars"/);
    expect(r!.errors.join()).toMatch(/employment type should be/);
    expect(r!.errors.join()).toMatch(/join date should look like/);
    expect(run([{ ...base, join_date: "1999-12-31" }])[0]!.errors.join()).toMatch(/before 2000/);
    expect(run([{ ...base, join_date: "2027-06-01" }])[0]!.errors.join()).toMatch(
      /six months away/,
    );
    expect(run([{ ...base, join_date: "2026-04-01" }])[0]!.errors).toEqual([]);
  });

  it("lets a manager be someone already here, or a row above", () => {
    const rows = run([
      base,
      {
        ...base,
        first_name: "Kabir",
        work_email: "kabir@northwindgrove.in",
        manager_email: "ananya.verma@northwindgrove.in",
      },
      {
        ...base,
        first_name: "Late",
        work_email: "late@northwindgrove.in",
        manager_email: "kabir.later@northwindgrove.in",
      },
      {
        ...base,
        first_name: "Self",
        work_email: "self@northwindgrove.in",
        manager_email: "self@northwindgrove.in",
      },
    ]);
    expect(rows[1]!.data!.manager).toEqual({ email: "ananya.verma@northwindgrove.in" });
    expect(rows[2]!.errors.join()).toMatch(/isn't in Grove or in a row above/);
    expect(rows[3]!.errors.join()).toMatch(/manage themselves/);
  });

  it("doesn't let a bad row be someone's manager", () => {
    const rows = run([
      { ...base, location: "Mars" },
      {
        ...base,
        first_name: "Kabir",
        work_email: "kabir@northwindgrove.in",
        manager_email: "ananya.verma@northwindgrove.in",
      },
    ]);
    expect(rows[0]!.data).toBeNull();
    expect(rows[1]!.data).toBeNull();
  });

  it("numbers lines from the header, and summarizes", () => {
    const rows = run([base, { ...base, work_email: "x" }]);
    expect(rows.map((r) => r.line)).toEqual([2, 3]);
    expect(summarize(rows)).toEqual({ total: 2, ready: 1, problems: 1 });
  });
});

describe("the template", () => {
  it("parses and validates against the lookups it was written for", () => {
    const parsed = parseCsv(TEMPLATE_CSV);
    expect(parsed.problems).toEqual([]);
    const rows = validateRows(parsed.rows, lookups, "2026-10-30");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.data)).toBe(true);
    // The second example is managed by the first.
    expect(rows[1]!.data!.manager).toEqual({ email: "ananya.verma@northwindgrove.in" });
  });
});
