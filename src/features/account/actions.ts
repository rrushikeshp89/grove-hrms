"use server";

import { z } from "zod";

import { createAction } from "@/server/action";

export const updatePreferences = createAction({
  schema: z
    .object({
      theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
      density: z.enum(["COMFORTABLE", "COMPACT"]).optional(),
    })
    .refine((v) => v.theme || v.density, "Nothing to update"),
  handler: async ({ input, user, tx, audit }) => {
    const before = { themePref: user.themePref, densityPref: user.densityPref };
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { themePref: input.theme, densityPref: input.density },
      select: { themePref: true, densityPref: true },
    });
    audit({
      action: "user.update_preferences",
      entityType: "User",
      entityId: user.id,
      before,
      after: updated,
    });
    return updated;
  },
});
