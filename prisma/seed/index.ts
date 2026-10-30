/**
 * Seeds Northwind Grove. Re-runnable: it truncates every table first, then
 * rebuilds the same company from a fixed random seed.
 *
 *   npm run db:seed
 *
 * Seeds the organization, people (with bios and promotion history),
 * sign-in accounts and reference data, then each module's history
 * (attendance and leave, recruitment, …) as its own step in this folder.
 */
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../../src/generated/prisma/client";
import { DEMO_PASSWORD } from "../../src/lib/env";
import { minutesInDay, todayIn } from "../../src/lib/tz";
import { RELATIONSHIPS } from "./names";
import { seedAnnouncements } from "./announcements";
import { seedDocuments } from "./documents";
import { seedHiring } from "./hiring";
import { seedLifecycle } from "./lifecycle";
import { seedPayroll } from "./payroll";
import { seedPerformance } from "./performance";
import { seedProfiles } from "./profiles";
import { seedTime } from "./time";
import { buildPeople, byHierarchy, DEPARTMENTS, type PersonSeed } from "./people";
import { HOLIDAYS, LEAVE_TYPES } from "./reference";
import { createRng } from "./rng";

const SEED = 20261029;
const DOMAIN = "northwindgrove.in";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function day(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function truncateAll() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  const started = Date.now();
  const rng = createRng(SEED);
  faker.seed(SEED);
  const today = new Date();

  await truncateAll();

  // ── Company, schedule, locations ──────────────────────────────────────
  await db.company.create({
    data: {
      name: "Northwind Grove",
      legalName: "Northwind Grove Technologies Pvt. Ltd.",
      fiscalYearStartMonth: 4,
      defaultTimezone: "Asia/Kolkata",
      currency: "INR",
      weekStartsOn: 1,
    },
  });

  const schedule = await db.workSchedule.create({
    data: {
      name: "General shift",
      startTime: "09:30",
      endTime: "18:30",
      graceMinutes: 15,
      workDays: [1, 2, 3, 4, 5],
    },
  });

  const office = await db.location.create({
    data: { name: "Bengaluru office", city: "Bengaluru", workScheduleId: schedule.id },
  });
  const remote = await db.location.create({
    data: {
      name: "Remote (India)",
      city: "Across India",
      isRemote: true,
      workScheduleId: schedule.id,
    },
  });

  // ── Departments and designations ──────────────────────────────────────
  const deptIds = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const row = await db.department.create({
      data: { name: d.name, code: d.code, colorToken: d.color, description: d.description },
    });
    deptIds.set(d.name, row.id);
  }

  const people = byHierarchy(buildPeople(rng, today));

  const designationIds = new Map<string, string>();
  for (const p of people) {
    const k = `${p.department}::${p.title}`;
    if (designationIds.has(k)) continue;
    const row = await db.designation.create({
      data: { title: p.title, level: p.level, departmentId: deptIds.get(p.department)! },
    });
    designationIds.set(k, row.id);
  }

  // ── Employees, inserted parents first ─────────────────────────────────
  // Codes follow join order, like a real HR system would have issued them.
  const codeOrder = [...people].sort((a, b) => a.joinDate.localeCompare(b.joinDate));
  const codes = new Map(codeOrder.map((p, i) => [p.key, `GRV-${String(i + 1).padStart(4, "0")}`]));

  const usedEmails = new Set<string>();
  const emailFor = (p: PersonSeed) => {
    const base = `${slug(p.firstName)}.${slug(p.lastName)}`;
    let email = `${base}@${DOMAIN}`;
    for (let i = 2; usedEmails.has(email); i++) email = `${base}${i}@${DOMAIN}`;
    usedEmails.add(email);
    return email;
  };

  const employeeIds = new Map<string, string>();
  for (const p of people) {
    const birthYear = 2026 - (22 + Math.min(p.level, 7) * 3 + rng.int(0, 8));
    const row = await db.employee.create({
      data: {
        employeeCode: codes.get(p.key)!,
        firstName: p.firstName,
        lastName: p.lastName,
        workEmail: emailFor(p),
        personalEmail: `${slug(p.firstName)}.${slug(p.lastName)}${rng.int(1, 99)}@${rng.pick(["gmail.com", "outlook.com", "proton.me"])}`,
        phone: `+91 ${rng.pick(["98", "97", "99", "90", "88", "70"])}${rng.int(100, 999)} ${rng.int(10000, 99999)}`,
        dateOfBirth: day(
          `${birthYear}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`,
        ),
        skills: p.skills,
        address: { area: p.area ?? null, city: p.city, state: p.state, country: "India" },
        employmentType: p.employmentType,
        status: p.status,
        joinDate: day(p.joinDate),
        exitDate: p.exitDate ? day(p.exitDate) : null,
        exitReason: p.exitReason ?? null,
        departmentId: deptIds.get(p.department)!,
        designationId: designationIds.get(`${p.department}::${p.title}`)!,
        locationId: p.remote ? remote.id : office.id,
        managerId: p.managerKey ? employeeIds.get(p.managerKey)! : null,
      },
    });
    employeeIds.set(p.key, row.id);
  }

  // Department heads: the most senior person in each department.
  for (const d of DEPARTMENTS) {
    const head = people
      .filter((p) => p.department === d.name && p.status !== "EXITED")
      .sort((a, b) => b.level - a.level || a.joinDate.localeCompare(b.joinDate))[0];
    if (head)
      await db.department.update({
        where: { id: deptIds.get(d.name)! },
        data: { headId: employeeIds.get(head.key)! },
      });
  }

  // ── Emergency contacts ────────────────────────────────────────────────
  await db.emergencyContact.createMany({
    data: people.flatMap((p) => {
      const count = rng.chance(0.4) ? 2 : 1;
      return Array.from({ length: count }, (_, i) => {
        const relationship = rng.pick(RELATIONSHIPS);
        const surname = ["Mother", "Father", "Sibling"].includes(relationship)
          ? p.lastName
          : faker.person.lastName();
        return {
          employeeId: employeeIds.get(p.key)!,
          name: `${faker.person.firstName()} ${surname}`,
          relationship,
          phone: `+91 ${rng.pick(["98", "94", "99", "96"])}${rng.int(100, 999)} ${rng.int(10000, 99999)}`,
          isPrimary: i === 0,
        };
      });
    }),
  });

  // ── Sign-in accounts ──────────────────────────────────────────────────
  // Everyone still employed can sign in with the shared demo password.
  const hash = await hashPassword(DEMO_PASSWORD);
  const managerKeys = new Set(people.filter((p) => p.status !== "EXITED").map((p) => p.managerKey));
  const employees = await db.employee.findMany({ where: { status: { not: "EXITED" } } });
  const keyById = new Map([...employeeIds].map(([k, id]) => [id, k]));
  const personByKey = new Map(people.map((p) => [p.key, p]));

  for (const e of employees) {
    const p = personByKey.get(keyById.get(e.id)!)!;
    const role =
      p.demo ?? (p.hrRole ? "HR_MANAGER" : managerKeys.has(p.key) ? "TEAM_MANAGER" : "EMPLOYEE");
    const userId = `usr_${e.employeeCode.toLowerCase().replace("-", "")}`;
    await db.user.create({
      data: {
        id: userId,
        name: `${e.firstName} ${e.lastName}`,
        email: e.workEmail,
        emailVerified: true,
        role,
        employeeId: e.id,
        isDemo: !!p.demo,
        accounts: {
          create: {
            id: `acc_${userId.slice(4)}`,
            accountId: userId,
            providerId: "credential",
            password: hash,
          },
        },
      },
    });
  }

  // ── Profile texture and promotion history ─────────────────────────────
  const hrUser = await db.user.findFirst({
    where: { role: "HR_MANAGER", isDemo: true },
    select: { id: true },
  });
  const current = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: {
      id: true,
      firstName: true,
      joinDate: true,
      designationId: true,
      departmentId: true,
      department: { select: { name: true } },
      designation: { select: { level: true } },
    },
  });
  const promotions = await seedProfiles(
    db,
    rng,
    current.map((e) => ({
      id: e.id,
      firstName: e.firstName,
      joinDate: e.joinDate,
      designationId: e.designationId,
      departmentId: e.departmentId,
      departmentName: e.department.name,
      level: e.designation.level,
    })),
    hrUser?.id ?? null,
    new Set(people.filter((p) => !/^[gx]\d/.test(p.key)).map((p) => employeeIds.get(p.key)!)),
  );

  // ── Leave types and holidays ──────────────────────────────────────────
  for (const t of LEAVE_TYPES) {
    const { policy, ...type } = t;
    await db.leaveType.create({
      data: {
        ...type,
        policies: {
          create: {
            annualQuota: policy.annualQuota,
            accrual: policy.accrual,
            carryForwardMax: policy.carryForwardMax,
            proRataOnJoin: "proRataOnJoin" in policy ? policy.proRataOnJoin : true,
          },
        },
      },
    });
  }

  await db.holiday.createMany({
    data: HOLIDAYS.map((h) => ({
      name: h.name,
      date: day(h.date),
      locationId: h.officeOnly ? office.id : null,
      isOptional: !!h.optional,
    })),
  });

  // ── Attendance, leave and corrections history ─────────────────────────
  const types = await db.leaveType.findMany({ include: { policies: true } });
  const allEmployees = await db.employee.findMany({
    select: {
      id: true,
      joinDate: true,
      managerId: true,
      locationId: true,
      employmentType: true,
      status: true,
    },
  });
  const time = await seedTime(db, rng, {
    today: todayIn(),
    nowMinutes: minutesInDay(new Date()),
    people: allEmployees.map((e) => {
      const key = keyById.get(e.id)!;
      return {
        id: e.id,
        key,
        joinDate: e.joinDate.toISOString().slice(0, 10),
        managerId: e.managerId,
        locationId: e.locationId,
        employmentType: e.employmentType,
        status: e.status,
        isDemo: !!personByKey.get(key)?.demo,
      };
    }),
    leaveTypes: types.map((t) => {
      const p = t.policies[0]!;
      return {
        id: t.id,
        code: t.code,
        approvalLevels: t.approvalLevels,
        allowHalfDay: t.allowHalfDay,
        minNoticeDays: t.minNoticeDays,
        policy: {
          annualQuota: Number(p.annualQuota),
          accrual: p.accrual,
          carryForwardMax: Number(p.carryForwardMax),
          proRataOnJoin: p.proRataOnJoin,
        },
      };
    }),
    holidays: HOLIDAYS.map((h) => ({
      day: h.date,
      locationId: h.officeOnly ? office.id : null,
      optional: !!h.optional,
    })),
    schedule: {
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      graceMinutes: schedule.graceMinutes,
      workDays: schedule.workDays,
    },
    hrApproverId: employeeIds.get("hr")!,
  });

  // ── Recruitment history ───────────────────────────────────────────────
  const hiring = await seedHiring(db, rng, { today: todayIn(), fakerSeed: SEED + 1 });

  // ── Onboarding and offboarding ────────────────────────────────────────
  const lifecycle = await seedLifecycle(db, rng, {
    today: todayIn(),
    ids: employeeIds,
    hrId: employeeIds.get("hr")!,
  });

  // ── Goals and review cycles ───────────────────────────────────────────
  const performance = await seedPerformance(db, rng, {
    today: todayIn(),
    demoIds: {
      arjun: employeeIds.get("arjun")!,
      priya: employeeIds.get("em_web")!,
      fatima: employeeIds.get("fatima")!,
      hr: employeeIds.get("hr")!,
    },
  });

  // ── Documents ─────────────────────────────────────────────────────────
  const documents = await seedDocuments(db, rng, {
    today: todayIn(),
    hrId: employeeIds.get("hr")!,
    arjunId: employeeIds.get("arjun")!,
    priyaId: employeeIds.get("em_web")!,
  });

  // ── Announcements ─────────────────────────────────────────────────────
  const announcements = await seedAnnouncements(db, rng, {
    today: todayIn(),
    ids: employeeIds,
    arjunId: employeeIds.get("arjun")!,
  });

  // ── Simulated payroll ─────────────────────────────────────────────────
  const payroll = await seedPayroll(db, rng, {
    today: todayIn(),
    preparerId: employeeIds.get("hr")!,
    finalizerId: employeeIds.get("coo")!,
  });

  const [employeeCount, userCount] = await Promise.all([db.employee.count(), db.user.count()]);
  const demo = await db.user.findMany({
    where: { isDemo: true },
    select: { email: true, role: true },
  });
  console.log(`Seeded Northwind Grove in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `  ${employeeCount} employees, ${userCount} sign-in accounts, ${DEPARTMENTS.length} departments`,
  );
  console.log(`  ${promotions} past promotions in the audit log`);
  console.log(
    `  ${time.attendance} attendance days, ${time.leaveRequests} leave requests, ${time.corrections} corrections (${time.pending} pending)`,
  );
  console.log(
    `  ${hiring.jobs} job postings (${hiring.open} open), ${hiring.candidates} candidates behind ${hiring.hires} hires`,
  );
  console.log(
    `  ${lifecycle.checklists} onboarding/offboarding checklists (${lifecycle.running} running); ${lifecycle.newJoiner} joins ${lifecycle.joinDate}`,
  );
  console.log(
    `  ${payroll.structures} salary structures, ${payroll.runs} finalized pay runs (${payroll.payslips} payslips)`,
  );
  console.log(
    `  ${performance.goals} goals (${performance.keyResults} key results, ${performance.checkIns} check-ins), ${performance.reviews} reviews`,
  );
  console.log(
    `  ${documents.policies} policies and ${documents.files - documents.policies} personal documents`,
  );
  console.log(
    `  ${announcements.published} announcements (${announcements.reads} reads, ${announcements.reactions} reactions)`,
  );
  console.log(`  Demo logins (password "${DEMO_PASSWORD}"):`);
  for (const d of demo) console.log(`    ${d.role.padEnd(13)} ${d.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
