import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Rng } from "./rng";

/**
 * Profile texture: bios, pronouns and preferred names for some people, and
 * a history of promotions in the audit log so profile timelines aren't
 * empty. Runs after employees and sign-in accounts exist.
 */

const BIOS: Record<string, string[]> = {
  Engineering: [
    "Works on the scheduling engine. Ask me about Postgres query plans or on-call runbooks.",
    "Builds the web app's design system components. Happy to pair on accessibility.",
    "Keeps our deploys boring. Owns CI, Terraform and the incident review process.",
    "Mobile first, offline always. Currently rebuilding sync for the Android app.",
    "Payments and billing integrations. Will happily explain GST invoicing rules.",
  ],
  Product: [
    "PM for time and attendance. Talks to two customers a week, minimum.",
    "Runs our experimentation programme. Ask me before you ship an A/B test.",
    "Owns pricing and packaging. Spreadsheets are a love language.",
  ],
  Design: [
    "Product designer on onboarding and self-service. Sketches first, Figma second.",
    "Researcher. If you have a question about how customers work, I probably have a recording.",
    "Brand and illustration. Responsible for every leaf you see in Grove.",
  ],
  "People & Culture": [
    "Recruiting for engineering and product. Referrals always welcome.",
    "Learning and development. Runs the manager training cohorts.",
    "HR operations: payroll inputs, policies and the questions nobody else can answer.",
  ],
  Sales: [
    "Mid-market account executive for South India. Coffee meetings preferred.",
    "Enterprise deals and security reviews. Has filled in more questionnaires than anyone.",
  ],
  "Customer Success": [
    "Onboards new customers in their first 90 days. Fluent in Kannada, Tamil and spreadsheets.",
    "Support lead for the evening shift. Knows every edge case in leave policies.",
  ],
  "Finance & Operations": [
    "Month-end close, audits and vendor payments. Please submit receipts on time.",
    "IT and office. Laptops, access cards and the coffee machine.",
  ],
  Leadership: ["Building a company people are proud to work at, one calm process at a time."],
};

const PRONOUNS = ["she/her", "he/him", "they/them"];

type Person = {
  id: string;
  firstName: string;
  departmentName: string;
  joinDate: Date;
  designationId: string;
  level: number;
  departmentId: string;
};

export async function seedProfiles(
  db: PrismaClient,
  rng: Rng,
  people: Person[],
  hrUserId: string | null,
  /** Named demo people keep their full names; they're referenced in docs and tests. */
  keepNames: Set<string>,
) {
  // Bios, pronouns, a few preferred names.
  for (const p of people) {
    const data: { bio?: string; pronouns?: string; preferredName?: string } = {};
    if (rng.chance(0.45)) data.bio = rng.pick(BIOS[p.departmentName] ?? BIOS.Leadership!);
    if (rng.chance(0.25)) data.pronouns = rng.pick(PRONOUNS);
    if (!keepNames.has(p.id) && p.firstName.length > 7 && rng.chance(0.4)) {
      data.preferredName = p.firstName.slice(0, 4);
    }
    if (Object.keys(data).length) await db.employee.update({ where: { id: p.id }, data });
  }

  // Promotions: people at level 3+ who've been here 18+ months often moved
  // up from the title below theirs.
  const designations = await db.designation.findMany({
    select: { id: true, level: true, departmentId: true },
  });
  const now = Date.now();
  const entries = [];
  for (const p of people) {
    const months = (now - p.joinDate.getTime()) / (30 * 864e5);
    if (p.level < 3 || months < 18 || !rng.chance(0.55)) continue;
    const lower = designations.filter(
      (d) => d.departmentId === p.departmentId && d.level === p.level - 1,
    );
    if (lower.length === 0) continue;
    const from = rng.pick(lower);
    const earliest = p.joinDate.getTime() + 12 * 30 * 864e5;
    const latest = now - 45 * 864e5;
    const at = new Date(earliest + rng.next() * Math.max(0, latest - earliest));
    entries.push({
      actorId: hrUserId,
      action: "employee.update_job",
      entityType: "Employee",
      entityId: p.id,
      before: { designationId: from.id },
      after: { designationId: p.designationId },
      createdAt: at,
    });
  }
  if (entries.length) await db.auditLog.createMany({ data: entries });
  return entries.length;
}
