import { evaluateDay, type Schedule } from "../../src/features/attendance/logic/evaluate";
import { approvalChain, decide } from "../../src/features/leave/logic/approval";
import {
  accrued,
  carryForward,
  summarize,
  type LedgerEntry,
  type Policy,
} from "../../src/features/leave/logic/balance";
import {
  isWorkingDay,
  leaveDayParts,
  leaveDays,
  rangesOverlap,
  type WorkCalendar,
} from "../../src/features/leave/logic/days";
import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  addDays,
  dbDate,
  eachDay,
  instantAt,
  isoFromDbDate,
  isoWeekday,
  type ISODate,
} from "../../src/lib/tz";
import type { Rng } from "./rng";

/**
 * Twelve months of attendance plus 2025–26 leave and corrections, generated
 * through the same business logic the app uses (leave-day counting,
 * balances, approval chains, attendance evaluation), so seeded history and
 * live behavior can't disagree.
 */

type Person = {
  id: string;
  joinDate: ISODate;
  managerId: string | null;
  locationId: string;
  employmentType: string;
  isDemo: boolean;
  status: string;
  key: string;
};

type LeaveTypeRow = {
  id: string;
  code: string;
  approvalLevels: number;
  allowHalfDay: boolean;
  minNoticeDays: number;
  policy: Policy;
};

const REASONS: Record<string, string[]> = {
  EL: [
    "Family trip to Coorg",
    "Visiting my parents in Kochi",
    "Sister's wedding",
    "Trek in Himachal",
    "Moving house",
    "Holiday in Goa",
    "Visiting grandparents in Mysuru",
  ],
  CL: [
    "Bank and passport appointment",
    "Personal errand",
    "Car service and RTO work",
    "Parent-teacher meeting",
    "Home repairs",
  ],
  SL: ["Fever", "Migraine", "Dental procedure", "Stomach bug", "Doctor's appointment"],
  BL: ["Bereavement in the family"],
  PL: ["Parental leave"],
};

const CORRECTION_REASONS = [
  "Forgot to clock out",
  "Phone died before clocking in",
  "Client visit, started early on site",
  "Clocked in on the wrong day",
];

let seq = 0;
const id = (prefix: string) => `${prefix}_${(++seq).toString(36).padStart(6, "0")}`;

