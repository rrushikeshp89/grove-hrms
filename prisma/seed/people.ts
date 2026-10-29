import { BENGALURU_AREAS, LANGUAGES, NAMES, REMOTE_CITIES, SKILLS } from "./names";
import type { Rng } from "./rng";

/**
 * The org chart of Northwind Grove. Named people anchor the demo (the four
 * demo logins and the faces used across the design system); everyone else
 * is generated into the slots around them.
 */

export type DemoRole = "SUPER_ADMIN" | "HR_MANAGER" | "TEAM_MANAGER" | "EMPLOYEE";
type Status = "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "NOTICE" | "EXITED";

export type PersonSeed = {
  key: string;
  firstName: string;
  lastName: string;
  title: string;
  level: number;
  department: string;
  managerKey: string | null;
  joinDate: string;
  exitDate?: string;
  exitReason?: string;
  status: Status;
  remote: boolean;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  demo?: DemoRole;
  hrRole?: boolean;
  skills: string[];
  city: string;
  area?: string;
  state: string;
};

export const DEPARTMENTS = [
  {
    name: "Leadership",
    code: "LDR",
    color: "chart-6",
    description: "Company direction, strategy and operations.",
  },
  {
    name: "Engineering",
    code: "ENG",
    color: "chart-1",
    description: "Builds and runs the Northwind platform.",
  },
  {
    name: "Product",
    code: "PRD",
    color: "chart-4",
    description: "Decides what we build and why, and measures whether it worked.",
  },
  { name: "Design", code: "DES", color: "chart-5", description: "Product, brand and research." },
  {
    name: "People & Culture",
    code: "PPL",
    color: "chart-2",
    description: "Hiring, growth, wellbeing and everything in between.",
  },
  {
    name: "Sales",
    code: "SAL",
    color: "chart-3",
    description: "New customers, from first call to signed contract.",
  },
  {
    name: "Customer Success",
    code: "CS",
    color: "chart-4",
    description: "Onboarding, support and renewals.",
  },
  {
    name: "Finance & Operations",
    code: "FIN",
    color: "chart-6",
    description: "Money, legal, IT and the office.",
  },
] as const;

type Fixed = Partial<PersonSeed> &
  Pick<
    PersonSeed,
    "key" | "firstName" | "lastName" | "title" | "level" | "department" | "joinDate"
  >;

