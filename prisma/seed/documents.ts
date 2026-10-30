/**
 * Documents: the company policy library (real PDFs with real wording), and
 * an employment agreement in every current employee's private folder, plus a
 * couple of personal uploads for the demo people.
 */
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

import { safeFileName } from "../../src/features/documents/logic/rules";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { storage, uploadRoot } from "../../src/lib/storage";
import { addDays, instantAt, isoFromDbDate, type ISODate } from "../../src/lib/tz";
import { simplePdf } from "./pdf";
import type { Rng } from "./rng";

const POLICIES: { title: string; paragraphs: string[] }[] = [
  {
    title: "Code of Conduct",
    paragraphs: [
      "Northwind Grove is a place where people do careful work and treat each other well. This code describes what we expect of everyone, from the newest joiner to the CEO.",
      "# Treat people with respect",
      "We speak to and about colleagues, candidates, customers and partners with courtesy. Disagreement is welcome; contempt is not. Feedback is specific, kind and given in private first.",
      "# Be honest",
      "We tell the truth about our work, our mistakes and our numbers. If something goes wrong, we say so early. Nobody is punished for raising a problem in good faith.",
      "# Handle conflicts of interest openly",
      "If you have a personal or financial interest in a decision, a supplier or a hire, tell your manager and the People team before you act. We will find a way to keep the decision clean.",
      "# Look after what we share",
      "Company equipment, accounts and information are used for company work. Report loss or misuse the same day.",
      "# Speaking up",
      "If you see or experience behaviour that breaks this code, talk to your manager, the People team, or write to people@northwindgrove.in. Reports are handled in confidence and retaliation is itself a breach of this code.",
    ],
  },
  {
    title: "Leave Policy",
    paragraphs: [
      "Time away is part of doing good work. This policy explains the leave available in Grove and how to take it.",
      "# Earned leave",
      "Full-time employees receive 24 days of earned leave each calendar year, credited at 2 days a month. Up to 15 unused days carry forward to the next year. Apply at least 7 days ahead; a request of more than 5 working days also needs People team approval.",
      "# Casual and sick leave",
      "Casual leave is 8 days a year for short, unplanned time off, with at least one day's notice. Sick leave is 8 days a year and can be applied for up to 7 days after the fact. Medical certificates are needed for more than 3 consecutive days.",
      "# Parental leave",
      "Primary caregivers receive 26 weeks of paid leave and secondary caregivers 4 weeks. Talk to the People team as early as you can so your team can plan.",
      "# Holidays",
      "The company calendar lists public holidays for each location. Optional holidays are working days; if you'd like the day off, take it as casual leave.",
      "# Unpaid leave",
      "Leave beyond your balance is unpaid and needs your manager's approval. Unpaid days reduce that month's pay in proportion.",
    ],
  },
  {
    title: "Remote and Hybrid Work Policy",
    paragraphs: [
      "We work from the Bengaluru office or from anywhere in India, depending on the role. This policy sets the common ground.",
      "# Core hours",
      "Everyone is reachable between 11:00 and 17:00 IST. Outside those hours, do what suits you and your team.",
      "# Office days",
      "Teams based at the office meet in person at least two days a week, chosen by the team. Remote roles are fully remote and are invited to team gatherings twice a year, with travel paid.",
      "# Your workspace",
      "We provide a laptop and a one-time home-office allowance of Rs. 25,000 for remote employees. Work from places where you can keep company information private.",
      "# Working from elsewhere",
      "You can work from another city in India for up to four weeks a year without approval, as long as your team knows. Anything longer, or outside India, needs approval from your manager and the People team because of tax and legal rules.",
    ],
  },
  {
    title: "Expense Reimbursement Policy",
    paragraphs: [
      "Spend company money the way you would spend your own, and keep the paperwork.",
      "# What we reimburse",
      "Reasonable travel, accommodation and meals while on company business; client entertainment agreed in advance; learning and conference costs up to your annual learning budget of Rs. 40,000.",
      "# How to claim",
      "Submit receipts within 30 days of the expense. Claims need your manager's approval, and claims above Rs. 25,000 also need Finance approval. Approved claims are paid with the next payroll.",
      "# What we don't reimburse",
      "Personal expenses, fines, alcohol outside agreed client events, and anything without a receipt.",
    ],
  },
  {
    title: "Information Security Policy",
    paragraphs: [
      "Our customers trust us with their data. Protecting it is everyone's job.",
      "# Accounts and passwords",
      "Use the company password manager and a unique password for every account. Turn on two-factor authentication wherever it is offered. Never share a password, even with IT.",
      "# Devices",
      "Keep your operating system and browser updated. Lock your screen when you step away. Company laptops use full-disk encryption; don't disable it.",
      "# Data",
      "Customer data stays in approved systems. Don't copy it to personal devices, personal email or unapproved tools. Share the minimum needed, with the fewest people.",
      "# If something goes wrong",
      "Lost a device, clicked a suspicious link, or sent something to the wrong person? Tell IT within an hour at security@northwindgrove.in. Quick reports let us fix problems while they're small, and nobody is blamed for reporting.",
    ],
  },
  {
    title: "Prevention of Sexual Harassment (POSH) Policy",
    paragraphs: [
      "Northwind Grove is committed to a workplace free of sexual harassment, in line with the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013.",
      "# What counts",
      "Unwelcome physical contact, advances, remarks, jokes, images or messages of a sexual nature, whether in person, online or at off-site events, are harassment.",
      "# Internal Committee",
      "An Internal Committee, led by a senior woman employee and including an external member, receives and inquires into complaints. Its members' names are on the intranet.",
      "# Making a complaint",
      "Complaints can be made in writing to the Internal Committee within three months of the incident, extendable in some circumstances. Complaints and the identities of everyone involved are kept confidential.",
      "# Protection",
      "Nobody who raises a concern in good faith, or helps with an inquiry, will face retaliation. Retaliation is serious misconduct.",
    ],
  },
];

