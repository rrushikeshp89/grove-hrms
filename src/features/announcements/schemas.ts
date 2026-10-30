import { z } from "zod";

import { REACTIONS } from "./logic/content";

export const announcementSchema = z.object({
  id: z.string().nullable(),
  title: z
    .string()
    .trim()
    .min(3, "Give it a headline")
    .max(120, "Keep the headline under 120 characters"),
  /** A Tiptap document. Never trusted: the server rebuilds it from an allow-list. */
  body: z.unknown(),
  departmentIds: z.array(z.string()),
  locationIds: z.array(z.string()),
  pinned: z.boolean(),
  publish: z.boolean(),
});
export type AnnouncementInput = z.input<typeof announcementSchema>;

export const reactionSchema = z.object({
  announcementId: z.string().min(1),
  kind: z.enum(REACTIONS),
});

export const announcementIdSchema = z.object({ announcementId: z.string().min(1) });
