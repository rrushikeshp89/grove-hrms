# Grove HRMS: Build Plan

> Status: **approved 2026-10-29** with the decisions in §6. Phases 1–5 complete.

Contents

1. Architecture overview
2. Database schema
3. Design system spec ("Warm Calm")
4. Phased build plan
5. Dependencies that need your OK
6. Open decisions

---

## 1. Architecture overview

### 1.1 Shape of the system

A single Next.js 16 App Router app deployed to Vercel, with Postgres on Supabase. I'm not using a monorepo: one deployable unit keeps it simple and nothing here needs a separate service.

```
Browser
  │  RSC payloads, server actions, small client islands
  ▼
Next.js 16 (Vercel)
  ├─ proxy.ts                 cheap redirects only (no session = go to /login). Never the security boundary.
  ├─ app/(auth)/*             login, forgot / reset password
  ├─ app/(app)/*              authenticated product, role-aware shell
  ├─ app/design               living design-system showcase
  ├─ app/api/auth/[...all]    Better Auth handler
  ├─ app/api/*                route handlers only where a URL is needed (PDF payslips, CSV export, file download)
  │
  ├─ features/<module>/       all module code: queries, actions, schemas, logic, components
  ├─ server/                  authz guard, audit writer, notification writer, action wrapper
  └─ lib/                     db client, auth config, rbac, dates, money, formatting
        │
        ▼
  Prisma 7 (driver adapter: pg) ──► PostgreSQL on Supabase (pooled connection at runtime, direct connection for migrations)
  Vercel Blob ──► employee documents and policy files (local-disk adapter in dev)
```

### 1.2 Folder structure (by feature)

```
src/
  app/
    (auth)/login, forgot-password, reset-password
    (app)/layout.tsx               shell: sidebar, top bar, command palette, providers
    (app)/home                     role-tailored home
    (app)/people, people/[id]      directory and profiles
    (app)/org                      org chart
    (app)/departments
    (app)/attendance, leave, holidays, approvals
    (app)/payroll, performance, recruitment, onboarding
    (app)/documents, announcements, analytics
    (app)/notifications, audit, settings
    design/                        component showcase (public, no auth)
    api/...
  features/
    leave/
      components/                  LeaveApplySheet, BalanceRing, TeamCalendar…
      queries.ts                   server-only reads, already scoped by permission
      actions.ts                   server actions (mutations)
      schemas.ts                   Zod schemas shared by client forms and server actions
      logic/                       pure business logic, unit tested (balance.ts, working-days.ts)
    attendance/ payroll/ employees/ … (same shape)
  components/
    ui/                            design-system primitives (customized shadcn source)
    shell/                         Sidebar, TopBar, CommandPalette, ShortcutSheet
    charts/                        themed Recharts wrappers
  server/
    action.ts                      createAction({ schema, permission, handler })
    authz.ts                       requireUser(), requirePermission(), scoped where-clauses
    audit.ts, notify.ts
  lib/
    db.ts, auth.ts, rbac.ts, dates.ts, money.ts, format.ts
prisma/
  schema.prisma, migrations/, seed/ (generators per module, fixed faker seed)
tests/
  e2e/                             Playwright
```

### 1.3 Request lifecycle

**Reads.** Server Components call `features/*/queries.ts`. Each query takes the session user and applies a **scope filter** derived from RBAC: an Employee sees self, a Team Manager sees self plus direct and indirect reports, HR and Admin see all. Data is filtered in SQL, so it never leaks into a payload and then gets hidden.

**Writes.** Every mutation goes through one wrapper:

```ts
export const approveLeave = createAction({
  schema: approveLeaveSchema, // Zod: same schema the form uses
  permission: "leave.approve", // checked against role + resource scope
  async handler({ input, user, tx }) {
    // runs inside a Prisma transaction
    // ...domain logic from features/leave/logic
    // audit + notifications are written in the same transaction
  },
});
```

The wrapper does: authenticate, then Zod-parse, then authorize (role permission plus resource scope, e.g. "is this request from my report?"), then run the transaction, write the audit entry, revalidate, and return a typed `Result<T>` so forms can show field errors.

**Client state.** The default is Server Components plus server actions with `useOptimistic` for approvals, check-ins and status changes. TanStack Query is used only where client caching earns its place: command palette and global search, the notifications popover (polling), the ATS kanban, and org-chart subtree loading.

### 1.4 Auth and RBAC

- **Better Auth** rather than Auth.js. Auth.js v5 is still in beta, and its credentials provider doesn't support database sessions or a built-in reset flow. Better Auth gives email/password, DB-backed sessions (revocable, listable under "Active sessions" in Settings), password reset, and a Prisma adapter out of the box.
- **Roles:** `SUPER_ADMIN`, `HR_MANAGER`, `TEAM_MANAGER`, `EMPLOYEE`. Roles map to **permissions**, and a permission check also takes a **scope** (`self`, `team`, `all`):

  ```ts
  can(user, "employee.update", { employee }); // pure function, exhaustively unit tested
  ```

  The same `can()` drives server enforcement and UI visibility, so the two can't drift apart.

