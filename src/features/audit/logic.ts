import { instantAt, type ISODate } from "@/lib/tz";

/** Readable names for the actions the app writes; anything else is tidied from its key. */
const NAMES: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "employee.create": "Added an employee",
  "employee.update": "Edited a profile",
  "employee.offboard": "Started offboarding",
  "request.approve": "Approved a request",
  "request.reject": "Declined a request",
  "leave.apply": "Applied for leave",
  "leave.cancel": "Cancelled leave",
  "attendance.request_correction": "Asked for an attendance correction",
  "candidate.create": "Added a candidate",
  "candidate.move": "Moved a candidate",
  "candidate.reject": "Passed on a candidate",
  "candidate.restore": "Brought a candidate back",
  "candidate.hire": "Hired a candidate",
  "job.create": "Opened a role",
  "job.update": "Edited a role",
  "payroll.run.create": "Started a pay run",
  "payroll.run.regenerate": "Recalculated a pay run",
  "payroll.run.submit": "Sent a pay run for review",
  "payroll.run.return": "Sent a pay run back",
  "payroll.run.finalize": "Finalized a pay run",
  "payroll.salary.revise": "Revised a salary",
  "document.upload": "Uploaded a document",
  "document.delete": "Deleted a document",
  "announcement.create": "Wrote an announcement",
  "announcement.update": "Edited an announcement",
  "announcement.delete": "Deleted an announcement",
  "goal.create": "Created a goal",
  "goal.update": "Edited a goal",
  "goal.checkin": "Checked in on a goal",
  "goal.delete": "Deleted a goal",
  "cycle.create": "Created a review cycle",
  "cycle.advance": "Moved a review cycle on",
  "review.submit": "Submitted a review",
  "review.save": "Saved a review draft",
  "feedback.request": "Asked for peer feedback",
  "checklist.task.complete": "Completed a checklist task",
  "checklist.task.reopen": "Reopened a checklist task",
  "checklist.template.update": "Edited a checklist template",
  "settings.company.update": "Changed company settings",
  "settings.schedule.update": "Changed working hours",
  "leave.type.save": "Saved a leave type",
  "holiday.save": "Saved a holiday",
  "holiday.delete": "Removed a holiday",
  "role.change": "Changed someone's role",
  "people.import": "Imported people from a file",
};

export function describeAction(action: string): string {
  const known = NAMES[action];
  if (known) return known;
  const words = action.split(/[._]/).filter(Boolean);
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The first part of an action ("payroll" in "payroll.run.finalize"), for grouping and filtering. */
export const domainOf = (action: string) => action.split(".")[0] ?? action;

export const DOMAIN_LABELS: Record<string, string> = {
  auth: "Sign-ins",
  employee: "People",
  request: "Approvals",
  leave: "Leave",
  attendance: "Attendance",
  candidate: "Hiring",
  job: "Hiring",
  payroll: "Payroll",
  document: "Documents",
  announcement: "Announcements",
  goal: "Goals",
  cycle: "Reviews",
  review: "Reviews",
  feedback: "Reviews",
  checklist: "Onboarding",
  settings: "Settings",
  holiday: "Settings",
  role: "Roles",
  people: "People",
};

export const domainLabel = (domain: string) =>
  DOMAIN_LABELS[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1);

/** Where to look at the thing an entry was about, when there's a page for it. */
export function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Employee":
      return `/people/${entityId}`;
    case "Goal":
      return `/performance/goals/${entityId}`;
    case "PayrollRun":
      return `/payroll/${entityId}`;
    case "JobPosting":
      return `/hiring/${entityId}`;
    case "Candidate":
      return `/hiring/candidates/${entityId}`;
    case "Checklist":
      return `/lifecycle/${entityId}`;
    case "ReviewCycle":
      return `/performance/cycles/${entityId}`;
    case "Announcement":
      return "/announcements";
    case "Request":
      return "/approvals";
    default:
      return null;
  }
}

/* ─── Diffs ────────────────────────────────────────────────────────────── */

export type DiffRow = {
  key: string;
  before: string | null;
  after: string | null;
  change: "added" | "removed" | "changed" | "same";
};

const show = (v: unknown): string | null =>
  v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);

/**
 * Compares the two snapshots an entry carries, key by key. Changed keys come
 * first, then the unchanged ones for context.
 */
export function diffJson(before: unknown, after: unknown): DiffRow[] {
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : v === null || v === undefined
        ? {}
        : { value: v };
  const b = obj(before);
  const a = obj(after);
  const rows = [...new Set([...Object.keys(b), ...Object.keys(a)])].map((key): DiffRow => {
    const inB = key in b;
    const inA = key in a;
    const bs = show(b[key]);
    const as = show(a[key]);
    const change = !inB ? "added" : !inA ? "removed" : bs === as ? "same" : "changed";
    return { key, before: bs, after: as, change };
  });
  const rank = { changed: 0, added: 1, removed: 2, same: 3 } as const;
  return rows.sort((x, y) => rank[x.change] - rank[y.change] || x.key.localeCompare(y.key));
}

/* ─── Filters ──────────────────────────────────────────────────────────── */

export type AuditFilters = {
  actor: string | null;
  domain: string | null;
  entity: string | null;
  from: ISODate | null;
  to: ISODate | null;
  q: string | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Filters from the URL, ignoring anything malformed. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): AuditFilters {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim().slice(0, 80) : null;
  };
  const date = (k: string) => {
    const s = one(k);
    return s && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? (s as ISODate) : null;
  };
  let from = date("from");
  let to = date("to");
  if (from && to && from > to) [from, to] = [to, from];
  return {
    actor: one("actor"),
    domain: one("domain"),
    entity: one("entity"),
    from,
    to,
    q: one("q"),
  };
}

/** The instants a filter's day range covers, in the company's time zone. */
export function dayRange(from: ISODate | null, to: ISODate | null) {
  return {
    gte: from ? instantAt(from, "00:00") : undefined,
    lt: to ? new Date(instantAt(to, "00:00").getTime() + 864e5) : undefined,
  };
}

export function filtersToQuery(f: AuditFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}
