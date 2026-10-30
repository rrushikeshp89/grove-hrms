import "server-only";

import { db } from "@/lib/db";

import { EMPLOYMENT_LABELS, STATUS_META, displayName } from "./format";

type AuditRow = {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  actor: { name: string } | null;
};

export type ActivityKind = "joined" | "job" | "profile" | "private" | "contact" | "created";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  actor: string | null;
  at: string;
};

const FIELD_LABELS: Record<string, string> = {
  preferredName: "preferred name",
  pronouns: "pronouns",
  bio: "bio",
  skills: "skills",
  phone: "phone",
  personalEmail: "personal email",
  dateOfBirth: "date of birth",
  address: "address",
  designationId: "designation",
  departmentId: "department",
  locationId: "location",
  managerId: "manager",
  employmentType: "employment type",
  status: "status",
  joinDate: "joining date",
};

const list = (keys: string[]) => {
  const labels = keys.map((k) => FIELD_LABELS[k] ?? k);
  return labels.length <= 2
    ? labels.join(" and ")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
};

const asRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/**
 * Turns raw audit rows into sentences. Ids in job changes are resolved to
 * names in one round trip, so the timeline reads "Senior Engineer → Staff
 * Engineer" rather than showing database ids.
 */
export async function describeActivity(rows: AuditRow[], joinDate: Date): Promise<ActivityItem[]> {
  const ids = {
    designation: new Set<string>(),
    department: new Set<string>(),
    location: new Set<string>(),
    employee: new Set<string>(),
  };
  for (const r of rows) {
    if (r.action !== "employee.update_job") continue;
    for (const side of [asRecord(r.before), asRecord(r.after)]) {
      if (typeof side.designationId === "string") ids.designation.add(side.designationId);
      if (typeof side.departmentId === "string") ids.department.add(side.departmentId);
      if (typeof side.locationId === "string") ids.location.add(side.locationId);
      if (typeof side.managerId === "string") ids.employee.add(side.managerId);
    }
  }
  const [designations, departments, locations, managers] = await Promise.all([
    db.designation.findMany({
      where: { id: { in: [...ids.designation] } },
      select: { id: true, title: true },
    }),
    db.department.findMany({
      where: { id: { in: [...ids.department] } },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { id: { in: [...ids.location] } },
      select: { id: true, name: true },
    }),
    db.employee.findMany({
      where: { id: { in: [...ids.employee] } },
      select: { id: true, firstName: true, lastName: true, preferredName: true },
    }),
  ]);
  const names = new Map<string, string>([
    ...designations.map((d) => [d.id, d.title] as const),
    ...departments.map((d) => [d.id, d.name] as const),
    ...locations.map((l) => [l.id, l.name] as const),
    ...managers.map((m) => [m.id, displayName(m)] as const),
  ]);

  const valueLabel = (key: string, v: unknown): string => {
    if (v == null || v === "") return "none";
    if (key === "status") return STATUS_META[v as keyof typeof STATUS_META]?.label ?? String(v);
    if (key === "employmentType")
      return EMPLOYMENT_LABELS[v as keyof typeof EMPLOYMENT_LABELS] ?? String(v);
    if (typeof v === "string" && names.has(v)) return names.get(v)!;
    return String(v);
  };

  const items: ActivityItem[] = rows.map((r) => {
    const before = asRecord(r.before);
    const after = asRecord(r.after);
    const base = { id: r.id, actor: r.actor?.name ?? null, at: r.createdAt.toISOString() };
    switch (r.action) {
      case "employee.create":
        return { ...base, kind: "created", title: "Added to Grove", detail: null };
      case "employee.update_job": {
        const keys = Object.keys(after);
        const promoted = keys.length === 1 && keys[0] === "designationId";
        return {
          ...base,
          kind: "job",
          title: promoted ? "Changed designation" : `Updated ${list(keys)}`,
          detail: keys
            .map((k) => `${valueLabel(k, before[k])} → ${valueLabel(k, after[k])}`)
            .join(" · "),
        };
      }
      case "employee.update_personal":
        return {
          ...base,
          kind: "profile",
          title: `Updated ${list(Object.keys(after))}`,
          detail: null,
        };
      case "employee.update_private": {
        const fields = Array.isArray(after.fields) ? (after.fields as string[]) : [];
        return {
          ...base,
          kind: "private",
          title: `Updated private details`,
          detail: fields.length ? list(fields) : null,
        };
      }
      case "employee.add_emergency_contact":
        return {
          ...base,
          kind: "contact",
          title: "Added an emergency contact",
          detail: `${after.name} (${after.relationship})`,
        };
      case "employee.update_emergency_contact":
        return {
          ...base,
          kind: "contact",
          title: "Updated an emergency contact",
          detail: `${after.name} (${after.relationship})`,
        };
      case "employee.remove_emergency_contact":
        return {
          ...base,
          kind: "contact",
          title: "Removed an emergency contact",
          detail: `${before.name} (${before.relationship})`,
        };
      default:
        return { ...base, kind: "profile", title: r.action, detail: null };
    }
  });

  items.push({
    id: "joined",
    kind: "joined",
    title: "Joined Northwind Grove",
    detail: null,
    actor: null,
    at: joinDate.toISOString(),
  });
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