- **Demo logins:** four one-click buttons on /login call a server action that signs in a seeded demo user. Demo accounts can't change their email or password. A nightly Vercel Cron job reseeds the database so the demo stays clean (Phase 9).
- **Password reset emails** go into an `EmailOutbox` table. In demo mode the reset screen shows "Here's the link we would have emailed" so recruiters can finish the flow. A Resend transport can be added later behind an env var.

### 1.5 Cross-cutting decisions

| Concern              | Decision                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dates and time zones | Instants are stored as UTC `timestamptz`. Calendar dates (leave days, attendance day, holidays) are `@db.Date`. Each Location has an IANA time zone, and "today" for attendance is resolved in the employee's location zone. |
| Money                | Integer minor units (paise / pence / cents) plus a currency code. All payroll math is integer, with rounding rules in one place (`lib/money.ts`).                                                                            |
| Leave balances       | Computed from an append-only **ledger** (accrual, carry-forward, usage, reversal, adjustment), never a mutable counter. Balances are auditable and testable.                                                                 |
| Approvals            | A unified `Request` and `ApprovalStep` model. Leave and regularization (and future types) are 1:1 extensions, so the approvals inbox is one query and bulk approve is one code path.                                         |
| Audit                | Every mutation writes `AuditLog { actor, action, entity, entityId, diff(before/after), ip, at }` in the same transaction.                                                                                                    |
| Activity timelines   | Derived from AuditLog plus domain events, scoped by permission.                                                                                                                                                              |
| Errors               | Each route has `loading.tsx` (content-shaped skeletons), `error.tsx` (explains what happened and offers retry or go back) and designed empty states.                                                                         |
| Performance          | RSC-first, charts and rich text lazy-loaded, `next/font`, image optimization. Target Lighthouse 90+ on /login, /home and /people.                                                                                            |

---

## 2. Database schema

Prisma models, abbreviated: ids are `cuid()`, and every model has `createdAt`/`updatedAt` unless noted. The full `schema.prisma` lands in Phase 2.

### 2.1 Organization and people

```prisma
model Company {            // single tenant, one row
  id, name, legalName, logoUrl, fiscalYearStartMonth Int, defaultTimezone, weekStartsOn Int
}

model Location {
  id, name, city, country, timezone, currency      // e.g. "Bengaluru", "Asia/Kolkata", "INR"
  employees Employee[]; holidays Holiday[]
}

model Department {
  id, name, code @unique, colorToken, description
  headId String? @unique  → Employee
  employees Employee[]; designations Designation[]
}

model Designation {
  id, title, level Int, departmentId? → Department   // "Senior Engineer", level 3
}

model Employee {
  id
  employeeCode   String  @unique        // "GRV-0042", shown in mono
  firstName, lastName, preferredName?, pronouns?
  workEmail      String  @unique
  personalEmail?, phone?, dateOfBirth @db.Date, avatarUrl?
  departmentId → Department; designationId → Designation; locationId → Location
  managerId String? → Employee (self relation "Reports")
  employmentType EmploymentType          // FULL_TIME | PART_TIME | CONTRACT | INTERN
  status         EmployeeStatus          // ONBOARDING | ACTIVE | ON_LEAVE | NOTICE | EXITED
  joinDate @db.Date, exitDate? @db.Date, exitReason?
  bio?, skills String[], address Json?
  @@index([managerId]) @@index([departmentId, status])
}

model EmergencyContact { id, employeeId → Employee, name, relationship, phone, isPrimary }
```

### 2.2 Auth (Better Auth tables, extended)

```prisma
model User {
  id, email @unique, name, emailVerified, image
  role        Role            // SUPER_ADMIN | HR_MANAGER | TEAM_MANAGER | EMPLOYEE
  employeeId  String? @unique → Employee
  isDemo      Boolean @default(false)
  themePref   ThemePref       // SYSTEM | LIGHT | DARK
  densityPref Density         // COMFORTABLE | COMPACT
  sessions Session[]; accounts Account[]
}
model Session      { … Better Auth standard: token, expiresAt, ipAddress, userAgent }
model Account      { … holds the password hash for the credential provider }
model Verification { … reset tokens }
model EmailOutbox  { id, to, subject, html, kind, createdAt }
```

### 2.3 Attendance

