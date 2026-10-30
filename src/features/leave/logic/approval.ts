/**
 * Multi-level approvals for any request type (leave, regularization).
 *
 *   level 1: the requester's manager (HR if they have none)
 *   level 2: HR, when the type needs it or a leave is long
 *
 * Steps are created up front: the first PENDING, later ones WAITING until
 * the previous level approves.
 */

export type StepStatus = "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type Step = { level: number; approverId: string; status: StepStatus };

/** Leave longer than this always goes to HR too. */
export const LONG_LEAVE_DAYS = 5;

export function approvalChain(opts: {
  requesterId: string;
  managerId: string | null;
  hrApproverId: string;
  levels: number;
  days?: number;
}): Step[] {
  const needsHr = opts.levels >= 2 || (opts.days ?? 0) > LONG_LEAVE_DAYS;
  const first =
    opts.managerId && opts.managerId !== opts.requesterId ? opts.managerId : opts.hrApproverId;
  const approvers = [first];
  if (needsHr && opts.hrApproverId !== first && opts.hrApproverId !== opts.requesterId) {
    approvers.push(opts.hrApproverId);
  }
  // HR's own requests with no manager: nobody but themselves would approve.
  // Fall back to a single step on HR so the request is still visible.
  return approvers.map((approverId, i) => ({
    level: i + 1,
    approverId,
    status: i === 0 ? "PENDING" : "WAITING",
  }));
}

export type Decision = "APPROVE" | "REJECT";

/**
 * Applies a decision to the current pending step. Returns the new steps and
 * request status; `final` is true when the request is now fully decided.
 */
export function decide(steps: readonly Step[], decision: Decision) {
  const current = steps.find((s) => s.status === "PENDING");
  if (!current) throw new Error("Nothing is waiting for a decision.");
  const next = steps.map((s) => ({ ...s }));
  const at = next.find((s) => s.level === current.level)!;

  if (decision === "REJECT") {
    at.status = "REJECTED";
    for (const s of next) if (s.status === "WAITING") s.status = "SKIPPED";
    return {
      steps: next,
      status: "REJECTED" as RequestStatus,
      final: true,
      decidedLevel: current.level,
    };
  }
  at.status = "APPROVED";
  const following = next.find((s) => s.status === "WAITING");
  if (following) {
    following.status = "PENDING";
    return {
      steps: next,
      status: "PENDING" as RequestStatus,
      final: false,
      decidedLevel: current.level,
    };
  }
  return {
    steps: next,
    status: "APPROVED" as RequestStatus,
    final: true,
    decidedLevel: current.level,
  };
}