const FIXED: Fixed[] = [
  {
    key: "ceo",
    firstName: "Kavya",
    lastName: "Menon",
    title: "Chief Executive Officer",
    level: 9,
    department: "Leadership",
    managerKey: null,
    joinDate: "2020-02-03",
  },
  {
    key: "coo",
    firstName: "Aditya",
    lastName: "Banerjee",
    title: "Chief Operating Officer",
    level: 8,
    department: "Leadership",
    managerKey: "ceo",
    joinDate: "2020-03-02",
    demo: "SUPER_ADMIN",
  },

  {
    key: "vpeng",
    firstName: "Siddharth",
    lastName: "Kashyap",
    title: "VP Engineering",
    level: 7,
    department: "Engineering",
    managerKey: "ceo",
    joinDate: "2020-06-15",
  },
  {
    key: "em_web",
    firstName: "Priya",
    lastName: "Raman",
    title: "Engineering Manager",
    level: 5,
    department: "Engineering",
    managerKey: "vpeng",
    joinDate: "2021-03-15",
    demo: "TEAM_MANAGER",
  },
  {
    key: "em_platform",
    firstName: "Karan",
    lastName: "Malhotra",
    title: "Engineering Manager",
    level: 5,
    department: "Engineering",
    managerKey: "vpeng",
    joinDate: "2021-01-11",
  },
  {
    key: "em_mobile",
    firstName: "Deepa",
    lastName: "Pillai",
    title: "Engineering Manager",
    level: 5,
    department: "Engineering",
    managerKey: "vpeng",
    joinDate: "2021-09-06",
  },
  {
    key: "arjun",
    firstName: "Arjun",
    lastName: "Mehta",
    title: "Senior Frontend Engineer",
    level: 3,
    department: "Engineering",
    managerKey: "em_web",
    joinDate: "2022-01-10",
    demo: "EMPLOYEE",
  },
  {
    key: "fatima",
    firstName: "Fatima",
    lastName: "Shaikh",
    title: "Backend Engineer",
    level: 2,
    department: "Engineering",
    managerKey: "em_web",
    joinDate: "2023-02-20",
  },
  {
    key: "daniel",
    firstName: "Daniel",
    lastName: "Thomas",
    title: "Site Reliability Engineer",
    level: 3,
    department: "Engineering",
    managerKey: "em_web",
    joinDate: "2024-05-06",
    remote: true,
  },

  {
    key: "hop",
    firstName: "Neeraj",
    lastName: "Bhalla",
    title: "Head of Product",
    level: 7,
    department: "Product",
    managerKey: "ceo",
    joinDate: "2020-09-14",
  },
  {
    key: "sneha",
    firstName: "Sneha",
    lastName: "Kulkarni",
    title: "Product Manager",
    level: 4,
    department: "Product",
    managerKey: "hop",
    joinDate: "2023-07-03",
  },
  {
    key: "rohan",
    firstName: "Rohan",
    lastName: "D'Souza",
    title: "Data Analyst",
    level: 2,
    department: "Product",
    managerKey: "hop",
    joinDate: "2026-10-19",
    status: "ONBOARDING",
    remote: true,
  },

  {
    key: "hod",
    firstName: "Malini",
    lastName: "Rajagopal",
    title: "Head of Design",
    level: 6,
    department: "Design",
    managerKey: "ceo",
    joinDate: "2021-02-01",
  },
  {
    key: "ananya",
    firstName: "Ananya",
    lastName: "Iyer",
    title: "Product Designer",
    level: 3,
    department: "Design",
    managerKey: "hod",
    joinDate: "2022-06-01",
    status: "ON_LEAVE",
    remote: true,
  },
  {
    key: "lakshmi",
    firstName: "Lakshmi",
    lastName: "Venkatesh",
    title: "UX Researcher",
    level: 3,
    department: "Design",
    managerKey: "hod",
    joinDate: "2025-02-17",
  },

  {
    key: "hr",
    firstName: "Rahul",
    lastName: "Deshpande",
    title: "Head of People",
    level: 7,
    department: "People & Culture",
    managerKey: "ceo",
    joinDate: "2020-11-02",
    demo: "HR_MANAGER",
  },
  {
    key: "aisha",
    firstName: "Aisha",
    lastName: "Khan",
    title: "People Partner",
    level: 4,
    department: "People & Culture",
    managerKey: "hr",
    joinDate: "2024-01-15",
    hrRole: true,
  },

  {
    key: "hos",
    firstName: "Rajiv",
    lastName: "Saldanha",
    title: "Head of Sales",
    level: 7,
    department: "Sales",
    managerKey: "ceo",
    joinDate: "2020-08-03",
  },
  {
    key: "sm_ent",
    firstName: "Pallavi",
    lastName: "Shenoy",
    title: "Sales Manager",
    level: 5,
    department: "Sales",
    managerKey: "hos",
    joinDate: "2022-04-04",
  },
  {
    key: "sm_mid",
    firstName: "Imtiaz",
    lastName: "Hussain",
    title: "Sales Manager",
    level: 5,
    department: "Sales",
    managerKey: "hos",
    joinDate: "2022-11-14",
  },
  {
    key: "karthik",
    firstName: "Karthik",
    lastName: "Subramanian",
    title: "Account Executive",
    level: 3,
    department: "Sales",
    managerKey: "sm_ent",
    joinDate: "2021-08-09",
    status: "NOTICE",
  },
  {
    key: "nikhil",
    firstName: "Nikhil",
    lastName: "Bose",
    title: "Sales Development Representative",
    level: 1,
    department: "Sales",
    managerKey: "sm_mid",
    joinDate: "2026-10-26",
    status: "ONBOARDING",
  },

  {
    key: "hcs",
    firstName: "Meera",
    lastName: "Nair",
    title: "Head of Customer Success",
    level: 6,
    department: "Customer Success",
    managerKey: "coo",
    joinDate: "2022-09-12",
    remote: true,
  },
  {
    key: "cs_lead1",
    firstName: "Joel",
    lastName: "Fernandes",
    title: "Customer Success Team Lead",
    level: 4,
    department: "Customer Success",
    managerKey: "hcs",
    joinDate: "2023-01-09",
  },
  {
    key: "cs_lead2",
    firstName: "Shalini",
    lastName: "Gowda",
    title: "Customer Success Team Lead",
    level: 4,
    department: "Customer Success",
    managerKey: "hcs",
    joinDate: "2023-05-22",
  },

  {
    key: "fin",
    firstName: "Vikram",
    lastName: "Rao",
    title: "Head of Finance",
    level: 6,
    department: "Finance & Operations",
    managerKey: "coo",
    joinDate: "2020-04-27",
  },
];

