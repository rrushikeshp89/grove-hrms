import { addDays, eachDay, isoWeekday, type ISODate } from "@/lib/tz";

/**
 * Simulated payroll maths. Money is integer paise and every line is rounded
 * to a whole rupee, the way real payslips read. Nothing here touches the
 * database, so the same rules run in tests, the run generator and the PDF.
 */

export type Component = {
  name: string;
  kind: "EARNING" | "DEDUCTION";
  calc: "FIXED" | "PERCENT_OF_BASIC" | "PERCENT_OF_GROSS";
  /** Monthly amount for FIXED components. */
  amountMinor: number | null;
  /** Basis points for percentage components (4000 = 40%). */
  percentBps: number | null;
  sortOrder: number;
};

export type Line = {
  name: string;
  kind: "EARNING" | "DEDUCTION";
  /** What the line pays or takes this month, after proration. */
  amountMinor: number;
  /** What it would be for a full month, so the payslip can show proration. */
  fullMinor: number;
};

const RUPEE = 100;
export const roundToRupee = (minor: number) => Math.round(minor / RUPEE) * RUPEE;

export const isBasic = (c: Pick<Component, "name" | "kind">) =>
  c.kind === "EARNING" && /^basic/i.test(c.name);

/** Problems with a set of components, in plain words. Empty means it's usable. */
export function structureProblems(components: readonly Component[]): string[] {
  const problems: string[] = [];
  const basics = components.filter(isBasic);
  if (basics.length !== 1) problems.push("A structure needs exactly one Basic earning.");
  else if (basics[0]!.calc !== "FIXED") problems.push("Basic must be a fixed amount.");
  for (const c of components) {
    if (c.calc === "FIXED" && (c.amountMinor == null || c.amountMinor < 0))
      problems.push(`${c.name} needs an amount.`);
    if (c.calc !== "FIXED" && (c.percentBps == null || c.percentBps < 0 || c.percentBps > 10_000))
      problems.push(`${c.name} needs a percentage between 0 and 100.`);
    if (c.kind === "EARNING" && c.calc === "PERCENT_OF_GROSS")
      problems.push(`${c.name} can't be a percentage of gross, because gross is made of earnings.`);
  }
  return problems;
}

export type PayslipInput = {
  components: readonly Component[];
  /** Working days in the month for this person's calendar. */
  workingDays: number;
  /** Days they weren't paid for: unpaid leave, absence, or not yet employed. */
  lopDays: number;
};

export type Payslip = {
  workingDays: number;
  paidDays: number;
  lopDays: number;
  lines: Line[];
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
};

/**
 * One month's pay. Earnings scale with paid days. Percentage deductions
 * follow the prorated basic or gross; fixed deductions (professional tax)
 * don't scale, but are waived when nothing was paid and trimmed so net pay
 * never goes below zero.
 */
