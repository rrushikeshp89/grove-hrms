"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { can } from "@/lib/rbac";
import { storage } from "@/lib/storage";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { actorOf } from "@/server/session";

import { canDeleteDocument, mimeFor, safeFileName } from "./logic/rules";
import { deleteDocumentSchema, uploadSchema } from "./schemas";

const refresh = () => {
  revalidatePath("/documents");
};

/**
 * Stores a file and records it. People add documents to their own folder;
 * the people team can also add to anyone's folder and to the company policy
 * library. The file is written first and removed again if saving the record
 * fails, so a failed upload leaves nothing behind.
 */
export const uploadDocument = createAction({
  schema: uploadSchema,
  permission: "documents.read",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id ?? null;
    const manage = can(actorOf(user), "documents.manage");
    const policy = input.target === "policy";
    const ownerId = policy ? null : input.target === "self" ? me : input.target;

    if (policy && !manage) throw new ActionError("Only the people team adds company policies.");
    if (!policy && !ownerId)
      throw new ActionError("Documents need an employee record behind them.");
    if (ownerId && ownerId !== me && !manage) {
      throw new ActionError("You can only add documents to your own folder.");
    }
    if (ownerId && ownerId !== me) {
      const owner = await tx.employee.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!owner) throw new ActionError("We couldn't find that person.");
    }
    if (!manage && input.category === "POLICY") {
      throw new ActionError("Policies are added by the people team.", {
        category: ["Choose another category"],
      });
    }
    // Policies are for everyone; anything in a folder is private unless the people team says otherwise.
    const category = policy ? "POLICY" : input.category;
    const visibility = policy
      ? "COMPANY"
      : manage
        ? input.visibility === "COMPANY"
          ? "PRIVATE"
          : input.visibility
        : "PRIVATE";

    const id = randomUUID();
    const fileName = safeFileName(input.file.name);
    const storageKey = `docs/${id}/${fileName}`;
    const bytes = new Uint8Array(await input.file.arrayBuffer());
    await storage.put(storageKey, bytes);
    try {
      await tx.document.create({
        data: {
          id,
          ownerEmployeeId: ownerId,
          category,
          title: input.title,
          fileName,
          mimeType: mimeFor(fileName),
          sizeBytes: bytes.byteLength,
          storageKey,
          uploadedById: me,
          visibility,
        },
      });
    } catch (e) {
      await storage.delete(storageKey);
      throw e;
    }
    audit({
      action: "document.upload",
      entityType: "Document",
      entityId: id,
      after: {
        title: input.title,
        category,
        ownerEmployeeId: ownerId,
        visibility,
        sizeBytes: bytes.byteLength,
      },
    });
    refresh();
    return { id };
  },
});

export const deleteDocument = createAction({
  schema: deleteDocumentSchema,
  permission: "documents.read",
  handler: async ({ input, user, tx, audit }) => {
    const doc = await tx.document.findUnique({
      where: { id: input.documentId },
      select: {
        id: true,
        title: true,
        storageKey: true,
        ownerEmployeeId: true,
        visibility: true,
        uploadedById: true,
      },
    });
    if (!doc) return { deleted: false };
    const viewer = {
      employeeId: user.employee?.id ?? null,
      manage: can(actorOf(user), "documents.manage"),
    };
    if (!canDeleteDocument(viewer, doc)) throw new ActionError("You can't delete that document.");
    await tx.document.delete({ where: { id: doc.id } });
    await storage.delete(doc.storageKey);
    audit({
      action: "document.delete",
      entityType: "Document",
      entityId: doc.id,
      before: { title: doc.title },
    });
    refresh();
    return { deleted: true };
  },
});