type Slot = { managerKey: string; department: string; titles: [string, number][]; count: number };

const SLOTS: Slot[] = [
  {
    managerKey: "em_web",
    department: "Engineering",
    count: 5,
    titles: [
      ["Frontend Engineer", 2],
      ["Senior Frontend Engineer", 3],
      ["Software Engineer", 2],
      ["QA Engineer", 2],
      ["Senior Backend Engineer", 3],
    ],
  },
  {
    managerKey: "em_platform",
    department: "Engineering",
    count: 13,
    titles: [
      ["Backend Engineer", 2],
      ["Senior Backend Engineer", 3],
      ["Site Reliability Engineer", 3],
      ["Staff Engineer", 4],
      ["Software Engineer", 2],
      ["Data Engineer", 3],
    ],
  },
  {
    managerKey: "em_mobile",
    department: "Engineering",
    count: 13,
    titles: [
      ["Mobile Engineer", 2],
      ["Senior Mobile Engineer", 3],
      ["QA Engineer", 2],
      ["Software Engineer", 2],
      ["Frontend Engineer", 2],
    ],
  },
  {
    managerKey: "hop",
    department: "Product",
    count: 7,
    titles: [
      ["Product Manager", 4],
      ["Associate Product Manager", 2],
      ["Senior Product Manager", 5],
      ["Data Analyst", 2],
      ["Product Analyst", 3],
    ],
  },
  {
    managerKey: "hod",
    department: "Design",
    count: 5,
    titles: [
      ["Product Designer", 3],
      ["Senior Product Designer", 4],
      ["Brand Designer", 3],
      ["UX Writer", 3],
    ],
  },
  {
    managerKey: "hr",
    department: "People & Culture",
    count: 4,
    titles: [
      ["Talent Acquisition Specialist", 3],
      ["HR Operations Executive", 2],
      ["Learning & Development Specialist", 3],
    ],
  },
  {
    managerKey: "sm_ent",
    department: "Sales",
    count: 5,
    titles: [
      ["Account Executive", 3],
      ["Senior Account Executive", 4],
      ["Sales Engineer", 4],
    ],
  },
  {
    managerKey: "sm_mid",
    department: "Sales",
    count: 6,
    titles: [
      ["Account Executive", 3],
      ["Sales Development Representative", 1],
    ],
  },
  {
    managerKey: "cs_lead1",
    department: "Customer Success",
    count: 5,
    titles: [
      ["Customer Success Manager", 3],
      ["Support Specialist", 2],
    ],
  },
  {
    managerKey: "cs_lead2",
    department: "Customer Success",
    count: 5,
    titles: [
      ["Customer Success Manager", 3],
      ["Support Specialist", 2],
      ["Implementation Specialist", 3],
    ],
  },
  {
    managerKey: "fin",
    department: "Finance & Operations",
    count: 8,
    titles: [
      ["Accountant", 2],
      ["Senior Accountant", 3],
      ["IT Administrator", 3],
      ["Office Manager", 3],
      ["Procurement Executive", 2],
      ["Legal Counsel", 4],
    ],
  },
];

/** Former employees who left during the last twelve months. */
const LEAVERS: {
  managerKey: string;
  department: string;
  title: string;
  level: number;
  reason: string;
}[] = [
  {
    managerKey: "em_platform",
    department: "Engineering",
    title: "Senior Backend Engineer",
    level: 3,
    reason: "Joined another company",
  },
  {
    managerKey: "em_mobile",
    department: "Engineering",
    title: "Mobile Engineer",
    level: 2,
    reason: "Higher studies",
  },
  {
    managerKey: "em_web",
    department: "Engineering",
    title: "Frontend Engineer",
    level: 2,
    reason: "Relocated abroad",
  },
  {
    managerKey: "sm_mid",
    department: "Sales",
    title: "Account Executive",
    level: 3,
    reason: "Joined another company",
  },
  {
    managerKey: "sm_ent",
    department: "Sales",
    title: "Sales Development Representative",
    level: 1,
    reason: "Career change",
  },
  {
    managerKey: "cs_lead1",
    department: "Customer Success",
    title: "Support Specialist",
    level: 2,
    reason: "Joined another company",
  },
  {
    managerKey: "hod",
    department: "Design",
    title: "Brand Designer",
    level: 3,
    reason: "Started freelancing",
  },
  {
    managerKey: "hop",
    department: "Product",
    title: "Product Analyst",
    level: 3,
    reason: "Joined another company",
  },
  {
    managerKey: "fin",
    department: "Finance & Operations",
    title: "Accountant",
    level: 2,
    reason: "Family reasons",
  },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** A weekday date between two ISO dates. */
function dateBetween(rng: Rng, from: string, to: string) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  const d = new Date(a + rng.next() * (b - a));
  const day = d.getUTCDay();
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  return isoDate(d);
}

