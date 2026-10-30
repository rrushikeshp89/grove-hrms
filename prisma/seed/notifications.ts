/**
 * A few notifications for each demo account, drawn from what the other steps
 * seeded: pending approvals, the latest payslip, the newest announcement.
 * Some are read and some aren't, so the bell has something to show on a
 * first sign-in.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function seedNotifications(db: PrismaClient): Promise<{ notifications: number }> {
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * 3_600_000);

  const users = await db.user.findMany({
    where: { isDemo: true },
    select: { id: true, employeeId: true },
  });
  // The newest post that reaches everyone, so every demo account can open it.
  const recent = await db.announcement.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: 10,
    select: { id: true, title: true, bodyText: true, audience: true },
  });
  const announcement = recent.find((a) => {
    const aud = a.audience as { departmentIds?: string[]; locationIds?: string[] } | null;
    return !aud?.departmentIds?.length && !aud?.locationIds?.length;
  });

  const rows: {
    recipientId: string;
    kind: "APPROVAL_REQUESTED" | "REMINDER" | "ANNOUNCEMENT" | "SYSTEM" | "APPROVAL_DECIDED";
    title: string;
    body: string | null;
    href: string | null;
    readAt: Date | null;
    createdAt: Date;
  }[] = [];

  for (const u of users) {
    if (u.employeeId) {
      const waiting = await db.approvalStep.count({
        where: { approverId: u.employeeId, status: "WAITING", request: { status: "PENDING" } },
      });
      if (waiting > 0) {
        rows.push({
          recipientId: u.id,
          kind: "APPROVAL_REQUESTED",
          title:
            waiting === 1
              ? "A request is waiting for you"
              : `${waiting} requests are waiting for you`,
          body: "Leave and attendance corrections from your team.",
          href: "/approvals",
          readAt: null,
          createdAt: ago(2),
        });
      }

      const payslip = await db.payslip.findFirst({
        where: { employeeId: u.employeeId, run: { status: "FINALIZED" } },
        orderBy: [{ run: { year: "desc" } }, { run: { month: "desc" } }],
        select: { id: true, run: { select: { year: true, month: true } } },
      });
      if (payslip) {
        rows.push({
          recipientId: u.id,
          kind: "SYSTEM",
          title: `Your ${MONTHS[payslip.run.month - 1]} ${payslip.run.year} payslip is ready`,
          body: null,
          href: `/pay/${payslip.id}`,
          readAt: ago(30),
          createdAt: ago(52),
        });
      }
    }

    if (announcement) {
      rows.push({
        recipientId: u.id,
        kind: "ANNOUNCEMENT",
        title: announcement.title,
        body: announcement.bodyText.slice(0, 120),
        href: `/announcements#a-${announcement.id}`,
        readAt: null,
        createdAt: ago(20),
      });
    }

    rows.push({
      recipientId: u.id,
      kind: "SYSTEM",
      title: "Find anything with the command palette",
      body: "Press Ctrl+K or / to search people, jobs and policies, and ? to see every shortcut.",
      href: null,
      readAt: ago(70),
      createdAt: ago(96),
    });
  }

  if (rows.length > 0) await db.notification.createMany({ data: rows });
  return { notifications: rows.length };
}
