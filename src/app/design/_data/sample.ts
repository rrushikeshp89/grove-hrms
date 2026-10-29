/**
 * Fixed sample data for the design-system pages only. Product screens read
 * from the database (Phase 2 onward); nothing outside /design imports this.
 */

export type SamplePerson = {
  id: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  location: "Bengaluru" | "Remote (India)";
  status: "active" | "onLeave" | "onboarding" | "notice";
  joined: string; // ISO date
  leaveBalance: number;
};

export const PEOPLE: SamplePerson[] = [
  {
    id: "p01",
    code: "GRV-0007",
    name: "Priya Raman",
    designation: "Engineering Manager",
    department: "Engineering",
    location: "Bengaluru",
    status: "active",
    joined: "2021-03-15",
    leaveBalance: 14.5,
  },
  {
    id: "p02",
    code: "GRV-0018",
    name: "Arjun Mehta",
    designation: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Bengaluru",
    status: "active",
    joined: "2022-01-10",
    leaveBalance: 9,
  },
  {
    id: "p03",
    code: "GRV-0023",
    name: "Ananya Iyer",
    designation: "Product Designer",
    department: "Design",
    location: "Remote (India)",
    status: "onLeave",
    joined: "2022-06-01",
    leaveBalance: 4,
  },
  {
    id: "p04",
    code: "GRV-0031",
    name: "Rahul Deshpande",
    designation: "Head of People",
    department: "People & Culture",
    location: "Bengaluru",
    status: "active",
    joined: "2020-11-02",
    leaveBalance: 18,
  },
  {
    id: "p05",
    code: "GRV-0042",
    name: "Fatima Shaikh",
    designation: "Backend Engineer",
    department: "Engineering",
    location: "Bengaluru",
    status: "active",
    joined: "2023-02-20",
    leaveBalance: 11,
  },
  {
    id: "p06",
    code: "GRV-0047",
    name: "Karthik Subramanian",
    designation: "Account Executive",
    department: "Sales",
    location: "Bengaluru",
    status: "notice",
    joined: "2021-08-09",
    leaveBalance: 6.5,
  },
  {
    id: "p07",
    code: "GRV-0055",
    name: "Meera Nair",
    designation: "Customer Success Lead",
    department: "Customer Success",
    location: "Remote (India)",
    status: "active",
    joined: "2022-09-12",
    leaveBalance: 12,
  },
  {
    id: "p08",
    code: "GRV-0061",
    name: "Vikram Rao",
    designation: "Finance Manager",
    department: "Finance & Ops",
    location: "Bengaluru",
    status: "active",
    joined: "2020-04-27",
    leaveBalance: 16,
  },
  {
    id: "p09",
    code: "GRV-0074",
    name: "Sneha Kulkarni",
    designation: "Product Manager",
    department: "Product",
    location: "Bengaluru",
    status: "active",
    joined: "2023-07-03",
    leaveBalance: 8,
  },
  {
    id: "p10",
    code: "GRV-0088",
    name: "Rohan D'Souza",
    designation: "Data Analyst",
    department: "Product",
    location: "Remote (India)",
    status: "onboarding",
    joined: "2026-10-19",
    leaveBalance: 1.5,
  },
  {
    id: "p11",
    code: "GRV-0090",
    name: "Aisha Khan",
    designation: "People Partner",
    department: "People & Culture",
    location: "Bengaluru",
    status: "active",
    joined: "2024-01-15",
    leaveBalance: 10,
  },
  {
    id: "p12",
    code: "GRV-0093",
    name: "Daniel Thomas",
    designation: "Site Reliability Engineer",
    department: "Engineering",
    location: "Remote (India)",
    status: "active",
    joined: "2024-05-06",
    leaveBalance: 7,
  },
  {
    id: "p13",
    code: "GRV-0101",
    name: "Lakshmi Venkatesh",
    designation: "UX Researcher",
    department: "Design",
    location: "Bengaluru",
    status: "active",
    joined: "2025-02-17",
    leaveBalance: 13,
  },
  {
    id: "p14",
    code: "GRV-0106",
    name: "Nikhil Bose",
    designation: "Sales Development Rep",
    department: "Sales",
    location: "Bengaluru",
    status: "onboarding",
    joined: "2026-10-26",
    leaveBalance: 0.5,
  },
];

export const HOLIDAYS = [
  { date: "2026-11-01", label: "Kannada Rajyotsava" },
  { date: "2026-12-25", label: "Christmas" },
];

export const CONFLICTS = [
  { date: "2026-11-04", names: ["Ananya Iyer", "Arjun Mehta"] },
  { date: "2026-11-05", names: ["Ananya Iyer"] },
  { date: "2026-11-06", names: ["Ananya Iyer"] },
  { date: "2026-11-12", names: ["Daniel Thomas"] },
];

export const HEADCOUNT = [
  { month: "Nov", headcount: 92 },
  { month: "Dec", headcount: 94 },
  { month: "Jan", headcount: 95 },
  { month: "Feb", headcount: 97 },
  { month: "Mar", headcount: 96 },
  { month: "Apr", headcount: 99 },
  { month: "May", headcount: 101 },
  { month: "Jun", headcount: 100 },
  { month: "Jul", headcount: 103 },
  { month: "Aug", headcount: 105 },
  { month: "Sep", headcount: 104 },
  { month: "Oct", headcount: 106 },
];

export const HIRES_EXITS = [
  { month: "May", hires: 4, exits: 2 },
  { month: "Jun", hires: 1, exits: 2 },
  { month: "Jul", hires: 4, exits: 1 },
  { month: "Aug", hires: 3, exits: 1 },
  { month: "Sep", hires: 1, exits: 2 },
  { month: "Oct", hires: 3, exits: 1 },
];

export const DEPARTMENTS = [
  { label: "Engineering", value: 38 },
  { label: "Sales", value: 17 },
  { label: "Customer Success", value: 14 },
  { label: "Product", value: 11 },
  { label: "Design", value: 9 },
  { label: "People & Finance", value: 17 },
];

export const FUNNEL = [
  { label: "Applied", value: 412 },
  { label: "Screening", value: 138 },
  { label: "Interview", value: 54 },
  { label: "Offer", value: 14 },
  { label: "Hired", value: 11 },
];

export const LEAVE_BY_TYPE = [
  { quarter: "Q4 '25", casual: 61, sick: 34, earned: 88 },
  { quarter: "Q1 '26", casual: 48, sick: 52, earned: 40 },
  { quarter: "Q2 '26", casual: 55, sick: 29, earned: 96 },
  { quarter: "Q3 '26", casual: 58, sick: 31, earned: 72 },
];

export const ARRIVALS = {
  rows: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  columns: ["8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00"],
  values: [
    [4, 11, 28, 31, 14, 6, 2],
    [6, 15, 34, 26, 10, 4, 1],
    [5, 14, 33, 27, 12, 4, 1],
    [5, 13, 30, 29, 13, 5, 1],
    [3, 8, 19, 30, 22, 11, 4],
  ],
};