```prisma
model WorkSchedule {
  id, name, startTime String /*"09:30"*/, endTime, graceMinutes Int, workDays Int[] /*1..7*/
  locations Location[]       // default schedule per location
}

model AttendanceRecord {
  id, employeeId → Employee, date @db.Date
  clockInAt DateTime?, clockOutAt DateTime?
  status AttendanceStatus    // PRESENT | LATE | HALF_DAY | ABSENT | ON_LEAVE | HOLIDAY | WEEKEND
  workedMinutes Int, lateByMinutes Int, earlyByMinutes Int
  source  ClockSource        // WEB | MOBILE | REGULARIZED | SYSTEM
  @@unique([employeeId, date]) @@index([date])
}
```

### 2.4 Unified requests and approvals

```prisma
model Request {
  id, type RequestType       // LEAVE | REGULARIZATION
  requesterId → Employee
  status RequestStatus       // PENDING | APPROVED | REJECTED | CANCELLED
  currentLevel Int @default(1)
  steps ApprovalStep[]; leave LeaveRequest?; regularization RegularizationRequest?
  @@index([status, type])
}

model ApprovalStep {
  id, requestId → Request, level Int, approverId → Employee
  status StepStatus          // WAITING | PENDING | APPROVED | REJECTED | SKIPPED
  comment?, decidedAt?
  @@unique([requestId, level]) @@index([approverId, status])
}

model LeaveRequest {
  requestId @id → Request, leaveTypeId → LeaveType
  startDate @db.Date, endDate @db.Date
  startHalf HalfDay?, endHalf HalfDay?        // FIRST | SECOND
  days Decimal(4,1)                           // working days, excludes weekends and holidays
  reason, attachmentId? → Document
}

model RegularizationRequest {
  requestId @id → Request, date @db.Date
  requestedClockIn DateTime?, requestedClockOut DateTime?, reason
}
```

Approval chain rule: level 1 is the direct manager. Level 2 is HR, and only applies to leave types with `approvalLevels = 2` or requests longer than N days. Steps are created up front with status WAITING and become PENDING in turn.

### 2.5 Leave and holidays

```prisma
model LeaveType {
  id, name, code @unique, colorToken, isPaid, allowHalfDay, approvalLevels Int
  maxConsecutiveDays Int?, minNoticeDays Int, requiresDocumentAfterDays Int?
  policies LeavePolicy[]
}

model LeavePolicy {
  id, leaveTypeId → LeaveType, locationId? → Location, employmentType? EmploymentType
  annualQuota Decimal(4,1), accrual AccrualMethod   // UPFRONT | MONTHLY
  carryForwardMax Decimal(4,1), proRataOnJoin Boolean
}

model LeaveLedgerEntry {     // append-only
  id, employeeId → Employee, leaveTypeId → LeaveType, year Int
  kind LedgerKind            // ACCRUAL | CARRY_FORWARD | USAGE | PENDING_HOLD | RELEASE | ADJUSTMENT
  days Decimal(4,1)          // signed
  requestId? → Request, note?, createdById?
  @@index([employeeId, leaveTypeId, year])
}

model Holiday { id, name, date @db.Date, locationId? → Location /*null = all locations*/, isOptional }
```

### 2.6 Payroll (simulated)

```prisma
model SalaryStructure {
  id, employeeId → Employee, effectiveFrom @db.Date, currency, annualCtcMinor Int
  components SalaryComponent[]
}
model SalaryComponent {
  id, structureId → SalaryStructure, name, kind ComponentKind   // EARNING | DEDUCTION
  calc CalcMethod            // FIXED | PERCENT_OF_BASIC | PERCENT_OF_GROSS
  amountMinor Int?, percentBps Int?, sortOrder Int
}
model PayrollRun {
  id, year Int, month Int, status RunStatus   // DRAFT | IN_REVIEW | FINALIZED
  createdById, reviewedById?, finalizedAt?
  payslips Payslip[]
  @@unique([year, month])
}
model Payslip {
  id, runId → PayrollRun, employeeId → Employee
  workingDays Int, paidDays Decimal(4,1), lopDays Decimal(4,1)
  grossMinor Int, deductionsMinor Int, netMinor Int, currency
  lines Json                 // frozen snapshot of each component, so the payslip never changes after finalization
  @@unique([runId, employeeId])
}
```

### 2.7 Performance

```prisma
model Goal {
  id, ownerId → Employee, cycleId? → ReviewCycle, parentId? → Goal   // company → team → individual OKRs
  title, description?, status GoalStatus   // ON_TRACK | AT_RISK | OFF_TRACK | DONE
  progress Int /*0..100, derived from key results*/, dueDate
  keyResults KeyResult[]; checkIns GoalCheckIn[]
}
model KeyResult   { id, goalId, title, startValue, targetValue, currentValue, unit }
model GoalCheckIn { id, goalId, authorId, progress Int, note, createdAt }

model ReviewCycle {
  id, name /*"H1 2026"*/, periodStart, periodEnd
  status CycleStatus  // DRAFT | SELF_REVIEW | MANAGER_REVIEW | CALIBRATION | CLOSED
  selfReviewDue, managerReviewDue
}
model Review {
  id, cycleId, revieweeId, reviewerId, kind ReviewKind   // SELF | MANAGER | PEER
  status ReviewStatus, answers Json, overallRating Int?  // 1..5
  submittedAt?
  @@unique([cycleId, revieweeId, reviewerId, kind])
}
model FeedbackRequest { id, cycleId, revieweeId, requestedFromId, status, reviewId? }  // simple 360
```

