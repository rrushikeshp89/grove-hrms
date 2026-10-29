/**
 * Company-wide reference data: leave types and policies, holidays. Holiday
 * dates are Northwind Grove's published calendar for its Bengaluru office;
 * Karnataka-specific days apply only to the office, so remote staff get a
 * slightly different calendar.
 */

export const LEAVE_TYPES = [
  {
    code: "EL",
    name: "Earned leave",
    colorToken: "chart-1",
    description: "Planned time off. Accrues monthly and up to 30 days carry over.",
    approvalLevels: 1,
    minNoticeDays: 7,
    maxConsecutiveDays: 15,
    policy: { annualQuota: 18, accrual: "MONTHLY", carryForwardMax: 30 },
  },
  {
    code: "CL",
    name: "Casual leave",
    colorToken: "chart-2",
    description: "Short, unplanned time off for personal errands.",
    approvalLevels: 1,
    minNoticeDays: 0,
    maxConsecutiveDays: 3,
    policy: { annualQuota: 8, accrual: "UPFRONT", carryForwardMax: 0 },
  },
  {
    code: "SL",
    name: "Sick leave",
    colorToken: "chart-3",
    description: "For illness or medical appointments. A note is needed after two days.",
    approvalLevels: 1,
    minNoticeDays: 0,
    requiresDocumentAfterDays: 2,
    policy: { annualQuota: 8, accrual: "UPFRONT", carryForwardMax: 0 },
  },
  {
    code: "PL",
    name: "Parental leave",
    colorToken: "chart-4",
    description:
      "26 weeks for birth parents, 4 weeks for partners. HR approves after your manager.",
    approvalLevels: 2,
    minNoticeDays: 30,
    allowHalfDay: false,
    policy: { annualQuota: 130, accrual: "UPFRONT", carryForwardMax: 0, proRataOnJoin: false },
  },
  {
    code: "BL",
    name: "Bereavement leave",
    colorToken: "chart-5",
    description: "Up to five days when someone close to you passes away.",
    approvalLevels: 1,
    minNoticeDays: 0,
    allowHalfDay: false,
    policy: { annualQuota: 5, accrual: "UPFRONT", carryForwardMax: 0, proRataOnJoin: false },
  },
  {
    code: "LWP",
    name: "Leave without pay",
    colorToken: "chart-6",
    description: "Unpaid time off once paid balances run out. HR approves after your manager.",
    approvalLevels: 2,
    minNoticeDays: 7,
    isPaid: false,
    policy: { annualQuota: 0, accrual: "UPFRONT", carryForwardMax: 0, proRataOnJoin: false },
  },
] as const;

type HolidaySeed = { date: string; name: string; officeOnly?: boolean; optional?: boolean };

export const HOLIDAYS: HolidaySeed[] = [
  // 2025
  { date: "2025-01-01", name: "New Year's Day", optional: true },
  { date: "2025-01-14", name: "Makara Sankranti", officeOnly: true },
  { date: "2025-03-31", name: "Eid al-Fitr" },
  { date: "2025-04-18", name: "Good Friday" },
  { date: "2025-05-01", name: "Labour Day", officeOnly: true },
  { date: "2025-08-15", name: "Independence Day" },
  { date: "2025-08-27", name: "Ganesh Chaturthi" },
  { date: "2025-10-01", name: "Ayudha Puja", officeOnly: true },
  { date: "2025-10-02", name: "Gandhi Jayanti & Vijayadashami" },
  { date: "2025-10-20", name: "Deepavali" },
  { date: "2025-12-25", name: "Christmas" },
  // 2026
  { date: "2026-01-01", name: "New Year's Day", optional: true },
  { date: "2026-01-14", name: "Makara Sankranti", officeOnly: true },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi", optional: true },
  { date: "2026-03-19", name: "Ugadi", officeOnly: true },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-05-01", name: "Labour Day", officeOnly: true },
  { date: "2026-09-14", name: "Ganesh Chaturthi" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-11-02", name: "Kannada Rajyotsava (observed)", officeOnly: true },
  { date: "2026-11-09", name: "Deepavali" },
  { date: "2026-12-25", name: "Christmas" },
];