export function computePayslip({ components, workingDays, lopDays }: PayslipInput): Payslip {
  const paidDays = Math.max(0, Math.min(workingDays, workingDays - lopDays));
  const fraction = workingDays > 0 ? paidDays / workingDays : 0;
  const ordered = [...components].sort((a, b) => a.sortOrder - b.sortOrder);
  const basicFull = ordered.find(isBasic)?.amountMinor ?? 0;

  const earnings: Line[] = ordered
    .filter((c) => c.kind === "EARNING")
    .map((c) => {
      const full =
        c.calc === "FIXED"
          ? (c.amountMinor ?? 0)
          : Math.round((basicFull * (c.percentBps ?? 0)) / 10_000);
      return {
        name: c.name,
        kind: "EARNING" as const,
        fullMinor: roundToRupee(full),
        amountMinor: roundToRupee(full * fraction),
      };
    });
  const grossMinor = earnings.reduce((s, l) => s + l.amountMinor, 0);
  const basicPaid = earnings.find((l) => /^basic/i.test(l.name))?.amountMinor ?? 0;

  let deductions: Line[] = ordered
    .filter((c) => c.kind === "DEDUCTION")
    .map((c) => {
      const bps = c.percentBps ?? 0;
      const fullBase = c.calc === "PERCENT_OF_BASIC" ? basicFull : grossFullOf(earnings);
      const full =
        c.calc === "FIXED" ? (c.amountMinor ?? 0) : Math.round((fullBase * bps) / 10_000);
      const paid =
        c.calc === "FIXED"
          ? grossMinor > 0
            ? full
            : 0
          : Math.round(((c.calc === "PERCENT_OF_BASIC" ? basicPaid : grossMinor) * bps) / 10_000);
      return {
        name: c.name,
        kind: "DEDUCTION" as const,
        fullMinor: roundToRupee(full),
        amountMinor: roundToRupee(paid),
      };
    });

  let deductionsMinor = deductions.reduce((s, l) => s + l.amountMinor, 0);
  if (deductionsMinor > grossMinor) {
    // Scale every deduction down (rounding down to the rupee) so they fit inside gross.
    const factor = grossMinor / deductionsMinor;
    deductions = deductions.map((l) => ({
      ...l,
      amountMinor: Math.floor((l.amountMinor * factor) / RUPEE) * RUPEE,
    }));
    deductionsMinor = deductions.reduce((s, l) => s + l.amountMinor, 0);
  }

  return {
    workingDays,
    paidDays,
    lopDays: workingDays - paidDays,
    lines: [...earnings, ...deductions],
    grossMinor,
    deductionsMinor,
    netMinor: grossMinor - deductionsMinor,
  };
}

const grossFullOf = (earnings: readonly Line[]) => earnings.reduce((s, l) => s + l.fullMinor, 0);

/* ─── Salary structures ────────────────────────────────────────────────── */

/**
 * The company's standard split of a yearly CTC into monthly components.
 * Earnings add up to exactly one twelfth of CTC (to the rupee).
 */
export function standardStructure(annualCtcMinor: number): Component[] {
  const monthly = roundToRupee(annualCtcMinor / 12);
  const basic = roundToRupee(monthly * 0.4);
  const hra = roundToRupee(basic * 0.5);
  const conveyance = monthly >= 3_000_000 ? 160_000 : 0;
  const special = monthly - basic - hra - conveyance;
  const annualRupees = annualCtcMinor / RUPEE;
  const tdsBps =
    annualRupees <= 700_000
      ? 0
      : annualRupees <= 1_000_000
        ? 500
        : annualRupees <= 1_500_000
          ? 1000
          : annualRupees <= 2_500_000
            ? 1500
            : annualRupees <= 5_000_000
              ? 2000
              : 2500;

  const parts: Omit<Component, "sortOrder">[] = [
    { name: "Basic salary", kind: "EARNING", calc: "FIXED", amountMinor: basic, percentBps: null },
    {
      name: "House rent allowance",
      kind: "EARNING",
      calc: "PERCENT_OF_BASIC",
      amountMinor: null,
      percentBps: 5000,
    },
    ...(conveyance
      ? [
          {
            name: "Conveyance",
            kind: "EARNING" as const,
            calc: "FIXED" as const,
            amountMinor: conveyance,
            percentBps: null,
          },
        ]
      : []),
    {
      name: "Special allowance",
      kind: "EARNING",
      calc: "FIXED",
      amountMinor: special,
      percentBps: null,
    },
    {
      name: "Provident fund",
      kind: "DEDUCTION",
      calc: "PERCENT_OF_BASIC",
      amountMinor: null,
      percentBps: 1200,
    },
    ...(monthly >= 2_500_000
      ? [
          {
            name: "Professional tax",
            kind: "DEDUCTION" as const,
            calc: "FIXED" as const,
            amountMinor: 20_000,
            percentBps: null,
          },
        ]
      : []),
    ...(tdsBps
      ? [
          {
            name: "Income tax (TDS)",
            kind: "DEDUCTION" as const,
            calc: "PERCENT_OF_GROSS" as const,
            amountMinor: null,
            percentBps: tdsBps,
          },
        ]
      : []),
  ];
  return parts.map((p, i) => ({ ...p, sortOrder: i }));
}