### 2.8 Recruitment and lifecycle

```prisma
model JobPosting {
  id, title, departmentId, locationId, employmentType, description (rich text JSON)
  status JobStatus   // DRAFT | OPEN | ON_HOLD | CLOSED
  hiringManagerId, openings Int, openedAt, closedAt?
}
model Candidate {
  id, jobId → JobPosting, firstName, lastName, email, phone?, source /*Referral, LinkedIn…*/
  stage Stage        // APPLIED | SCREENING | INTERVIEW | OFFER | HIRED | REJECTED
  stageOrder Float   // ordering within a kanban column
  resumeDocId?, rating Int? (average of notes), hiredEmployeeId? @unique → Employee
  stageHistory CandidateStageEvent[]; notes CandidateNote[]
}
model CandidateStageEvent { id, candidateId, from Stage?, to Stage, byId, at }   // feeds the hiring funnel
model CandidateNote       { id, candidateId, authorId, body, rating Int?, createdAt }

model ChecklistTemplate {
  id, name, kind ChecklistKind   // ONBOARDING | OFFBOARDING
  tasks ChecklistTemplateTask[]
}
model ChecklistTemplateTask {
  id, templateId, title, description?, assigneeRole TaskAssignee   // HR | IT | MANAGER | EMPLOYEE
  dueOffsetDays Int              // relative to join or exit date
}
model Checklist     { id, employeeId, templateId, kind, startDate, completedAt? }
model ChecklistTask { id, checklistId, title, assigneeRole, assigneeId?, dueDate, completedAt?, completedById? }
```

### 2.9 Documents, announcements, notifications, audit

```prisma
model Document {
  id, ownerEmployeeId? → Employee     // null = company policy
  category DocCategory   // ID_PROOF | CONTRACT | PAYSLIP | CERTIFICATE | POLICY | OTHER
  title, fileName, mimeType, sizeBytes Int, storageKey, uploadedById, visibility (PRIVATE | HR_ONLY | COMPANY)
}

model Announcement {
  id, authorId, title, body Json /*Tiptap doc*/, bodyText /*for search*/
  audience Json? /*departments or locations; null = everyone*/
  pinned Boolean, publishedAt?
  reactions AnnouncementReaction[]; reads AnnouncementRead[]
}
model AnnouncementReaction { announcementId, employeeId, kind /*a fixed set rendered as Lucide icons*/ ; @@id([announcementId, employeeId, kind]) }
model AnnouncementRead     { announcementId, employeeId, readAt ; @@id([announcementId, employeeId]) }

model Notification {
  id, recipientId → User, kind NotificationKind, title, body, href, actorId?, readAt?, createdAt
  @@index([recipientId, readAt])
}

model AuditLog {
  id, actorId?, action /*"leave.approve"*/, entityType, entityId
  before Json?, after Json?, ip?, userAgent?, createdAt
  @@index([entityType, entityId]) @@index([actorId, createdAt]) @@index([createdAt])
}
```

### 2.10 Search

Global search runs over employees (name, code, email, designation), announcements, job postings, candidates and documents. It uses Postgres `pg_trgm` indexes with `ILIKE`/similarity and highlights matches with `ts_headline`-style server output. No external search service.

### 2.11 Seed data (deterministic: fixed faker seed, re-runnable)

- **Company:** "Northwind Grove" (fictional), headquartered in Bengaluru. Single currency (INR). Locations: the Bengaluru office plus "Remote (India)", so holidays-by-location has a real difference to show (Karnataka state holidays apply only to the office).
- **People:** about 104 employees across 7 departments (Engineering, Product, Design, People and Culture, Sales, Customer Success, Finance and Ops). Names are diverse and realistic, in a sensible management hierarchy 4–5 levels deep. Joiners are spread over 3 years so headcount actually grows, with about 9 exits in the last 12 months for attrition.
- **12 months of history:** attendance for every working day with realistic late and early patterns, about 650 leave requests (mostly approved, some rejected or pending), 2 closed review cycles plus 1 active, goals with check-ins, 12 finalized payroll runs plus the current month in DRAFT, 6 job postings with about 70 candidates spread across stages, and active onboarding checklists for recent joiners.
- **Demo users:** Super Admin, HR Manager, Team Manager (an Engineering manager with about 8 reports) and Employee (one of those reports). They're chosen so every dashboard has something real to act on: pending approvals, an upcoming birthday, an anniversary this week.

