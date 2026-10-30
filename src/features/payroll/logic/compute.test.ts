import { describe, expect, it } from "vitest";

import {
  computePayslip,
  diffRuns,
  lossOfPay,
  roundToRupee,
  runnableMonth,
  standardStructure,
  structureProblems,
  type Component,
} from "./compute";

const R = (rupees: number) => rupees * 100;
const line = (p: ReturnType<typeof computePayslip>, name: string) =>
  p.lines.find((l) => l.name === name)!.amountMinor;

describe("standardStructure", () => {
  it("splits CTC so earnings add up to a twelfth of it, to the rupee", () => {
    for (const ctc of [R(480_000), R(1_200_000), R(1_850_000), R(3_333_333)]) {
      const parts = standardStructure(ctc);
      expect(structureProblems(parts)).toEqual([]);
      const slip = computePayslip({ components: parts, workingDays: 22, lopDays: 0 });
      expect(slip.grossMinor).toBe(roundToRupee(ctc / 12));
    }
  });

  it("uses a 40% basic with HRA at half of it", () => {
    const slip = computePayslip({
      components: standardStructure(R(1_200_000)),
      workingDays: 22,
      lopDays: 0,
    });
    expect(line(slip, "Basic salary")).toBe(R(40_000));
    expect(line(slip, "House rent allowance")).toBe(R(20_000));
    expect(line(slip, "Provident fund")).toBe(R(4_800));
    expect(line(slip, "Professional tax")).toBe(R(200));
    // 10 lakh to 15 lakh: 10% of gross
    expect(line(slip, "Income tax (TDS)")).toBe(R(10_000));
  });

  it("leaves out what doesn't apply to small salaries", () => {
    const names = standardStructure(R(240_000)).map((c) => c.name);
    expect(names).not.toContain("Conveyance");
    expect(names).not.toContain("Professional tax");
    expect(names).not.toContain("Income tax (TDS)");
  });
});

describe("computePayslip", () => {
  const parts = standardStructure(R(1_200_000));

  it("pays in full with no loss of pay", () => {
    const s = computePayslip({ components: parts, workingDays: 22, lopDays: 0 });
    expect(s).toMatchObject({ paidDays: 22, lopDays: 0, grossMinor: R(100_000) });
    expect(s.netMinor).toBe(s.grossMinor - s.deductionsMinor);
  });

  it("prorates earnings, and percentage deductions follow the prorated basic", () => {
    const s = computePayslip({ components: parts, workingDays: 20, lopDays: 5 });
    expect(s.paidDays).toBe(15);
    expect(s.grossMinor).toBe(R(75_000));
    expect(line(s, "Basic salary")).toBe(R(30_000));
    expect(line(s, "Provident fund")).toBe(R(3_600));
    // Professional tax is a flat amount, not prorated.
    expect(line(s, "Professional tax")).toBe(R(200));
    expect(s.lines.find((l) => l.name === "Basic salary")!.fullMinor).toBe(R(40_000));
  });

  it("rounds every line to a whole rupee", () => {
    const s = computePayslip({ components: parts, workingDays: 23, lopDays: 1.5 });
    for (const l of s.lines) expect(l.amountMinor % 100).toBe(0);
    expect(s.grossMinor).toBe(
      s.lines.filter((l) => l.kind === "EARNING").reduce((n, l) => n + l.amountMinor, 0),
    );
  });

  it("waives flat deductions when nothing was paid", () => {
    const s = computePayslip({ components: parts, workingDays: 22, lopDays: 22 });
    expect(s).toMatchObject({ paidDays: 0, grossMinor: 0, deductionsMinor: 0, netMinor: 0 });
  });

  it("never lets net pay go below zero", () => {
    const heavy: Component[] = [
      {
        name: "Basic salary",
        kind: "EARNING",
        calc: "FIXED",
        amountMinor: R(10_000),
        percentBps: null,
        sortOrder: 0,
      },
      {
        name: "Loan recovery",
        kind: "DEDUCTION",
        calc: "FIXED",
        amountMinor: R(8_000),
        percentBps: null,
        sortOrder: 1,
      },
      {
        name: "Advance",
        kind: "DEDUCTION",
        calc: "FIXED",
        amountMinor: R(8_000),
        percentBps: null,
        sortOrder: 2,
      },
    ];
    const s = computePayslip({ components: heavy, workingDays: 20, lopDays: 0 });
    expect(s.netMinor).toBeGreaterThanOrEqual(0);
    expect(s.deductionsMinor).toBeLessThanOrEqual(s.grossMinor);
  });

  it("caps paid days at the working days", () => {
    expect(computePayslip({ components: parts, workingDays: 20, lopDays: -3 }).paidDays).toBe(20);
    expect(computePayslip({ components: parts, workingDays: 0, lopDays: 0 }).grossMinor).toBe(0);
  });
});