function agreement(name: string, title: string, joinDate: ISODate) {
  return simplePdf("Employment Agreement", [
    `This agreement is between Northwind Grove Technologies Pvt. Ltd. ("the Company") and ${name} ("the Employee").`,
    "# Role",
    `The Employee joins as ${title}, starting on ${joinDate}, reporting to the person named in the offer letter. The Company may change duties and reporting lines as the business needs, after talking with the Employee.`,
    "# Working time and place",
    "Standard hours are 09:30 to 18:30, Monday to Friday, with a one-hour break. The Employee works from the location in the offer letter and follows the Company's remote and hybrid work policy.",
    "# Pay and leave",
    "Pay, allowances and benefits are set out in the offer letter and the Company's policies, each of which may be revised from time to time. Leave is governed by the Leave Policy.",
    "# Confidentiality and conduct",
    "The Employee keeps Company and customer information confidential during and after employment, and follows the Code of Conduct and Information Security Policy.",
    "# Notice",
    "Either party may end this agreement with 60 days' written notice, or pay in lieu. The Company may end it immediately for serious misconduct.",
    "This is a sample document generated for the Grove demo. It has no legal effect.",
  ]);
}

export async function seedDocuments(
  db: PrismaClient,
  rng: Rng,
  opts: { today: ISODate; hrId: string; arjunId: string; priyaId: string },
) {
  await rm(path.join(uploadRoot(), "docs"), { recursive: true, force: true });

  async function add(input: {
    ownerId: string | null;
    category: "ID_PROOF" | "CONTRACT" | "CERTIFICATE" | "POLICY" | "OTHER";
    title: string;
    pdf: Uint8Array;
    visibility: "PRIVATE" | "HR_ONLY" | "COMPANY";
    uploadedById: string;
    at: ISODate;
  }) {
    const id = randomUUID();
    const fileName = safeFileName(`${input.title}.pdf`);
    const storageKey = `docs/${id}/${fileName}`;
    await storage.put(storageKey, input.pdf);
    await db.document.create({
      data: {
        id,
        ownerEmployeeId: input.ownerId,
        category: input.category,
        title: input.title,
        fileName,
        mimeType: "application/pdf",
        sizeBytes: input.pdf.byteLength,
        storageKey,
        uploadedById: input.uploadedById,
        visibility: input.visibility,
        createdAt: instantAt(input.at, "11:00"),
      },
    });
  }

  let policies = 0;
  for (const [i, p] of POLICIES.entries()) {
    await add({
      ownerId: null,
      category: "POLICY",
      title: p.title,
      pdf: simplePdf(p.title, p.paragraphs),
      visibility: "COMPANY",
      uploadedById: opts.hrId,
      at: addDays(opts.today, -300 + i * 17),
    });
    policies++;
  }

  const people = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      joinDate: true,
      designation: { select: { title: true } },
    },
  });
  let folders = 0;
  for (const p of people) {
    const joined = isoFromDbDate(p.joinDate);
    await add({
      ownerId: p.id,
      category: "CONTRACT",
      title: "Employment agreement",
      pdf: agreement(`${p.firstName} ${p.lastName}`, p.designation.title, joined),
      visibility: "PRIVATE",
      uploadedById: opts.hrId,
      at: addDays(joined, -rng.int(5, 20)),
    });
    folders++;
  }

  // A few things people uploaded themselves.
  await add({
    ownerId: opts.arjunId,
    category: "CERTIFICATE",
    title: "Cloud architecture certificate",
    pdf: simplePdf(
      "Certificate of Completion",
      [
        "This certifies that Arjun Mehta has completed the Cloud Architecture Professional programme, covering networked systems, reliability engineering and cost-aware design.",
        "Issued by the Cloud Learning Institute. This is a sample document generated for the Grove demo.",
      ],
      "Cloud Learning Institute",
    ),
    visibility: "PRIVATE",
    uploadedById: opts.arjunId,
    at: addDays(opts.today, -120),
  });
  await add({
    ownerId: opts.priyaId,
    category: "CERTIFICATE",
    title: "Engineering leadership programme",
    pdf: simplePdf(
      "Certificate of Completion",
      [
        "This certifies that Priya Raman has completed the Engineering Leadership programme: coaching, hiring and running healthy teams.",
        "Issued by the Leadership Guild. This is a sample document generated for the Grove demo.",
      ],
      "Leadership Guild",
    ),
    visibility: "PRIVATE",
    uploadedById: opts.priyaId,
    at: addDays(opts.today, -200),
  });

  return { policies, folders, files: policies + folders + 2 };
}
