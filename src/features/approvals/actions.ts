"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyDecision } from "@/features/requests/engine";
import { can } from "@/lib/rbac";
import { createAction } from "@/server/action";
import { ActionError } from "@/server/action-error";
import { targetFor } from "@/server/authz";
import { actorOf } from "@/server/session";

export const decideRequests = createAction({
  schema: z
    .object({
      requestIds: z
        .array(z.string().min(1))
        .min(1, "Select at least one request")
        .max(50, "Up to 50 at a time"),
      decision: z.enum(["APPROVE", "REJECT"]),
      comment: z
        .string()
        .trim()
        .max(300, "Keep the note under 300 characters")
        .transform((v) => (v === "" ? null : v))
        .nullable(),
    })
    .refine((v) => v.decision === "APPROVE" || v.comment, {
      path: ["comment"],
      message: "Add a short note so they know why",
    }),
  permission: "leave.approve",
  handler: async ({ input, user, tx, audit }) => {
    const me = user.employee?.id;
    if (!me) throw new ActionError("Your account isn't linked to an employee record.");
    const results = { approved: 0, rejected: 0, advanced: 0, skipped: 0, decided: [] as string[] };

    for (const requestId of input.requestIds) {
      const step = await tx.approvalStep.findFirst({
        where: { requestId, status: "PENDING", request: { status: "PENDING" } },
        select: { approverId: true, request: { select: { requesterId: true } } },
      });
      // Already decided by someone else since the page loaded.
      if (!step) {
        results.skipped += 1;
        continue;
      }
      if (step.request.requesterId === me) {
        throw new ActionError("You can't decide your own request.");
      }
      // The assigned approver, or anyone whose access covers the requester
      // (a skip-level manager, HR), may act.
      const allowed =
        step.approverId === me ||
        can(actorOf(user), "leave.approve", await targetFor(step.request.requesterId, tx));
      if (!allowed) throw new ActionError("One of these requests isn't yours to decide.");

      const outcome = await applyDecision(tx, {
        requestId,
        decision: input.decision,
        deciderId: me,
        comment: input.comment,
      });
      if (outcome.status === "APPROVED") results.approved += 1;
      else if (outcome.status === "REJECTED") results.rejected += 1;
      else results.advanced += 1;
      results.decided.push(requestId);
      audit({
        action: input.decision === "APPROVE" ? "request.approve" : "request.reject",
        entityType: "Request",
        entityId: requestId,
        after: {
          status: outcome.status,
          type: outcome.type,
          ...(input.comment ? { comment: input.comment } : {}),
        },
      });
    }
    revalidatePath("/approvals");
    revalidatePath("/leave");
    revalidatePath("/attendance");
    return results;
  },
});
