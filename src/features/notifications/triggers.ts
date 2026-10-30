import "server-only";

import { format } from "date-fns";

import type { Prisma } from "@/generated/prisma/client";
import { dbDate, isoFromDbDate } from "@/lib/tz";

import { notify } from "./notify";

type Tx = Prisma.TransactionClient;

const nameOf = (p: { firstName: string; lastName: string; preferredName: string | null }) =>
  `${p.preferredName ?? p.firstName} ${p.lastName}`;

const people = { firstName: true, lastName: true, preferredName: true } as const;

function span(start: Date, end: Date, days: number) {
  const s = dbDate(isoFromDbDate(start));
  const e = dbDate(isoFromDbDate(end));
  const range =
    start.getTime() === end.getTime()
      ? format(s, "EEE d MMM")
      : `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
  return `${range} · ${days} ${days === 1 ? "day" : "days"}`;
}

/** Tells whoever's turn it is to decide a request that it's waiting for them. */
export async function notifyPendingApprover(tx: Tx, requestId: string, actorUserId?: string) {
  const r = await tx.request.findUnique({
    where: { id: requestId },
    select: {
      type: true,
      requester: { select: people },
      steps: {
        where: { status: "PENDING" },
        select: { approverId: true },
        orderBy: { level: "asc" },
        take: 1,
      },
      leave: {
        select: {
          startDate: true,
          endDate: true,
          days: true,
          leaveType: { select: { name: true } },
        },
      },
      regularization: { select: { date: true } },
    },
  });
  const approver = r?.steps[0]?.approverId;
  if (!r || !approver) return;
  const who = nameOf(r.requester);
  await notify(tx, [
    {
      employeeId: approver,
      kind: "APPROVAL_REQUESTED",
      title: r.leave
        ? `${who} asked for ${r.leave.leaveType.name.toLowerCase()}`
        : `${who} asked for an attendance correction`,
      body: r.leave
        ? span(r.leave.startDate, r.leave.endDate, Number(r.leave.days))
        : r.regularization
          ? format(dbDate(isoFromDbDate(r.regularization.date)), "EEEE d MMMM")
          : null,
      href: "/approvals",
      actorUserId,
    },
  ]);
}

/** Tells the person who asked how their request came out. */
export async function notifyRequester(
  tx: Tx,
  opts: { requestId: string; deciderId: string; actorUserId?: string },
) {
  const r = await tx.request.findUnique({
    where: { id: opts.requestId },
    select: {
      status: true,
      requesterId: true,
      leave: {
        select: {
          startDate: true,
          endDate: true,
          days: true,
          leaveType: { select: { name: true } },
        },
      },
      regularization: { select: { date: true } },
      steps: {
        where: { status: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { level: "desc" },
        take: 1,
        select: { comment: true },
      },
    },
  });
  if (!r || r.status === "PENDING") return;
  const decider = await tx.employee.findUnique({ where: { id: opts.deciderId }, select: people });
  const by = decider ? nameOf(decider) : "someone";
  const approved = r.status === "APPROVED";
  const what = r.leave ? r.leave.leaveType.name.toLowerCase() : "attendance correction";
  const detail = r.leave
    ? span(r.leave.startDate, r.leave.endDate, Number(r.leave.days))
    : r.regularization
      ? format(dbDate(isoFromDbDate(r.regularization.date)), "EEEE d MMMM")
      : "";
  const note = r.steps[0]?.comment;
  await notify(tx, [
    {
      employeeId: r.requesterId,
      kind: "APPROVAL_DECIDED",
      title: approved ? `Your ${what} was approved` : `Your ${what} wasn't approved`,
      body: [`${detail}`, approved ? `by ${by}` : `${by} said: ${note ?? "no note"}`]
        .filter(Boolean)
        .join(" · "),
      href: r.leave ? "/leave" : "/attendance",
      actorUserId: opts.actorUserId,
    },
  ]);
}