/* ─── Loss of pay ──────────────────────────────────────────────────────── */

export type DayRecordLite = {
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "WEEKEND";
};

/**
 * Working days in a month and how many of them weren't paid. A day is
 * unpaid when it falls outside the person's employment, they took unpaid
 * leave, or they were absent without leave. Days that haven't happened yet
 * are paid, so a run done on the 30th doesn't dock people for the 31st.
 */
export function lossOfPay(input: {
  start: ISODate;
  end: ISODate;
  today: ISODate;
  workDays: readonly number[];
  holidays: ReadonlySet<ISODate>;
  employedFrom: ISODate;
  employedTo: ISODate | null;
  records: ReadonlyMap<ISODate, DayRecordLite>;
  leave: ReadonlyMap<ISODate, { portion: number; paid: boolean }>;
}) {
  const days = eachDay(input.start, input.end).filter(
    (d) => input.workDays.includes(isoWeekday(d)) && !input.holidays.has(d),
  );
  let lop = 0;
  for (const d of days) {
    if (d < input.employedFrom || (input.employedTo && d > input.employedTo)) {
      lop += 1;
      continue;
    }
    const record = input.records.get(d);
    const leave = input.leave.get(d);
    const unpaidLeave = leave && !leave.paid ? leave.portion : 0;
    const covered = leave ? leave.portion : 0;
    let absent = 0;
    if (record) {
      absent =
        record.status === "ABSENT" ? 1 - covered : record.status === "HALF_DAY" ? 0.5 - covered : 0;
    } else if (d < input.today) {
      absent = 1 - covered;
    }
    lop += Math.min(1, unpaidLeave + Math.max(0, absent));
  }
  return { workingDays: days.length, lop: Math.round(lop * 2) / 2 };
}

/* ─── Run comparison ───────────────────────────────────────────────────── */

export type RunRow = { employeeId: string; grossMinor: number; netMinor: number };

/** How a run differs from the one before it, so a reviewer looks at changes, not 100 rows. */
export function diffRuns(previous: readonly RunRow[], current: readonly RunRow[], threshold = 0.1) {
  const before = new Map(previous.map((r) => [r.employeeId, r]));
  const after = new Map(current.map((r) => [r.employeeId, r]));
  const joined = current.filter((r) => !before.has(r.employeeId)).map((r) => r.employeeId);
  const left = previous.filter((r) => !after.has(r.employeeId)).map((r) => r.employeeId);
  const changed = current
    .flatMap((r) => {
      const prev = before.get(r.employeeId);
      if (!prev || prev.netMinor === r.netMinor) return [];
      const delta = r.netMinor - prev.netMinor;
      const pct = prev.netMinor ? delta / prev.netMinor : 1;
      return [
        {
          employeeId: r.employeeId,
          previousNetMinor: prev.netMinor,
          netMinor: r.netMinor,
          deltaMinor: delta,
          pct,
          flagged: Math.abs(pct) >= threshold,
        },
      ];
    })
    .sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor));
  const sum = (rows: readonly RunRow[], k: "grossMinor" | "netMinor") =>
    rows.reduce((s, r) => s + r[k], 0);
  return {
    joined,
    left,
    changed,
    totals: {
      grossMinor: sum(current, "grossMinor"),
      netMinor: sum(current, "netMinor"),
      previousGrossMinor: sum(previous, "grossMinor"),
      previousNetMinor: sum(previous, "netMinor"),
      headcount: current.length,
      previousHeadcount: previous.length,
    },
  };
}

/** Whether a month can be run: it has ended, or it's past the 25th. */
export function runnableMonth(year: number, month: number, today: ISODate): boolean {
  const first = `${year}-${String(month).padStart(2, "0")}-01` as ISODate;
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) as ISODate;
  const cutoff = addDays(first, 24);
  return today > last || today >= cutoff;
}
