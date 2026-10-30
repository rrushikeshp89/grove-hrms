/**
 * Directory filters live in the URL so a filtered view can be shared,
 * bookmarked and restored with the back button. Parsing is forgiving:
 * unknown or malformed values fall back to defaults instead of erroring.
 */

export const STATUSES = ["ONBOARDING", "ACTIVE", "ON_LEAVE", "NOTICE", "EXITED"] as const;
export type EmployeeStatus = (typeof STATUSES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SORTS = ["name", "joined-desc", "joined-asc", "department"] as const;
export type DirectorySort = (typeof SORTS)[number];

export type DirectoryFilters = {
  q: string;
  department: string | null; // department code
  location: string | null; // location id
  status: EmployeeStatus | null; // null = everyone currently employed
  type: EmploymentType | null;
  sort: DirectorySort;
  view: "grid" | "table";
};

export const DEFAULT_FILTERS: DirectoryFilters = {
  q: "",
  department: null,
  location: null,
  status: null,
  type: null,
  sort: "name",
  view: "grid",
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseFilters(params: Params): DirectoryFilters {
  const q = (get(params, "q") ?? "").trim().slice(0, 80);
  const code = get(params, "department");
  const location = get(params, "location");
  return {
    q,
    department: code && /^[A-Z]{2,6}$/.test(code) ? code : null,
    location: location && /^[a-z0-9]{8,40}$/i.test(location) ? location : null,
    status: oneOf(get(params, "status"), STATUSES),
    type: oneOf(get(params, "type"), EMPLOYMENT_TYPES),
    sort: oneOf(get(params, "sort"), SORTS) ?? DEFAULT_FILTERS.sort,
    view: get(params, "view") === "table" ? "table" : "grid",
  };
}

/** Only non-default values are written, so URLs stay short. */
export function serializeFilters(filters: Partial<DirectoryFilters>): string {
  const merged = { ...DEFAULT_FILTERS, ...filters };
  const out = new URLSearchParams();
  if (merged.q.trim()) out.set("q", merged.q.trim());
  if (merged.department) out.set("department", merged.department);
  if (merged.location) out.set("location", merged.location);
  if (merged.status) out.set("status", merged.status);
  if (merged.type) out.set("type", merged.type);
  if (merged.sort !== DEFAULT_FILTERS.sort) out.set("sort", merged.sort);
  if (merged.view !== DEFAULT_FILTERS.view) out.set("view", merged.view);
  return out.toString();
}

export function activeFilterCount(f: DirectoryFilters): number {
  return [f.department, f.location, f.status, f.type].filter(Boolean).length;
}