---

## 3. Design system spec: "Warm Calm"

### 3.1 Tokens

All colors are CSS variables on `:root` and `.dark`, mapped into Tailwind v4 via `@theme`. Components only use semantic tokens (`bg-surface`, `text-ink-muted`, `border-hairline`), never hex values or raw palette classes. A lint rule bans raw hex values and `[#…]` arbitrary values in `src/components` and `src/features`.

| Token                   | Light                              | Dark                  | Use                                                |
| ----------------------- | ---------------------------------- | --------------------- | -------------------------------------------------- |
| `--bg`                  | `#FAF8F5`                          | `#171513`             | app canvas                                         |
| `--surface`             | `#FFFFFF`                          | `#1F1C19`             | cards, panels                                      |
| `--surface-sunken`      | `#F3F0EA`                          | `#13110F`             | table headers, wells, inputs at rest               |
| `--surface-hover`       | `#F5F2ED`                          | `#26221E`             | row and item hover                                 |
| `--border` (hairline)   | `#E8E3DB`                          | `#2E2A25`             | default 1px borders                                |
| `--border-strong`       | `#D5CDC1`                          | `#3D3832`             | inputs, dividers that must read                    |
| `--ink`                 | `#1C1917`                          | `#F2EEE8`             | primary text                                       |
| `--ink-muted`           | `#57534E`                          | `#B3AAA0`             | secondary text (≥ 7:1)                             |
| `--ink-subtle`          | `#736B64`                          | `#8E857B`             | captions, placeholders (≥ 4.5:1 on bg and surface) |
| `--accent`              | `#1F5C4A`                          | `#5BAE8F`             | primary actions, focus ring, key highlights        |
| `--accent-hover`        | `#194C3D`                          | `#6DBE9F`             |                                                    |
| `--accent-subtle`       | `#E5EEEA`                          | `#1C2E28`             | selected nav item, subtle accent fills             |
| `--accent-fg`           | `#FFFFFF`                          | `#0E1C17`             | text on accent                                     |
| `--highlight` (amber)   | `#E8A33D`                          | `#F0B45A`             | celebrations, badges, delight only                 |
| `--highlight-subtle`    | `#FBF0DC`                          | `#33280F`             |                                                    |
| `--highlight-ink`       | `#7A4E0E`                          | `#F5C77E`             | text on highlight-subtle                           |
| `--success` / `-subtle` | `#3F7A57` / `#E7F0EA`              | `#6FB28A` / `#1B2A21` | sage, distinct from the brand green                |
| `--warning` / `-subtle` | `#A86A12` / `#F8EEDC`              | `#E0A857` / `#30240F` | ochre                                              |
| `--danger` / `-subtle`  | `#B04A3B` / `#F8E9E5`              | `#E07B6A` / `#341C18` | terracotta                                         |
| `--info` / `-subtle`    | `#3D6585` / `#E6EDF3`              | `#7FA7C7` / `#18232D` | slate blue                                         |
| `--focus-ring`          | accent at 2px plus a 2px bg offset | same                  | every interactive element                          |

**Chart palette** (categorical, in order): forest `#2D6B57`, amber `#E0A145`, terracotta `#C2664F`, slate `#5C7D9B`, sage `#93AE8C`, clay `#A9825E`, and dark-mode lifted variants. Every chart supports a single-series "ink + accent" mode so a chart isn't a rainbow by default. All pairs get contrast-checked in both themes in Phase 1, and I'll tune values if any fail AA.

### 3.2 Typography

- **Display:** Fraunces (variable, with the `SOFT` axis at about 50 and an optical-size axis) for page titles, the greeting, and hero numbers on dashboards.
- **UI and body:** Geist Sans. **Mono:** Geist Mono for employee codes, timestamps and IDs. All fonts load through `next/font` and are self-hosted.
- `font-variant-numeric: tabular-nums` on tables, stats, money and dates (a `.num` utility, applied by default in Table and Stat).

| Step       | Size / line height | Font          | Tracking                                    |
| ---------- | ------------------ | ------------- | ------------------------------------------- |
| display-xl | 44 / 48            | Fraunces 500  | -0.025em                                    |
| display    | 34 / 40            | Fraunces 500  | -0.02em                                     |
| title      | 24 / 32            | Fraunces 500  | -0.015em                                    |
| heading    | 17 / 24            | Geist 600     | -0.01em                                     |
| body       | 14.5 / 22          | Geist 400     | 0                                           |
| small      | 13 / 20            | Geist 400–500 | 0                                           |
| caption    | 12 / 16            | Geist 500     | +0.01em (uppercase eyebrow variant +0.06em) |

### 3.3 Space, shape, depth