export function buildPeople(rng: Rng, today: Date): PersonSeed[] {
  const recentFrom = isoDate(new Date(today.getTime() - 360 * 864e5));
  const recentTo = isoDate(new Date(today.getTime() - 21 * 864e5));
  const usedNames = new Set(FIXED.map((f) => `${f.firstName} ${f.lastName}`));
  const pool = rng.shuffle(NAMES).filter(([f, l]) => !usedNames.has(`${f} ${l}`));
  let poolIndex = 0;
  const nextName = () => {
    const n = pool[poolIndex++];
    if (!n) throw new Error("Ran out of seed names; add more to names.ts");
    return n;
  };

  function place(remote: boolean) {
    if (remote) {
      const c = rng.pick(REMOTE_CITIES);
      return { city: c.city, state: c.state };
    }
    return { city: "Bengaluru", state: "Karnataka", area: rng.pick(BENGALURU_AREAS) };
  }

  function skillsFor(dept: string) {
    const base = rng.shuffle(SKILLS[dept] ?? []).slice(0, rng.int(2, 4));
    return rng.chance(0.5) ? [...base, rng.pick(LANGUAGES)] : base;
  }

  const people: PersonSeed[] = FIXED.map((f) => {
    const remote = f.remote ?? false;
    return {
      managerKey: null,
      status: "ACTIVE",
      employmentType: "FULL_TIME",
      ...f,
      remote,
      skills: skillsFor(f.department),
      ...place(remote),
    } as PersonSeed;
  });

  let n = 0;
  for (const slot of SLOTS) {
    for (let i = 0; i < slot.count; i++) {
      const [firstName, lastName] = nextName();
      const [title, level] = rng.pick(slot.titles);
      const recent = rng.chance(0.24);
      const remote = rng.chance(0.18);
      const employmentType = rng.chance(0.04)
        ? "CONTRACT"
        : rng.chance(0.03)
          ? "INTERN"
          : "FULL_TIME";
      people.push({
        key: `g${++n}`,
        firstName,
        lastName,
        title: employmentType === "INTERN" ? `${title.replace(/^Senior /, "")} Intern` : title,
        level: employmentType === "INTERN" ? 1 : level,
        department: slot.department,
        managerKey: slot.managerKey,
        joinDate: recent
          ? dateBetween(rng, recentFrom, recentTo)
          : dateBetween(rng, "2021-01-04", "2025-10-31"),
        status: "ACTIVE",
        remote,
        employmentType,
        skills: skillsFor(slot.department),
        ...place(remote),
      });
    }
  }

  for (const l of LEAVERS) {
    const [firstName, lastName] = nextName();
    const remote = rng.chance(0.2);
    people.push({
      key: `x${++n}`,
      firstName,
      lastName,
      title: l.title,
      level: l.level,
      department: l.department,
      managerKey: l.managerKey,
      joinDate: dateBetween(rng, "2021-02-01", "2024-06-28"),
      exitDate: dateBetween(rng, recentFrom, recentTo),
      exitReason: l.reason,
      status: "EXITED",
      remote,
      employmentType: "FULL_TIME",
      skills: skillsFor(l.department),
      ...place(remote),
    });
  }

  // A couple of people on leave or serving notice make the directory feel lived-in.
  const active = people.filter((p) => p.key.startsWith("g"));
  rng.pick(active).status = "ON_LEAVE";
  rng.pick(active).status = "NOTICE";

  return people;
}

/** Parents before children, so managerId always points at an inserted row. */
export function byHierarchy(people: PersonSeed[]): PersonSeed[] {
  const byKey = new Map(people.map((p) => [p.key, p]));
  const depth = (p: PersonSeed): number => (p.managerKey ? 1 + depth(byKey.get(p.managerKey)!) : 0);
  return [...people].sort((a, b) => depth(a) - depth(b));
}