describe("structureProblems", () => {
  it("asks for exactly one basic, sensible amounts and no earnings on gross", () => {
    expect(structureProblems([])).toContain("A structure needs exactly one Basic earning.");
    const bad: Component[] = [
      {
        name: "Basic salary",
        kind: "EARNING",
        calc: "PERCENT_OF_BASIC",
        amountMinor: null,
        percentBps: 5000,
        sortOrder: 0,
      },
      {
        name: "Bonus",
        kind: "EARNING",
        calc: "PERCENT_OF_GROSS",
        amountMinor: null,
        percentBps: 500,
        sortOrder: 1,
      },
      {
        name: "Fee",
        kind: "DEDUCTION",
        calc: "FIXED",
        amountMinor: null,
        percentBps: null,
        sortOrder: 2,
      },
    ];
    const problems = structureProblems(bad);
    expect(problems).toContain("Basic must be a fixed amount.");
    expect(problems.some((p) => p.includes("gross"))).toBe(true);
    expect(problems).toContain("Fee needs an amount.");
  });
});

type Rec = { status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" };

describe("lossOfPay", () => {
  const base = {
    start: "2026-09-01",
    end: "2026-09-30",
    today: "2026-10-30",
    workDays: [1, 2, 3, 4, 5],
    holidays: new Set<string>(),
    employedFrom: "2020-01-01",
    employedTo: null,
    records: new Map<string, Rec>(),
    leave: new Map<string, { portion: number; paid: boolean }>(),
  };
  const present = () => {
    const m = new Map<string, Rec>();
    for (let d = 1; d <= 30; d++)
      m.set(`2026-09-${String(d).padStart(2, "0")}`, { status: "PRESENT" });
    return m;
  };

  it("counts working days and treats unrecorded days as absence", () => {
    // September 2026 has 22 weekdays.
    expect(lossOfPay(base)).toEqual({ workingDays: 22, lop: 22 });
  });

  it("pays days that were worked, and skips holidays", () => {
    const r = lossOfPay({ ...base, records: present(), holidays: new Set(["2026-09-14"]) });
    expect(r).toEqual({ workingDays: 21, lop: 0 });
  });

  it("charges unpaid leave but not paid leave", () => {
    const records = present();
    records.delete("2026-09-01");
    records.delete("2026-09-02");
    const leave = new Map([
      ["2026-09-01", { portion: 1, paid: true }],
      ["2026-09-02", { portion: 1, paid: false }],
    ]);
    expect(lossOfPay({ ...base, records, leave }).lop).toBe(1);
  });

  it("charges half a day for a half day, and never more than a day", () => {
    const records = new Map<string, Rec>([
      ["2026-09-01", { status: "HALF_DAY" }],
      ["2026-09-02", { status: "PRESENT" }],
    ]);
    const leave = new Map([["2026-09-02", { portion: 0.5, paid: false }]]);
    const r = lossOfPay({ ...base, end: "2026-09-02", records, leave });
    expect(r.lop).toBe(1);
    const both = lossOfPay({
      ...base,
      end: "2026-09-01",
      records: new Map<string, Rec>([["2026-09-01", { status: "ABSENT" }]]),
      leave: new Map([["2026-09-01", { portion: 1, paid: false }]]),
    });
    expect(both.lop).toBe(1);
  });

  it("docks days before joining and after leaving", () => {
    const r = lossOfPay({
      ...base,
      records: present(),
      employedFrom: "2026-09-15",
      employedTo: "2026-09-25",
    });
    // Weekdays 1–14 (10) before joining and 28–30 (3) after leaving.
    expect(r.lop).toBe(13);
  });

  it("doesn't dock days that haven't happened yet", () => {
    const r = lossOfPay({ ...base, start: "2026-10-26", end: "2026-10-30", today: "2026-10-28" });
    expect(r).toEqual({ workingDays: 5, lop: 2 });
  });
});

describe("diffRuns", () => {
  const prev = [
    { employeeId: "a", grossMinor: 100, netMinor: 100 },
    { employeeId: "b", grossMinor: 200, netMinor: 200 },
    { employeeId: "c", grossMinor: 300, netMinor: 300 },
  ];
  const curr = [
    { employeeId: "a", grossMinor: 100, netMinor: 100 },
    { employeeId: "b", grossMinor: 150, netMinor: 150 },
    { employeeId: "d", grossMinor: 400, netMinor: 400 },
  ];

  it("finds joiners, leavers and changes, largest first, flagging big swings", () => {
    const d = diffRuns(prev, curr);
    expect(d.joined).toEqual(["d"]);
    expect(d.left).toEqual(["c"]);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]).toMatchObject({ employeeId: "b", deltaMinor: -50, flagged: true });
    expect(d.totals).toMatchObject({ netMinor: 650, previousNetMinor: 600, headcount: 3 });
  });

  it("only flags swings past the threshold", () => {
    const d = diffRuns(
      [{ employeeId: "a", grossMinor: 1000, netMinor: 1000 }],
      [{ employeeId: "a", grossMinor: 1050, netMinor: 1050 }],
    );
    expect(d.changed[0]!.flagged).toBe(false);
  });
});

describe("runnableMonth", () => {
  it("opens a month after it ends, or once it's past the 25th", () => {
    expect(runnableMonth(2026, 9, "2026-10-01")).toBe(true);
    expect(runnableMonth(2026, 10, "2026-10-24")).toBe(false);
    expect(runnableMonth(2026, 10, "2026-10-25")).toBe(true);
    expect(runnableMonth(2026, 11, "2026-10-30")).toBe(false);
  });
});
