import { EMPLOYMENT_TYPES, type EmploymentType } from "./filters";

/**
 * Validating a file of new employees, row by row, before anything is
 * written. Pure: it's handed the lookups it needs, so the same rules run in
 * the preview, in the import itself and in tests.
 */

export const IMPORT_COLUMNS = [
  "first_name",
  "last_name",
  "work_email",
  "department",
  "designation",
  "location",
  "manager_email",
  "employment_type",
  "join_date",
] as const;

export const MAX_IMPORT_ROWS = 200;
export const EMAIL_DOMAIN = "@northwindgrove.in";

export const TEMPLATE_CSV =
  IMPORT_COLUMNS.join(",") +
  "\r\n" +
  "Ananya,Verma,ananya.verma@northwindgrove.in,Engineering,Software Engineer,Bengaluru office,priya.raman@northwindgrove.in,Full time,2026-12-01\r\n" +
  "Kabir,Shah,kabir.shah@northwindgrove.in,Design,Product Designer,Remote (India),ananya.verma@northwindgrove.in,Contract,2026-12-07\r\n";

export type Lookups = {
  departments: { id: string; name: string }[];
  designations: { id: string; title: string; departmentId: string | null }[];
  locations: { id: string; name: string }[];
  /** Everyone already in Grove, for managers and for catching duplicate emails. */
  employees: { id: string; workEmail: string; name: string }[];
};

export type ImportRow = {
  line: number;
  errors: string[];
  /** What the preview table shows, even for rows with problems. */
  display: {
    name: string;
    email: string;
    department: string;
    designation: string;
    location: string;
    manager: string;
    employmentType: string;
    joinDate: string;
  };
  /** Present only for rows that can be imported. */
  data: {
    firstName: string;
    lastName: string;
    workEmail: string;
    departmentId: string;
    designationId: string;
    locationId: string;
    /** An existing employee's id, or the email of a row earlier in the file. */
    manager: { id: string } | { email: string };
    employmentType: EmploymentType;
    joinDate: string;
  } | null;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const TYPE_ALIASES: Record<string, EmploymentType> = {
  "full time": "FULL_TIME",
  "full-time": "FULL_TIME",
  full_time: "FULL_TIME",
  fulltime: "FULL_TIME",
  "part time": "PART_TIME",
  "part-time": "PART_TIME",
  part_time: "PART_TIME",
  parttime: "PART_TIME",
  contract: "CONTRACT",
  contractor: "CONTRACT",
  intern: "INTERN",
  internship: "INTERN",
};

export function parseEmploymentType(v: string): EmploymentType | null {
  const key = norm(v);
  const direct = EMPLOYMENT_TYPES.find((t) => t.toLowerCase() === key);
  return direct ?? TYPE_ALIASES[key] ?? null;
}

const valid = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** 2026-12-01 or 01/12/2026 (day first, as people write it in India). */
export function parseJoinDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  } else return null;
  if (!valid(y, mo, d)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const addDaysIso = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRows(
  rows: readonly Record<string, string>[],
  lookups: Lookups,
  today: string,
): ImportRow[] {
  const existingByEmail = new Map(lookups.employees.map((e) => [norm(e.workEmail), e]));
  const deptByName = new Map(lookups.departments.map((d) => [norm(d.name), d]));
  const locByName = new Map(lookups.locations.map((l) => [norm(l.name), l]));
  const seen = new Map<string, number>();
  const results: ImportRow[] = [];

  rows.forEach((raw, i) => {
    const line = i + 2; // the header is line 1
    const get = (k: string) => (raw[k] ?? "").trim();
    const errors: string[] = [];
    const display = {
      name: `${get("first_name")} ${get("last_name")}`.trim(),
      email: get("work_email").toLowerCase(),
      department: get("department"),
      designation: get("designation"),
      location: get("location"),
      manager: get("manager_email").toLowerCase(),
      employmentType: get("employment_type"),
      joinDate: get("join_date"),
    };

    for (const k of [
      "first_name",
      "last_name",
      "work_email",
      "department",
      "designation",
      "location",
      "manager_email",
      "employment_type",
      "join_date",
    ]) {
      if (!get(k)) errors.push(`${k.replace(/_/g, " ")} is empty`);
    }

    const email = display.email;
    if (email) {
      if (!EMAIL.test(email)) errors.push("work email isn't a valid address");
      else if (!email.endsWith(EMAIL_DOMAIN)) errors.push(`work emails end in ${EMAIL_DOMAIN}`);
      else if (existingByEmail.has(email))
        errors.push(`${email} already belongs to ${existingByEmail.get(email)!.name}`);
      else if (seen.has(email)) errors.push(`${email} is also on line ${seen.get(email)}`);
      if (EMAIL.test(email) && !seen.has(email)) seen.set(email, line);
    }

    const dept = deptByName.get(norm(get("department")));
    if (get("department") && !dept) errors.push(`no department called "${get("department")}"`);
    const designation = dept
      ? lookups.designations.find(
          (d) =>
            norm(d.title) === norm(get("designation")) &&
            (d.departmentId === null || d.departmentId === dept.id),
        )
      : undefined;
    if (dept && get("designation") && !designation) {
      errors.push(`"${get("designation")}" isn't a designation in ${dept.name}`);
    }
    const loc = locByName.get(norm(get("location")));
    if (get("location") && !loc) errors.push(`no location called "${get("location")}"`);

    const type = get("employment_type") ? parseEmploymentType(get("employment_type")) : null;
    if (get("employment_type") && !type)
      errors.push("employment type should be Full time, Part time, Contract or Intern");

    const joinDate = get("join_date") ? parseJoinDate(get("join_date")) : null;
    if (get("join_date")) {
      if (!joinDate) errors.push("join date should look like 2026-12-01 or 01/12/2026");
      else if (joinDate < "2000-01-01") errors.push("join date is before 2000");
      else if (joinDate > addDaysIso(today, 180))
        errors.push("join date is more than six months away");
    }

    // A manager is someone already in Grove, or a row above this one.
    const managerEmail = display.manager;
    let manager: { id: string } | { email: string } | null = null;
    if (managerEmail) {
      const existing = existingByEmail.get(managerEmail);
      const earlier = results.find((r) => r.data && r.data.workEmail === managerEmail);
      if (existing) manager = { id: existing.id };
      else if (earlier) manager = { email: managerEmail };
      else if (managerEmail === email) errors.push("someone can't manage themselves");
      else errors.push(`manager ${managerEmail} isn't in Grove or in a row above this one`);
    }

    let data: ImportRow["data"] = null;
    if (errors.length === 0 && dept && designation && loc && type && joinDate && manager) {
      data = {
        firstName: get("first_name"),
        lastName: get("last_name"),
        workEmail: email,
        departmentId: dept.id,
        designationId: designation.id,
        locationId: loc.id,
        manager,
        employmentType: type,
        joinDate,
      };
    }
    results.push({ line, errors, display, data });
  });
  return results;
}

export function summarize(rows: readonly ImportRow[]) {
  const ready = rows.filter((r) => r.data).length;
  return { total: rows.length, ready, problems: rows.length - ready };
}