function gauss(rng: Rng) {
  // Box–Muller, clamped so outliers stay believable.
  const u = Math.max(rng.next(), 1e-9);
  const v = rng.next();
  return Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;

export async function seedTime(
  db: PrismaClient,
  rng: Rng,
  opts: {
    today: ISODate;
    nowMinutes: number;
    people: Person[];
    leaveTypes: LeaveTypeRow[];
    holidays: { day: ISODate; locationId: string | null; optional: boolean }[];
    schedule: Schedule & { workDays: number[] };
    hrApproverId: string;
  },
) {
  const { today, people, schedule } = opts;
  const calFor = new Map<string, WorkCalendar>();
  const calendar = (locationId: string): WorkCalendar => {
    let c = calFor.get(locationId);
    if (!c) {
      c = {
        workDays: schedule.workDays,
        holidays: new Set(
          opts.holidays
            .filter((h) => !h.optional && (!h.locationId || h.locationId === locationId))
            .map((h) => h.day),
        ),
      };
      calFor.set(locationId, c);
    }
    return c;
  };
  const type = (code: string) => opts.leaveTypes.find((t) => t.code === code)!;

  const requests: {
    id: string;
    type: "LEAVE" | "REGULARIZATION";
    requesterId: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    currentLevel: number;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  const steps: {
    id: string;
    requestId: string;
    level: number;
    approverId: string;
    status: "WAITING" | "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
    comment: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  }[] = [];
  const leaves: {
    requestId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    startHalf: "FIRST" | "SECOND" | null;
    endHalf: "FIRST" | "SECOND" | null;
    days: number;
    reason: string;
  }[] = [];
  const ledger: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    kind: "CARRY_FORWARD" | "USAGE" | "PENDING_HOLD" | "RELEASE";
    days: number;
    requestId: string | null;
    note: string | null;
    createdAt: Date;
  }[] = [];
  const regs: {
    requestId: string;
    date: Date;
    requestedClockIn: Date | null;
    requestedClockOut: Date | null;
    reason: string;
  }[] = [];

  // Per person: their requests (for overlap checks) and ledger (for balances).
  const booked = new Map<
    string,
    {
      start: ISODate;
      end: ISODate;
      status: string;
      parts: { day: ISODate; portion: number; half: string | null }[];
    }[]
  >();
  const personLedger = new Map<string, (LedgerEntry & { typeId: string; year: number })[]>();

  function addRequest(
    p: Person,
    t: LeaveTypeRow,
    range: {
      start: ISODate;
      end: ISODate;
      startHalf?: "FIRST" | "SECOND" | null;
      endHalf?: "FIRST" | "SECOND" | null;
    },
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
    reason: string,
    forcePendingLevel2 = false,
  ) {
    const cal = calendar(p.locationId);
    const days = leaveDays(range, cal);
    if (days === 0) return false;
    const mine = booked.get(p.id) ?? [];
    if (
      mine.some(
        (b) => b.status !== "REJECTED" && b.status !== "CANCELLED" && rangesOverlap(b, range),
      )
    )
      return false;
    const year = Number(range.start.slice(0, 4));
    // Respect balances for paid leave.
    if (t.policy.annualQuota > 0) {
      const entries = (personLedger.get(p.id) ?? []).filter(
        (e) => e.typeId === t.id && e.year === year,
      );
      const available = summarize(
        accrued(t.policy, p.joinDate, year, range.start < today ? range.start : today),
        entries,
      ).available;
      if (days > available) return false;
    }

    const lead =
      t.code === "SL"
        ? -rng.int(0, 1)
        : t.code === "CL"
          ? rng.int(1, 6)
          : t.minNoticeDays + rng.int(3, 25);
    const createdIso = addDays(range.start, -lead);
    const created = instantAt(
      createdIso <= today ? createdIso : today,
      hhmm(rng.int(10 * 60, 18 * 60)),
    );
    const requestId = id("req");
    const chain = approvalChain({
      requesterId: p.id,
      managerId: p.managerId,
      hrApproverId: opts.hrApproverId,
      levels: t.approvalLevels,
      days,
    });
    let finalSteps = chain;
    let decidedAt: Date | null = null;
    if (status === "APPROVED" || status === "REJECTED") {
      let s = chain;
      while (s.some((x) => x.status === "PENDING")) {
        const isLast = s.filter((x) => x.status === "WAITING").length === 0;
        s = decide(s, status === "REJECTED" && isLast ? "REJECT" : "APPROVE").steps;
      }
      finalSteps = s;
      decidedAt = new Date(created.getTime() + rng.int(2, 52) * 3600_000);
      if (decidedAt.getTime() > Date.now()) decidedAt = new Date(Date.now() - 3600_000);
    } else if (status === "CANCELLED") {
      finalSteps = chain.map((x) => ({ ...x, status: "SKIPPED" }));
    } else if (forcePendingLevel2 && chain.length > 1) {
      finalSteps = decide(chain, "APPROVE").steps;
    }

    requests.push({
      id: requestId,
      type: "LEAVE",
      requesterId: p.id,
      status,
      currentLevel: finalSteps.findIndex((s) => s.status === "PENDING") + 1 || finalSteps.length,
      createdAt: created,
      updatedAt: decidedAt ?? created,
    });
    for (const s of finalSteps) {
      const decided = s.status === "APPROVED" || s.status === "REJECTED";
      steps.push({
        id: id("stp"),
        requestId,
        level: s.level,
        approverId: s.approverId,
        status: s.status,
        comment:
          s.status === "REJECTED"
            ? "We're short-staffed that week. Could you move it by a week?"
            : null,
        decidedAt: decided ? (decidedAt ?? new Date(created.getTime() + 86_400_000)) : null,
        createdAt: created,
      });
    }
    leaves.push({
      requestId,
      leaveTypeId: t.id,
      startDate: dbDate(range.start),
      endDate: dbDate(range.end),
      startHalf: range.startHalf ?? null,
      endHalf: range.endHalf ?? null,
      days,
      reason,
    });
    const led = personLedger.get(p.id) ?? [];
    const push = (kind: "USAGE" | "PENDING_HOLD" | "RELEASE", d: number, at: Date) => {
      ledger.push({
        id: id("led"),
        employeeId: p.id,
        leaveTypeId: t.id,
        year,
        kind,
        days: d,
        requestId,
        note: null,
        createdAt: at,
      });
      led.push({ kind, days: d, typeId: t.id, year });
    };
    push("PENDING_HOLD", -days, created);
    if (status !== "PENDING") push("RELEASE", days, decidedAt ?? created);
    if (status === "APPROVED") push("USAGE", -days, decidedAt!);
    personLedger.set(p.id, led);
    mine.push({ ...range, status, parts: leaveDayParts(range, cal) });
    booked.set(p.id, mine);
    return true;
  }

  /** A random working day in [from, to]. */
  function workingDayIn(p: Person, from: ISODate, to: ISODate): ISODate | null {
    const cal = calendar(p.locationId);
    for (let i = 0; i < 25; i++) {
      const span = Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
      if (span < 0) return null;
      const d = addDays(from, rng.int(0, span));
      if (isWorkingDay(d, cal)) return d;
    }
    return null;
  }

  function statusFor(
    start: ISODate,
    end: ISODate,
  ): "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" {
    if (end < today)
      return rng.chance(0.06) ? "REJECTED" : rng.chance(0.04) ? "CANCELLED" : "APPROVED";
    if (start <= today) return "APPROVED";
    return rng.chance(0.65) ? "APPROVED" : "PENDING";
  }

  const current = people.filter((p) => p.status !== "EXITED");
  const horizon = addDays(today, 75);

  for (const p of current) {
    const cal = calendar(p.locationId);
    for (const year of [2025, 2026]) {
      const from = p.joinDate > `${year}-01-01` ? p.joinDate : `${year}-01-01`;
      const to = year === 2026 ? horizon : `${year}-12-31`;
      if (from > to) continue;

      // Carry-forward into 2026 from what was left of 2025.
      if (year === 2026) {
        for (const t of opts.leaveTypes) {
          if (t.policy.carryForwardMax <= 0) continue;
          const entries = (personLedger.get(p.id) ?? []).filter(
            (e) => e.typeId === t.id && e.year === 2025,
          );
          const left = summarize(
            accrued(t.policy, p.joinDate, 2025, "2025-12-31"),
            entries,
          ).available;
          const cf = carryForward(t.policy, left);
          if (cf > 0) {
            ledger.push({
              id: id("led"),
              employeeId: p.id,
              leaveTypeId: t.id,
              year: 2026,
              kind: "CARRY_FORWARD",
              days: cf,
              requestId: null,
              note: "Carried forward from 2025",
              createdAt: new Date("2026-01-01T00:30:00Z"),
            });
            const led = personLedger.get(p.id) ?? [];
            led.push({ kind: "CARRY_FORWARD", days: cf, typeId: t.id, year: 2026 });
            personLedger.set(p.id, led);
          }
        }
      }

      // Earned leave: a couple of planned breaks.
      for (let i = 0; i < rng.int(1, 3); i++) {
        const start = workingDayIn(p, from, to);
        if (!start) continue;
        const end = addDays(start, rng.int(1, 6));
        if (end.slice(0, 4) !== start.slice(0, 4)) continue;
        addRequest(p, type("EL"), { start, end }, statusFor(start, end), rng.pick(REASONS.EL!));
      }
      // Casual leave: single days, sometimes half.
      for (let i = 0; i < rng.int(2, 5); i++) {
        const day = workingDayIn(p, from, to);
        if (!day) continue;
        const half = rng.chance(0.25) ? (rng.chance(0.5) ? "FIRST" : "SECOND") : null;
        addRequest(
          p,
          type("CL"),
          { start: day, end: day, startHalf: half },
          statusFor(day, day),
          rng.pick(REASONS.CL!),
        );
      }
      // Sick leave: only in the past.
      for (let i = 0; i < rng.int(0, 3); i++) {
        const day = workingDayIn(p, from, today < to ? addDays(today, -1) : to);
        if (!day) continue;
        const end = rng.chance(0.3) ? addDays(day, 1) : day;
        addRequest(
          p,
          type("SL"),
          { start: day, end },
          end < today ? "APPROVED" : statusFor(day, end),
          rng.pick(REASONS.SL!),
        );
      }
    }
    void cal;
  }

  // Story beats the demo relies on.
  const byKey = new Map(people.map((p) => [p.key, p]));
  const ananya = byKey.get("ananya");
  if (ananya) {
    // Ananya is on parental leave right now.
    addRequest(
      ananya,
      type("PL"),
      { start: addDays(today, -40), end: addDays(today, 60) },
      "APPROVED",
      REASONS.PL![0]!,
    );
  }
  // Priya's inbox: a few of her team waiting on her, one long leave that
  // will need HR after her, and one already waiting on HR.
  const priyaTeam = current.filter((p) => p.managerId === byKey.get("em_web")?.id && !p.isDemo);
  const nextMonday = (() => {
    let d = addDays(today, 14);
    while (isoWeekday(d) !== 1) d = addDays(d, 1);
    return d;
  })();
  priyaTeam.slice(0, 3).forEach((p, i) => {
    const start = addDays(nextMonday, i * 7 + 1);
    addRequest(
      p,
      type(i === 2 ? "CL" : "EL"),
      { start, end: i === 2 ? start : addDays(start, i === 0 ? 1 : 6) },
      "PENDING",
      rng.pick(REASONS.EL!),
    );
  });
  const hrQueue = current
    .filter((p) => p.managerId && !p.isDemo && p.managerId !== byKey.get("em_web")?.id)
    .slice(5, 7);
  for (const p of hrQueue) {
    const start = addDays(nextMonday, 21);
    addRequest(
      p,
      type("EL"),
      { start, end: addDays(start, 7) },
      "PENDING",
      rng.pick(REASONS.EL!),
      true,
    );
  }

  // ── Attendance ───────────────────────────────────────────────────────
  const since = addDays(today, -365);
  const records: {
    id: string;
    employeeId: string;
    date: Date;
    clockInAt: Date | null;
    clockOutAt: Date | null;
    status: "PRESENT" | "LATE" | "HALF_DAY";
    workedMinutes: number;
    lateByMinutes: number;
    earlyByMinutes: number;
    source: "WEB" | "MOBILE" | "REGULARIZED";
  }[] = [];
  const startMin =
    Number(schedule.startTime.slice(0, 2)) * 60 + Number(schedule.startTime.slice(3));
  const optionalTaken = new Set(opts.holidays.filter((h) => h.optional).map((h) => h.day));

  for (const p of current) {
    const cal = calendar(p.locationId);
    // Each person has a habit: some arrive early, some drift in late.
    const habit = startMin - 25 + rng.int(0, 45);
    const spread = 8 + rng.int(0, 14);
    const mobileUser = rng.chance(0.35);
    const leaveByDay = new Map<ISODate, number>();
    for (const b of booked.get(p.id) ?? []) {
      if (b.status !== "APPROVED") continue;
      for (const part of b.parts)
        leaveByDay.set(part.day, (leaveByDay.get(part.day) ?? 0) + part.portion);
    }
    const first = p.joinDate > since ? p.joinDate : since;
    for (const day of eachDay(first, today)) {
      if (!isWorkingDay(day, cal)) continue;
      if (optionalTaken.has(day) && rng.chance(0.4)) continue;
      const leave = leaveByDay.get(day) ?? 0;
      if (leave >= 1) continue;
      if (rng.chance(0.004)) continue; // a rare unexplained absence
      // Mondays start a little slower, Fridays a touch.
      const weekdayDrift = isoWeekday(day) === 1 ? 7 : isoWeekday(day) === 5 ? 3 : 0;
      let inMin = habit + weekdayDrift + gauss(rng) * spread;
      // A nine-hour shift, give or take; most people stay a little longer.
      let outMin = inMin + 9 * 60 + 12 + gauss(rng) * 18;
      if (rng.chance(0.04)) outMin = inMin + 6 * 60 + rng.int(0, 60); // left early
      if (leave === 0.5) {
        if (rng.chance(0.5)) inMin = 13 * 60 + 30 + rng.int(-10, 20);
        else outMin = inMin + 4 * 60 + rng.int(0, 30);
      }
      if (day === today) {
        // Today: only people who'd already be in, and never the demo
        // accounts, so visitors can clock in themselves.
        if (p.isDemo || inMin > opts.nowMinutes) continue;
      }
      const clockInAt = instantAt(day, hhmm(inMin));
      const clockOutAt = day === today ? null : instantAt(day, hhmm(outMin));
      const e = evaluateDay({ clockInAt, clockOutAt }, schedule);
      records.push({
        id: id("att"),
        employeeId: p.id,
        date: dbDate(day),
        clockInAt,
        clockOutAt,
        status: e.status === "ABSENT" ? "PRESENT" : (e.status as "PRESENT" | "LATE" | "HALF_DAY"),
        workedMinutes: e.workedMinutes,
        lateByMinutes: e.lateByMinutes,
        earlyByMinutes: e.earlyByMinutes,
        source: mobileUser && rng.chance(0.6) ? "MOBILE" : "WEB",
      });
    }
  }

  // Corrections: some past ones, and a forgotten clock-out waiting on Priya.
  const recordByKey = new Map(records.map((r) => [`${r.employeeId}|${isoFromDbDate(r.date)}`, r]));
  function addCorrection(p: Person, day: ISODate, status: "PENDING" | "APPROVED" | "REJECTED") {
    const r = recordByKey.get(`${p.id}|${day}`);
    if (!r?.clockInAt) return;
    const requestId = id("req");
    const created = instantAt(addDays(day, 1), "10:15");
    const fixedOut = instantAt(day, hhmm(18 * 60 + 30 + rng.int(-20, 40)));
    const chain = approvalChain({
      requesterId: p.id,
      managerId: p.managerId,
      hrApproverId: opts.hrApproverId,
      levels: 1,
    });
    requests.push({
      id: requestId,
      type: "REGULARIZATION",
      requesterId: p.id,
      status,
      currentLevel: 1,
      createdAt: created,
      updatedAt: created,
    });
    steps.push({
      id: id("stp"),
      requestId,
      level: 1,
      approverId: chain[0]!.approverId,
      status: status === "PENDING" ? "PENDING" : status,
      comment:
        status === "REJECTED" ? "The office access log shows a different time. Let's talk." : null,
      decidedAt: status === "PENDING" ? null : new Date(created.getTime() + 5 * 3600_000),
      createdAt: created,
    });
    regs.push({
      requestId,
      date: dbDate(day),
      requestedClockIn: null,
      requestedClockOut: fixedOut,
      reason: rng.pick(CORRECTION_REASONS),
    });
    if (status === "PENDING") {
      // The record still shows the missing clock-out until someone approves.
      r.clockOutAt = null;
      r.workedMinutes = 0;
      r.earlyByMinutes = 0;
    } else if (status === "APPROVED") {
      const e = evaluateDay({ clockInAt: r.clockInAt, clockOutAt: fixedOut }, schedule);
      Object.assign(r, {
        clockOutAt: fixedOut,
        workedMinutes: e.workedMinutes,
        earlyByMinutes: e.earlyByMinutes,
        source: "REGULARIZED" as const,
      });
    }
  }
  for (const p of current.filter((x) => !x.isDemo)) {
    if (!rng.chance(0.25)) continue;
    const day = workingDayIn(p, addDays(today, -200), addDays(today, -12));
    if (day) addCorrection(p, day, rng.chance(0.85) ? "APPROVED" : "REJECTED");
  }
  const forgetful = priyaTeam[3] ?? priyaTeam[0];
  if (forgetful) {
    const day = workingDayIn(forgetful, addDays(today, -6), addDays(today, -2));
    if (day) addCorrection(forgetful, day, "PENDING");
  }

  // ── Write everything ─────────────────────────────────────────────────
  const chunk = async <T>(rows: T[], size: number, write: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
  };
  await chunk(requests, 1000, (data) => db.request.createMany({ data }));
  await chunk(steps, 1000, (data) => db.approvalStep.createMany({ data }));
  await chunk(leaves, 1000, (data) => db.leaveRequest.createMany({ data }));
  await chunk(regs, 1000, (data) => db.regularizationRequest.createMany({ data }));
  await chunk(ledger, 2000, (data) => db.leaveLedgerEntry.createMany({ data }));
  await chunk(records, 2000, (data) => db.attendanceRecord.createMany({ data }));

  return {
    leaveRequests: leaves.length,
    corrections: regs.length,
    attendance: records.length,
    pending: requests.filter((r) => r.status === "PENDING").length,
  };
}
