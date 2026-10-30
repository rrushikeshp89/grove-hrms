import "server-only";

import { db, type Prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { CurrentUser } from "@/server/session";
import { actorOf } from "@/server/session";

import { canDeleteDocument, canSeeDocument, type Category, type Visibility } from "./logic/rules";

const select = {
  id: true,
  title: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  visibility: true,
  ownerEmployeeId: true,
  uploadedById: true,
  createdAt: true,
  owner: { select: { firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.DocumentSelect;

type Row = Prisma.DocumentGetPayload<{ select: typeof select }>;

function viewerOf(user: CurrentUser) {
  return { employeeId: user.employee?.id ?? null, manage: can(actorOf(user), "documents.manage") };
}

function shape(user: CurrentUser, r: Row) {
  const viewer = viewerOf(user);
  const doc = {
    ownerEmployeeId: r.ownerEmployeeId,
    visibility: r.visibility as Visibility,
    uploadedById: r.uploadedById,
  };
  return {
    id: r.id,
    title: r.title,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    category: r.category as Category,
    visibility: r.visibility as Visibility,
    createdAt: r.createdAt.toISOString(),
    owner: r.owner ? `${r.owner.preferredName ?? r.owner.firstName} ${r.owner.lastName}` : null,
    canDelete: canDeleteDocument(viewer, doc),
  };
}

export type DocumentRow = ReturnType<typeof shape>;

/** What's in someone's folder that this viewer may open. */
export async function folderFor(user: CurrentUser, employeeId: string) {
  const rows = await db.document.findMany({
    where: { ownerEmployeeId: employeeId },
    orderBy: { createdAt: "desc" },
    select,
  });
  return rows
    .filter((r) =>
      canSeeDocument(viewerOf(user), {
        ownerEmployeeId: r.ownerEmployeeId,
        visibility: r.visibility as Visibility,
        uploadedById: r.uploadedById,
      }),
    )
    .map((r) => shape(user, r));
}

/** The company library, newest first. HR-only items stay with the people team. */
export async function policies(user: CurrentUser) {
  const rows = await db.document.findMany({
    where: { ownerEmployeeId: null, category: "POLICY" },
    orderBy: { title: "asc" },
    select,
  });
  return rows
    .filter((r) =>
      canSeeDocument(viewerOf(user), {
        ownerEmployeeId: null,
        visibility: r.visibility as Visibility,
        uploadedById: r.uploadedById,
      }),
    )
    .map((r) => shape(user, r));
}

/** One document's record and storage key, if this person may open it. */
export async function openableDocument(user: CurrentUser, id: string) {
  const d = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      storageKey: true,
      ownerEmployeeId: true,
      visibility: true,
      uploadedById: true,
    },
  });
  if (!d) return null;
  const ok = canSeeDocument(viewerOf(user), {
    ownerEmployeeId: d.ownerEmployeeId,
    visibility: d.visibility as Visibility,
    uploadedById: d.uploadedById,
  });
  return ok ? d : null;
}

/** People the people team can add documents for. */
export async function people() {
  const rows = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      designation: { select: { title: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: `${r.preferredName ?? r.firstName} ${r.lastName}`,
    title: r.designation.title,
  }));
}
