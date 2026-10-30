export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Extension → the MIME types a browser may report for it. */
const TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  txt: ["text/plain"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export const ACCEPT = Object.keys(TYPES)
  .map((e) => `.${e}`)
  .join(",");

export const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** Why a file can't be uploaded, or null when it can. */
export function uploadProblem(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES)
    return `Files can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  const ext = extensionOf(file.name);
  const allowed = TYPES[ext];
  if (!allowed) return "Upload a PDF, image, Word, Excel or text file.";
  // Browsers sometimes report nothing for a type they don't know; trust the extension then.
  if (file.type && !allowed.includes(file.type)) return `That doesn't look like a .${ext} file.`;
  return null;
}

/** A file name safe to put in a storage key and a header. */
export function safeFileName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? "";
  const ext = extensionOf(leaf);
  const base = leaf
    .replace(/\.[^.]+$/, "")
    .replace(/^\.+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}.${ext}`;
}

export function mimeFor(fileName: string): string {
  return TYPES[extensionOf(fileName)]?.[0] ?? "application/octet-stream";
}

/** Files a browser can show itself, so they open in a tab rather than download. */
export const isInline = (mime: string) => mime === "application/pdf" || mime.startsWith("image/");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const CATEGORY_META = {
  ID_PROOF: { label: "ID proof" },
  CONTRACT: { label: "Contract" },
  PAYSLIP: { label: "Payslip" },
  CERTIFICATE: { label: "Certificate" },
  POLICY: { label: "Policy" },
  OTHER: { label: "Other" },
} as const;
export type Category = keyof typeof CATEGORY_META;
export type Visibility = "PRIVATE" | "HR_ONLY" | "COMPANY";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "You and the people team",
  HR_ONLY: "People team only",
  COMPANY: "Everyone",
};

type Viewer = { employeeId: string | null; manage: boolean };
type Doc = { ownerEmployeeId: string | null; visibility: Visibility; uploadedById: string | null };

/**
 * Who may open a document. Company documents are for everyone; private ones
 * belong to their owner and the people team (managers don't get a back door
 * into someone's ID proofs); people-team-only ones stay with the people team.
 */
export function canSeeDocument(viewer: Viewer, doc: Doc): boolean {
  if (viewer.manage) return true;
  if (doc.visibility === "COMPANY") return true;
  if (doc.visibility === "PRIVATE")
    return !!viewer.employeeId && doc.ownerEmployeeId === viewer.employeeId;
  return false;
}

/** The people team removes anything; people remove only what they uploaded to their own folder. */
export function canDeleteDocument(viewer: Viewer, doc: Doc): boolean {
  if (viewer.manage) return true;
  return (
    !!viewer.employeeId &&
    doc.ownerEmployeeId === viewer.employeeId &&
    doc.uploadedById === viewer.employeeId &&
    doc.visibility === "PRIVATE"
  );
}