- 4px grid. Page gutters are 24/32px, card padding 20–24px, section gaps 32–40px.
- Radius: `--radius-card: 12px`, `--radius-overlay: 14px` (dialogs, sheets, popovers), `--radius-control: 8px` (inputs, buttons), full pill for tags and avatars.
- Shadows are soft and layered at low opacity, tinted with warm ink rather than black:
  - `--shadow-xs: 0 1px 0 rgb(28 25 23 / .04)` for cards at rest, with the hairline border doing most of the work
  - `--shadow-sm: 0 1px 2px rgb(28 25 23 / .06), 0 1px 1px rgb(28 25 23 / .03)` for hover lift
  - `--shadow-md: 0 4px 12px -2px rgb(28 25 23 / .08), 0 2px 4px -2px rgb(28 25 23 / .05)` for popovers and menus
  - `--shadow-lg: 0 16px 40px -8px rgb(28 25 23 / .14), 0 4px 12px -4px rgb(28 25 23 / .06)` for dialogs
  - In dark mode, shadows are near-invisible, so depth comes from a surface step plus a `--border` top highlight.
- Icons: Lucide only, 1.75 stroke, 16px in dense UI and 18–20px in nav. No emoji anywhere in the UI.
- **Density:** `data-density="comfortable|compact"` on `<html>` drives `--row-h` (52 → 40px), `--cell-px`, `--list-gap`. It's a per-user preference stored in the DB, with a quick toggle in table toolbars.

### 3.4 Motion

- Tokens: `--dur-fast 150ms`, `--dur-base 200ms`, `--dur-slow 250ms`. Springs: `snappy {stiffness: 520, damping: 38}` for toggles, menus and press states, and `gentle {stiffness: 260, damping: 30}` for panels and layout.
- `<MotionConfig reducedMotion="user">` at the root. Count-ups, rings and confetti check `useReducedMotion()` and render the final state instantly.
- Every animation needs a reason:
  - Page enter: an 8px rise and fade.
  - Sheets slide from their edge.
  - Lists use `layout` animations when filtering or reordering, so you can see where things went.
  - Approvals collapse out of the inbox.
  - Numbers count up once per mount.
  - Progress rings draw in.
- **Clock-in:** a press-and-hold button (about 600ms) with a filling ring and a spring "settle". On release you see the time stamped in mono and a subtle haptic-style scale pulse. Keyboard users press Enter, with the same visual.
- **Celebration:** a hand-rolled amber confetti burst built with Motion (no extra dependency). It only fires for leave approved (seen by the requester), onboarding completed, and work anniversaries (once per year per user).

### 3.5 Components (each shown on `/design`)

- **Primitives:** Button (primary, secondary, ghost, quiet, destructive; sm/md/lg; loading), IconButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, SegmentedControl, DatePicker and DateRangePicker (with holiday and conflict markers), Slider.
- **Display:** Badge, Tag, StatusPill (one per domain status), Avatar, AvatarStack, Kbd, Tooltip, Card, Stat (the hero-number variant differs from the inline variant), ProgressBar, ProgressRing, Timeline, DescriptionList, and Calendar (month and agenda).
- **Overlays:** Dialog, Sheet (right on desktop, bottom on mobile), Popover, DropdownMenu, ContextMenu, Toast (Sonner, restyled), and the Command Palette.
- **Data:** DataTable built on TanStack Table, with sorting, column visibility, row selection and bulk-action bar, density, sticky header, keyboard row navigation, CSV export hook, and a screen-reader caption plus `aria-sort`.
- **States:** EmptyState (icon composition, specific copy, primary action), ErrorState (what happened, a retry button and a fallback link), and skeletons for each layout: table, profile, dashboard and card grid.
- **Charts:** Area, Bar (stacked and grouped), Donut, Funnel, and Heatmap (attendance patterns). They share an axis, grid and tooltip style, follow theme tokens, and come with an accessible data-table fallback.
- **Shell:** Sidebar (grouped, collapsible to icons, role-filtered), TopBar (page title slot, search trigger, quick clock-in pill, notifications, user menu), mobile bottom navigation for employee self-service, PageHeader, and Breadcrumbs.

### 3.6 Anti-default-shadcn checklist

The goal is to keep shadcn's accessible structure (Radix) while making the look clearly custom:

- Warm tokens and hairline borders instead of zinc, with no `ring-offset` gray halos.
- Fraunces headings.
- Pill tags.
- Restyled focus rings.
- Custom table and toolbar anatomy.
- Bespoke empty states.
- Fewer, larger radii, and no default `shadow` classes.
- Buttons get a tactile 1px inner top highlight and a press translate.

---

## 4. Phased build plan

Every phase ends the same way: typecheck, lint and tests pass with zero errors, I give you a short summary with a "click here to review" list, I make a git commit, and I stop until you say go.

**Phase 1: Foundation and design system**

