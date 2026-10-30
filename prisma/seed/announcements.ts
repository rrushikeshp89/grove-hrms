/**
 * Company announcements: a mix of company-wide and targeted posts, one
 * pinned, one draft, with reactions and read receipts that fall off with age.
 * The demo employee hasn't read the two newest, so the unread markers show.
 */
import {
  docToText,
  type Audience,
  type Doc,
  type Node,
} from "../../src/features/announcements/logic/content";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { addDays, instantAt, isoFromDbDate, type ISODate } from "../../src/lib/tz";
import type { Rng } from "./rng";

const text = (t: string, marks?: Node["marks"]): Node => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});
const p = (...parts: (string | Node)[]): Node => ({
  type: "paragraph",
  content: parts.map((x) => (typeof x === "string" ? text(x) : x)),
});
const h = (t: string): Node => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
const bold = (t: string) => text(t, [{ type: "bold" }]);
const link = (t: string, href: string) => text(t, [{ type: "link", attrs: { href } }]);
const ul = (...items: string[]): Node => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const ol = (...items: string[]): Node => ({
  type: "orderedList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const quote = (t: string): Node => ({ type: "blockquote", content: [p(t)] });
const doc = (...content: Node[]): Doc => ({ type: "doc", content });

type Post = {
  title: string;
  daysAgo: number | null;
  authorKey: "hr" | "ceo" | "coo" | "vpeng" | "fin";
  pinned?: boolean;
  /** Department codes and location names this reaches; none means everyone. */
  departments?: string[];
  locations?: string[];
  body: Doc;
  /** Share of the audience that has read it. */
  reach: number;
};

const POSTS: Post[] = [
  {
    title: "Open enrolment for health insurance closes on 15 November",
    daysAgo: 3,
    authorKey: "hr",
    pinned: true,
    reach: 0.55,
    body: doc(
      p(
        "Our group health cover renews on 1 December. This is the one time a year you can change your plan or add family members, so please decide by ",
        bold("15 November"),
        ".",
      ),
      h("What's changing"),
      ul(
        "The sum insured for everyone goes from Rs. 4 lakh to Rs. 6 lakh at no extra cost to you.",
        "Parents and parents-in-law can now be added on a single plan, with the premium deducted over twelve months.",
        "Mental health consultations are covered up to Rs. 20,000 a year.",
      ),
      h("What to do"),
      ol(
        "Open the benefits guide in Documents and read the plan comparison.",
        "Reply to this thread with questions, or book fifteen minutes with the People team.",
        "Submit your choice in the insurer's portal by 15 November.",
      ),
      p("If you do nothing, your current cover continues and new family members won't be added."),
    ),
  },
  {
    title: "Welcome to our newest teammates",
    daysAgo: 6,
    authorKey: "hr",
    reach: 0.72,
    body: doc(
      p(
        "Eleven people have joined us since August across Engineering, Sales, Design and Customer Success. Say hello when you see them, and offer a coffee if you're in Bengaluru.",
      ),
      quote(
        "The first month decides whether someone feels like they belong. Be the person who made it easy.",
      ),
      p(
        "Their onboarding checklists are in Grove, so managers: please keep an eye on the tasks assigned to you.",
      ),
    ),
  },
  {
    title: "Office closed on 9 November for Deepavali",
    daysAgo: 9,
    authorKey: "hr",
    reach: 0.88,
    locations: ["Bengaluru office"],
    body: doc(
      p(
        "The Bengaluru office is closed on ",
        bold("Monday 9 November"),
        " for Deepavali. Remote colleagues also have the day off.",
      ),
      p(
        "If you're on call that day, your team lead will confirm the roster and arrange time off in lieu. Enjoy the festival with the people you love.",
      ),
    ),
  },
  {
    title: "Q3 company update: where we are and what's next",
    daysAgo: 14,
    authorKey: "ceo",
    reach: 0.93,
    body: doc(
      p(
        "Thank you for a strong quarter. Here's the short version of what happened and what we're focused on next.",
      ),
      h("The numbers"),
      ul(
        "Annual recurring revenue reached Rs. 48.5 crore, up from Rs. 42 crore at the start of the half.",
        "We signed seven new enterprise customers, ahead of plan.",
        "Platform uptime held at 99.7%, with two incidents longer than 30 minutes.",
      ),
      h("Next quarter"),
      p(
        "Reliability stays our first priority. We'll also finish the new billing API, launch self-serve onboarding, and hire carefully into the teams that are stretched. The details are in the ",
        link("company goals", "https://example.com/goals"),
        ".",
      ),
      p("Questions are welcome at the all-hands on Friday."),
    ),
  },
  {
    title: "Engineering: on-call changes from next sprint",
    daysAgo: 20,
    authorKey: "vpeng",
    departments: ["ENG"],
    reach: 0.9,
    body: doc(
      p("Pages per week have been too high for too long. Starting next sprint:"),
      ul(
        "On-call rotations shorten from two weeks to one, with a day off after a night page.",
        "Every alert needs a runbook, or it doesn't page.",
        "A new weekly review decides which alerts to fix, tune or delete.",
      ),
      p(
        "The goal is fewer than five pages a week by December. Tell your manager if the rotation clashes with leave you've planned.",
      ),
    ),
  },
  {
    title: "Learning budget: now Rs. 40,000 a year",
    daysAgo: 31,
    authorKey: "hr",
    reach: 0.8,
    body: doc(
      p(
        "The learning budget goes up from Rs. 30,000 to ",
        bold("Rs. 40,000"),
        " per person per year, effective immediately.",
      ),
      p(
        "It covers courses, books, conferences and certifications relevant to your work. Claim it through the usual expense process; the Expense Reimbursement Policy has the details.",
      ),
    ),
  },
  {
    title: "Reminder: complete the security awareness training by 30 November",
    daysAgo: 38,
    authorKey: "coo",
    reach: 0.96,
    body: doc(
      p(
        "Our yearly security awareness training takes about 40 minutes. Everyone completes it by ",
        bold("30 November"),
        ". It covers phishing, passwords and handling customer data.",
      ),
      p(
        "Your manager will be told who hasn't finished in the first week of December. If you've lost the link, ask IT.",
      ),
    ),
  },
  {
    title: "Finance: new expense claim deadline",
    daysAgo: 52,
    authorKey: "fin",
    departments: ["FIN", "SAL", "CS"],
    reach: 0.85,
    body: doc(
      p(
        "To speed up month-end close, expense claims must be submitted within ",
        bold("30 days"),
        " of the expense, and by the 25th for the current month's payroll. Late claims roll to the following month.",
      ),
    ),
  },
  {
    title: "Hackathon week: ideas wanted",
    daysAgo: null,
    authorKey: "vpeng",
    reach: 0,
    departments: ["ENG", "PRD", "DES"],
    body: doc(
      p(
        "We're planning a hackathon week in January. Bring a half-formed idea that would make Grove better for customers or for us.",
      ),
      p("Draft: dates, judging and prizes to be confirmed before this goes out."),
    ),
  },
];

const REACTION_KINDS = ["like", "celebrate", "love", "insight"] as const;

export async function seedAnnouncements(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; ids: Map<string, string>; arjunId: string },
) {
  const [employees, departments, locations] = await Promise.all([
    db.employee.findMany({
      where: { status: { not: "EXITED" } },
      select: { id: true, departmentId: true, locationId: true, joinDate: true },
    }),
    db.department.findMany({ select: { id: true, code: true } }),
    db.location.findMany({ select: { id: true, name: true } }),
  ]);
  const deptId = new Map(departments.map((d) => [d.code, d.id]));
  const locId = new Map(locations.map((l) => [l.name, l.id]));

  let published = 0;
  let reads = 0;
  let reactions = 0;
  for (const [i, post] of POSTS.entries()) {
    const audience: Audience =
      post.departments || post.locations
        ? {
            departmentIds: (post.departments ?? []).map((c) => deptId.get(c)!).filter(Boolean),
            locationIds: (post.locations ?? []).map((n) => locId.get(n)!).filter(Boolean),
          }
        : null;
    const at = post.daysAgo === null ? null : addDays(opts.today, -post.daysAgo);
    const created = await db.announcement.create({
      data: {
        authorId: opts.ids.get(post.authorKey)!,
        title: post.title,
        body: post.body,
        bodyText: docToText(post.body),
        audience: audience ?? undefined,
        pinned: !!post.pinned,
        publishedAt: at ? instantAt(at, "10:30") : null,
        createdAt: instantAt(at ?? addDays(opts.today, -1), "09:00"),
      },
    });
    if (!at) continue;
    published++;

    const inAudience = employees.filter(
      (e) =>
        isoFromDbDate(e.joinDate) <= at &&
        (!audience?.departmentIds?.length || audience.departmentIds.includes(e.departmentId)) &&
        (!audience?.locationIds?.length || audience.locationIds.includes(e.locationId)),
    );
    // The two newest posts are the ones the demo employee hasn't opened yet.
    const readers = inAudience.filter((e) =>
      e.id === opts.arjunId ? i >= 2 : rng.chance(post.reach),
    );
    await db.announcementRead.createMany({
      data: readers.map((e) => ({
        announcementId: created.id,
        employeeId: e.id,
        readAt: instantAt(addDays(at, rng.int(0, 3)), `${rng.int(9, 18)}:${rng.int(10, 59)}`),
      })),
    });
    reads += readers.length;

    const reacting = readers.filter(() => rng.chance(0.38));
    const rows = reacting.map((e) => ({
      announcementId: created.id,
      employeeId: e.id,
      kind:
        i === 1 || i === 0
          ? rng.pick(["celebrate", "like", "love"] as const)
          : rng.pick(REACTION_KINDS),
    }));
    await db.announcementReaction.createMany({ data: rows, skipDuplicates: true });
    reactions += rows.length;
  }
  return { posts: POSTS.length, published, reads, reactions };
}