- Next 16, strict TypeScript, Tailwind v4, shadcn (customized), ESLint and Prettier, Vitest and Playwright wiring, CLAUDE.md, and git init.
- Tokens, both themes (no flash of the wrong theme), fonts, density.
- The shell (sidebar, top bar, mobile nav), the command palette with navigation and a quick-actions registry, and the `?` shortcut sheet.
- A complete `/design` page covering every component in §3.5, in both themes.
- The app pages are shell-only for now and not linked as features. There are no placeholder screens: navigation shows only routes that exist.
- _Review:_ `/design`, the theme toggle, density toggle, Ctrl+K and `?`.

**Phase 2: Data, auth, RBAC**

- Prisma schema and migrations, plus the seed script (full org and history skeleton).
- Better Auth: login, forgot and reset password (demo outbox), sessions list, the four demo buttons, and role-based redirects.
- `can()` with unit tests across the permission matrix, plus the `createAction` wrapper and audit writer.
- Playwright: logging in as each role.
- _Review:_ /login demo buttons, reset flow, and that each role sees different navigation.
- _As built:_ the seed covers the organization (8 departments, 102 current employees and 9 who left in the last year), sign-in accounts, leave types and policies, and 2025–26 holidays. Each later phase adds its module's 12-month history as its own seed step, so that history goes through the same business logic the phase introduces (for example, the leave ledger in Phase 4). Phase 2 also added a role-aware Home, Settings (profile, appearance, password, sessions) and a read-only Roles & access matrix.

**Phase 3: People**

- Directory (grid and table, search, filters, URL-synced state) and rich profiles (tabs: overview, job, team, documents, timeline, emergency contacts), with permission-aware inline editing.
- Departments and designations CRUD.
- Org chart: d3-hierarchy layout, pan, zoom, collapse, keyboard navigation, and node-to-profile preview.

- _As built:_
  - HR can also add employees from the directory.
  - The Documents tab on profiles arrives with the documents module in Phase 7, so there's no empty tab before then.
  - Org chart nodes are HTML positioned with `d3-hierarchy`, with pan and zoom done in CSS. There's no canvas library.
  - The seed adds bios, pronouns and past promotions, so profile timelines have real history.

**Phase 4: Time and approvals**

- Attendance: tactile clock-in, daily and monthly timesheets, late and early indicators, regularization, and the manager's "team today" view.
- Leave: types and policies, ledger balances with accrual, an apply sheet with a range picker showing holidays and team conflicts, multi-level approval, and the team calendar.
- Holidays by location.
- A unified approvals inbox with bulk approve and optimistic UI.
- Units: balance, accrual, working days and approval chain. E2E: apply and approve leave, clock in.

- _As built:_
  - Accrual is computed from the policy (up front or monthly, pro-rated from the joining date) rather than written as ACCRUAL ledger rows. The ledger holds only events: carry-forward, usage, pending holds, releases and adjustments. A balance is accrual plus the ledger total.
  - Pure logic lives in `features/*/logic/` (working days, balance, approval chain, validation, day evaluation, timesheet) and runs on both client and server, so the apply sheet's preview uses the same rules as the server action.
  - Timesheets work out leave and holidays from their own tables. Attendance rows only hold what was clocked.
  - The leave year is the calendar year, and a request can't span two years.
  - Approved regularizations upsert the attendance record with source `REGULARIZED`.
  - Managing holidays (create and edit) moves to Settings in Phase 8. Phase 4 shows them read-only.
  - The seed adds about 12 months of attendance, 2025–26 leave within balances, carry-forward, and pending requests for Priya and Rahul, so the inbox has something in it.

**Phase 5: Dashboards and analytics**

- Role-tailored homes (time-aware greeting, today's info, Moments widget, employee self-service home that works on mobile).
- HR/Admin analytics: headcount, departments, attrition, leave trends, an attendance heatmap and the hiring funnel, with date-range filters and an accessible data fallback.

- _As built:_
  - The seed now includes recruitment history: a closed posting and full stage trail behind every hire of the last ~14 months (the hired candidate links to the employee), the other candidates each role saw, and seven current roles (open, on hold and draft). Phase 6 builds the ATS on this data.
  - Report queries (`features/analytics/queries.ts`) take plain filters, never the session, and are cached with `"use cache"` for a few minutes. The page checks `analytics.read` before calling them.
  - Metrics are pure functions with unit tests: range parsing, week or month buckets, headcount, attrition, the funnel, the arrival grid and leave by period. Ranges up to about three months chart by week.
  - Department figures use each person's current department. Department moves over time aren't tracked yet.
  - Attrition is leavers divided by the average of opening and closing headcount, annualized so ranges compare.
  - Homes are composed by permission rather than role name. Payslip and announcements cards join the self-service home in Phase 7, alongside those modules.

**Phase 6: Recruitment and lifecycle**

- Job postings, a drag-and-drop kanban with keyboard support, candidate profiles with notes and ratings, and "Convert to employee", which kicks off onboarding.
- Onboarding and offboarding templates, task assignment by role, and progress, with a celebration on completion.

**Phase 7: Performance, payroll, documents, announcements**

- Goals and OKRs with check-ins, review cycles, self and manager review forms, and simple 360.
- Payroll: salary structures, a monthly run (Draft, then Review, then Finalize, with a diff vs last month), and designed PDF payslips. Clearly labeled "Simulated payroll".
- Documents: upload, categories, and a policy library.
- Announcements: Tiptap editor, reactions, and read tracking.
- Units: payroll math (proration, LOP, rounding).

**Phase 8: Platform features**

- Notifications center (bell popover plus a page, read and unread).
- Audit log viewer with filters and a diff view.
- Settings (company, leave policies, roles, personal theme and density, sessions).
- CSV import with a validation preview, CSV and PDF export.
- Global search with highlighting, and the full shortcut set.

**Phase 9: Polish and ship**

- A motion and empty-state sweep, an axe plus manual keyboard audit, responsive QA, and Lighthouse passes.
- Complete the Playwright suite.
- Supabase and Vercel deploy, with nightly reseed cron.
- README with screenshots and GIFs, an architecture diagram, and demo credentials.

---

## 5. Dependencies that need your OK

These are in addition to the brief's stack. Approving this plan approves this list. Anything else I'll ask about first.

| Package                                                              | Why                                                                                                                                                                                              | Weight / notes       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| ~~`next-themes`~~                                                    | dropped in Phase 1: it renders a `<script>` inside a client component, which React 19 flags. A 20-line pre-paint script in `lib/preferences.ts` handles theme, density and sidebar state instead | none                 |
| `cmdk`                                                               | command palette (shadcn's Command is built on it)                                                                                                                                                | small                |
| `sonner`                                                             | toasts (shadcn's standard)                                                                                                                                                                       | small                |
| `date-fns` and `@date-fns/tz`                                        | date math, per-location time zones                                                                                                                                                               | tree-shaken          |
| `@dnd-kit/core` and `@dnd-kit/sortable`                              | kanban drag and drop with keyboard and screen-reader support                                                                                                                                     | Phase 6              |
| `d3-hierarchy`                                                       | org chart tree layout (rendering, pan and zoom are custom SVG with Motion, not React Flow)                                                                                                       | small, Phase 3       |
| `@react-pdf/renderer`                                                | designed payslip PDFs and PDF report export, rendered server-side                                                                                                                                | server only, Phase 7 |
| `@tiptap/react` and `@tiptap/starter-kit`                            | rich-text announcements                                                                                                                                                                          | lazy-loaded, Phase 7 |
| `papaparse`                                                          | CSV import parsing and export                                                                                                                                                                    | Phase 8              |
| `@vercel/blob`                                                       | document storage in prod (local-disk adapter in dev)                                                                                                                                             | Phase 7              |
| `@faker-js/faker`                                                    | seed data                                                                                                                                                                                        | dev only             |
| `@prisma/adapter-pg` and `pg`                                        | Prisma 7 driver adapter                                                                                                                                                                          | required by Prisma 7 |
| `prettier` and `prettier-plugin-tailwindcss`, `@axe-core/playwright` | formatting and the accessibility checks in E2E                                                                                                                                                   | dev only             |

Versions: I'll pin current stable releases: Next 16.4, React 19, Tailwind 4.3, Prisma 7.10 (npm's `latest` tag currently points at an 8.0 RC, which I'll avoid), Better Auth 1.7, Zod 4, TanStack Table 9, Recharts 3, Motion, Vitest and Playwright. TypeScript stays on 5.9: that's what `create-next-app` 16.4 and typescript-eslint target, and TS 7 can come later. I'm using npm as the package manager (pnpm isn't installed on this machine).

---

## 6. Decisions (resolved 2026-10-29)

1. **Product name:** Grove.
2. **Demo company:** headquartered in Bengaluru, single currency (INR). Payroll uses simplified, clearly simulated Indian components (Basic, HRA, special allowance, PF, professional tax, TDS estimate).
3. **Database:** Supabase Postgres. Turso was considered, but it's SQLite (libSQL), and the schema relies on Postgres features: arrays, `pg_trgm` search, `timestamptz` and decimals. Prisma connects through Supabase's pooler (port 6543) at runtime and the direct or session connection (port 5432) for migrations. The user creates the Supabase project and puts the URLs in `.env.local` before Phase 2.
   - Pending (Phase 7): use Supabase Storage for documents instead of Vercel Blob, which keeps everything on one vendor. That needs `@supabase/supabase-js` and will be confirmed before then.
4. **Git:** GitHub repo `grove-hrms` under the `rrushikeshp89` account, created private at the end of Phase 1. It can be made public once it's portfolio-ready.
