<div align="center">

<img src="src/app/icon.svg" alt="Grove logo: a white sprout on a green rounded square" width="96" height="96">

# Grove

**A human resource management system people actually enjoy using.**<br>
Calm, warm and quietly delightful, built with production-grade engineering.

<a href="https://grove-hrms.vercel.app"><img src="https://img.shields.io/badge/Open_the_live_demo-1F5A47?style=for-the-badge&logo=vercel&logoColor=white" alt="Open the live demo" height="44"></a>
&nbsp;
<a href="https://grove-hrms.vercel.app/design"><img src="https://img.shields.io/badge/See_the_design_system-3D3A36?style=for-the-badge&logo=storybook&logoColor=white" alt="See the design system" height="44"></a>

One click signs you in as any of four roles. No account, no setup.<br>
Live at **<https://grove-hrms.vercel.app>**

[![CI status](https://github.com/rrushikeshp89/grove-hrms/actions/workflows/ci.yml/badge.svg)](https://github.com/rrushikeshp89/grove-hrms/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://grove-hrms.vercel.app)
![369 unit tests](https://img.shields.io/badge/unit_tests-369-2E7D32?style=flat-square)
![420 end-to-end tests](https://img.shields.io/badge/end--to--end_tests-420-15803D?style=flat-square&logo=playwright&logoColor=white)
![0 serious axe violations](https://img.shields.io/badge/axe-0_serious_violations-7B2D8E?style=flat-square)
![Lighthouse accessibility 100](https://img.shields.io/badge/Lighthouse_a11y-100-C2410C?style=flat-square&logo=lighthouse&logoColor=white)

[Try it](#try-it-in-two-minutes) ·
[See it move](#see-it-move) ·
[What it does](#what-it-does) ·
[Built with](#built-with) ·
[How it works](#how-it-fits-together) ·
[Quality](#quality) ·
[Run it](#run-it-yourself) ·
[Docs](#project-docs)

</div>

---

## At a glance

Grove is a complete HR platform for a company of about 100 people: everything from clocking in to running payroll, with a separate experience for employees, managers, HR and admins.

|                    |                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **For employees**  | Clock in, request leave, see payslips, goals and company news                            |
| **For managers**   | Approve requests, see the team's day, run hiring and reviews                             |
| **For HR**         | People records, payroll runs, onboarding, analytics, CSV import and export               |
| **For admins**     | Audit log of every change, company settings, roles                                       |
| **Under the hood** | 45 database tables, 23 feature modules, 4 roles with scoped permissions                  |
| **Proof it works** | 369 unit tests, 420 browser tests, every screen scanned for accessibility in both themes |

---

## Try it in two minutes

[Open Grove](https://grove-hrms.vercel.app) and sign in with one click as any of four people at **Northwind Grove**, a fictional Bengaluru company of about 100 employees. The password for every account is `grove-demo-2026`, and the account menu switches between the demo roles without signing out.

| Sign in as       | Who                                   | Email                               | Try this                                                                                                                                                |
| ---------------- | ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employee**     | Arjun Mehta, Senior Frontend Engineer | `arjun.mehta@northwindgrove.in`     | Press and hold **Clock in** on Home. Press `n` then `l` to start a leave request. Press `/` and search "remote".                                        |
| **Team manager** | Priya Raman, Engineering Manager      | `priya.raman@northwindgrove.in`     | Open **Approvals**, approve one request and decline another. Drag a candidate across the **Hiring** board.                                              |
| **HR manager**   | Rahul Deshpande, Head of People       | `rahul.deshpande@northwindgrove.in` | Open **Analytics** and switch a chart to its table view. Import people from a CSV at `/people/import`.                                                  |
| **Super admin**  | Aditya Banerjee, COO                  | `aditya.banerjee@northwindgrove.in` | Open the **Audit log** and expand a row to see before and after. Open **Payroll** and see the four-eyes rule: whoever prepares a run can't finalize it. |

> [!TIP]
> Everything is also reachable from the keyboard. Press `?` anywhere to see every shortcut, or `Ctrl K` (`Cmd K` on a Mac) for the command palette.

### See it move

**Search everything, then start a leave request from the keyboard.** The palette searches people, jobs, policies and more, and `n` then `l` opens the form from anywhere.

<img src="docs/screenshots/demo-search.gif" alt="Pressing Ctrl K, typing remote, seeing a policy with the match highlighted, then pressing n and l to open the leave request sheet" width="840">

**Drag a candidate through hiring.** The same move works with a keyboard or the card's menu, and screen readers hear each step.

<img src="docs/screenshots/demo-hiring.gif" alt="Dragging a candidate card from one column of the hiring board to the Interview column, where it stays" width="840">

**Every chart is also a table.** Change the period, flip a chart to its numbers, and switch the theme.

<img src="docs/screenshots/demo-analytics.gif" alt="Switching analytics to six months, turning the headcount chart into a table and back, then changing to the dark theme" width="840">

### Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/people.png" alt="People directory in grid view, with search and filters for department, location, status and contract type"></td>
    <td width="50%"><img src="docs/screenshots/org-chart.png" alt="Org chart built from manager relationships, with pan, zoom and collapsible teams"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/analytics.png" alt="Analytics page: headcount over twelve months and arrivals and departures, with period and department filters and an Export PDF button"></td>
    <td><img src="docs/screenshots/hiring.png" alt="Hiring board with candidates in Applied, Screening, Interview, Offer and Hired columns"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/payroll.png" alt="Simulated payroll runs, one per month, with status and totals"></td>
    <td><img src="docs/screenshots/audit.png" alt="Audit log listing every change with who made it and when"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/command-palette.png" alt="Command palette searching for the word remote and finding an announcement and a policy, with the match highlighted"></td>
    <td><img src="docs/screenshots/home-dark.png" alt="The same home screen in the dark theme"></td>
  </tr>
</table>

---

## What it does

Open any group to see what is built. Everything below is implemented and covered by tests.

<details>
<summary><strong>People and organization</strong>: directory, profiles, org chart, departments</summary>
<br>

- **Directory.** Search by name, title, team, skill or employee ID. Filter by department, location, status and contract. Grid and table views, 24 cards at a time, and the whole view lives in the URL so it can be shared or bookmarked. HR can add employees, with codes issued in sequence.
- **Profiles.** Overview, Team, Personal and Activity tabs, each section edited in place. You edit your own bio, skills and private details. Your managers can read your private details but not change them. HR edits job details and can't create a reporting loop. A change history is built from the audit log.
- **Org chart.** Built from manager relationships, with pan, zoom, collapsible teams, search, and keyboard navigation that follows the standard tree pattern.
- **Departments.** Heads, headcount and job titles, with create, edit and delete for HR. Nothing still in use can be deleted.

</details>

<details>
<summary><strong>Time</strong>: attendance, leave, holidays, approvals</summary>
<br>

- **Attendance.** Press-and-hold clock in and out with a live timer. A monthly timesheet marks late arrivals, early departures, half days, leave and holidays. Corrections for the last 30 days go to your manager. Managers see who is in, late or on leave today.
- **Leave.** Balances come from each policy's accrual plus a ledger of carry-forward, usage, holds and adjustments. The apply sheet shows holidays and teammates' leave on the date picker, supports half days, and explains notice, balance and overlap rules before you send. Approval goes to your manager, then to HR when the type or length requires it. A team calendar shows leave by month and department.
- **Holidays.** The company calendar for each location and year.
- **Approvals inbox.** Leave and corrections in one place with team clashes shown on each request. Approve one or many with optimistic updates. Declining asks for a short note.

</details>

<details>
<summary><strong>Talent</strong>: hiring, onboarding, performance</summary>
<br>

- **Hiring.** Roles with a mini pipeline on each card, and a kanban board from Applied to Hired. Drag with a mouse or touch, or move with the keyboard (Space to lift, arrows to choose a stage, Space to drop). Screen readers hear every move announced. Candidates have a journey timeline, notes and 1 to 5 ratings. **Convert to employee** creates the record, marks the candidate hired and starts onboarding.
- **Onboarding and offboarding.** Checklists from editable templates, with tasks for the people team, IT, the manager and the person, each due a set number of days from the first or last day. Finishing the last task activates the new joiner.
- **Performance.** Goals with key results and check-ins, aligned from company to team to personal. Review cycles run in steps: self reviews, manager reviews, calibration, closed. Results reach people only when the cycle closes. Peer feedback is shown without names.

</details>

<details>
<summary><strong>Pay, documents and news</strong>: payroll, documents, announcements</summary>
<br>

- **Payroll (clearly marked simulated everywhere).** Salary structures from a standard CTC split. A monthly run goes draft, review, finalize, with loss of pay, proration and whole-rupee rounding worked out from attendance and leave. The review screen compares with last month and flags big swings. **Four eyes:** whoever prepares a run can't finalize it. Payslips are designed for the screen and as PDFs.
- **Documents.** A private folder per person plus a company policy library. Uploads are checked for type, size and content. Managers get no back door into someone's folder.
- **Announcements.** A rich-text editor for the people team. Post to everyone or to chosen teams and locations, pin, or keep a draft. Reactions, unread markers, and read counts for publishers.

</details>

<details>
<summary><strong>Insights</strong>: analytics, exports</summary>
<br>

- **Analytics.** Headcount, arrivals and departures, attrition with exit reasons, time off, an attendance heatmap, and the hiring funnel with time to hire. Filter by period and department. Every chart has a table view, and the whole report exports as a PDF.
- **Exports.** CSV for the directory (with your filters), a leave year, a pay run and the audit log. Cells that could run as spreadsheet formulas are neutralized.

</details>

<details>
<summary><strong>Platform</strong>: notifications, audit, settings, import, search</summary>
<br>

- **Notifications.** A bell with an unread count and a full page. Approvals, decisions, payslips, announcements, review steps and onboarding tasks notify the right people in the same transaction as the change. A nightly job reminds people about requests that have waited, tasks that are due, and review deadlines.
- **Audit log.** Every change, with who, what and when. Filter, search, open a row for before and after, and export.
- **Settings.** Account, appearance and sessions for everyone. The people team edits leave types and holidays. A super admin edits company details and changes roles, never their own, the last super admin's, or a demo account's.
- **Import.** Add up to 200 people from a CSV, with every row checked in a preview (departments, titles, managers, duplicate emails, dates) before anything is saved.
- **Search.** One palette searches people, jobs, candidates, announcements, policies and goals, shows why each result matched, and returns only what you could open yourself.

</details>

<details>
<summary><strong>Keyboard shortcuts</strong>: every one, in one table</summary>
<br>

| Keys                             | What it does                                                  |
| -------------------------------- | ------------------------------------------------------------- |
| `Ctrl K` / `Cmd K`               | Open the command palette                                      |
| `/`                              | Search everything                                             |
| `?`                              | Show all shortcuts                                            |
| `g` then `h` `a` `l` `i`         | Go to Home, Attendance, Leave, Approvals                      |
| `g` then `e` `o` `d`             | Go to People, Org chart, Departments                          |
| `g` then `j` `b` `g`             | Go to Hiring, Onboarding, Performance                         |
| `g` then `y` `m` `u` `k`         | Go to Pay, Payroll, Announcements, Documents                  |
| `g` then `n` `x` `r` `z` `s`     | Go to Analytics, Audit log, Roles, Notifications, Settings    |
| `n` then `l` `g` `u` `a` `e` `r` | New leave request, goal, upload, announcement, employee, role |
| `Shift D`                        | Toggle dark mode                                              |
| `Shift C`                        | Toggle compact density                                        |
| `[`                              | Collapse or expand the sidebar                                |

Shortcuts you don't have permission for don't appear.

</details>

<details>
<summary><strong>The "Warm Calm" design system</strong>: tokens, accessibility, motion</summary>
<br>

- Light and dark themes from design tokens, with every text and background pair checked against WCAG AA by a unit test.
- Accessible components styled from scratch on Radix primitives, with a type scale, radii, shadows and density that adapt to compact and comfortable modes.
- Motion explains change: springs for movement, reduced motion respected everywhere, and celebrations only for real milestones.
- Every page has a skeleton shaped like its content, an error state, and an empty state that says what to do next.
- A public showcase of the system lives at `/design`.

</details>

---

## Built with

Every technology in the project, with the version it actually uses. Each ribbon links to that tool's site.

<details open>
<summary><strong>Front end and design</strong></summary>
<br>

[![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript strict](https://img.shields.io/badge/TypeScript_strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS_4-0E7490?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge&logo=radixui&logoColor=white)](https://www.radix-ui.com)
[![Motion 14](https://img.shields.io/badge/Motion_14-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://motion.dev)
[![React Hook Form 7](https://img.shields.io/badge/React_Hook_Form_7-EC5990?style=for-the-badge&logo=reacthookform&logoColor=white)](https://react-hook-form.com)
[![Zod 4](https://img.shields.io/badge/Zod_4-3E67B1?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev)
[![TanStack Table 9](https://img.shields.io/badge/TanStack_Table_9-B91C1C?style=for-the-badge)](https://tanstack.com/table)
[![Recharts 3](https://img.shields.io/badge/Recharts_3-6D28D9?style=for-the-badge)](https://recharts.org)
[![Tiptap 3](https://img.shields.io/badge/Tiptap_3-0F0F0F?style=for-the-badge)](https://tiptap.dev)
[![dnd kit](https://img.shields.io/badge/dnd_kit-1E293B?style=for-the-badge)](https://dndkit.com)
[![cmdk](https://img.shields.io/badge/cmdk-334155?style=for-the-badge)](https://cmdk.paco.me)
[![Lucide icons](https://img.shields.io/badge/Lucide-0F766E?style=for-the-badge&logo=lucide&logoColor=white)](https://lucide.dev)

</details>

<details open>
<summary><strong>Server, data and security</strong></summary>
<br>

[![Server Components and Server Actions](https://img.shields.io/badge/Server_Components_%2B_Actions-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/docs/app/getting-started/server-and-client-components)
[![Cache Components](https://img.shields.io/badge/Cache_Components-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/docs/app/getting-started/caching)
[![Prisma 7](https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Supabase](https://img.shields.io/badge/Supabase-047857?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Better Auth](https://img.shields.io/badge/Better_Auth-111827?style=for-the-badge)](https://www.better-auth.com)
![Role-based access control](https://img.shields.io/badge/RBAC-scoped_permissions-1F5A47?style=for-the-badge)
![Audit logging](https://img.shields.io/badge/Audit_log-every_change-1F5A47?style=for-the-badge)
[![React PDF](https://img.shields.io/badge/React_PDF-payslips_%26_reports-B91C1C?style=for-the-badge)](https://react-pdf.org)
[![PapaParse](https://img.shields.io/badge/PapaParse-CSV_import_%26_export-475569?style=for-the-badge)](https://www.papaparse.com)
[![date-fns](https://img.shields.io/badge/date--fns-4-770C56?style=for-the-badge&logo=date-fns&logoColor=white)](https://date-fns.org)

</details>

<details open>
<summary><strong>Quality and accessibility</strong></summary>
<br>

[![Vitest 4](https://img.shields.io/badge/Vitest_4-4D7C0F?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)
[![Playwright](https://img.shields.io/badge/Playwright-15803D?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![axe-core](https://img.shields.io/badge/axe--core-7B2D8E?style=for-the-badge)](https://github.com/dequelabs/axe-core)
[![WCAG 2.1 AA](https://img.shields.io/badge/WCAG_2.1_AA-1D4ED8?style=for-the-badge)](https://www.w3.org/TR/WCAG21/)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-C2410C?style=for-the-badge&logo=lighthouse&logoColor=white)](https://developer.chrome.com/docs/lighthouse)
[![ESLint 9](https://img.shields.io/badge/ESLint_9-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org)
[![Prettier 3](https://img.shields.io/badge/Prettier_3-B45309?style=for-the-badge&logo=prettier&logoColor=white)](https://prettier.io)

</details>

<details open>
<summary><strong>Delivery</strong></summary>
<br>

[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![Node.js 22](https://img.shields.io/badge/Node.js_22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com)

</details>

---

## How it fits together

```mermaid
flowchart LR
  Browser["Browser<br/>React 19, Motion, cmdk"]
  subgraph Vercel["Vercel (Next.js 16, Cache Components)"]
    Proxy["proxy.ts<br/>cookie redirects only"]
    Pages["Server components<br/>pages and queries"]
    Actions["Server actions<br/>createAction: auth, Zod, RBAC, audit"]
    Routes["Route handlers<br/>CSV, PDF, files, cron, health"]
  end
  subgraph Supabase
    PG[("Postgres<br/>Prisma 7")]
    Files[("Storage<br/>private bucket")]
  end
  CI["GitHub Actions<br/>CI and nightly reseed"]

  Browser --> Proxy --> Pages
  Browser --> Actions
  Browser --> Routes
  Pages --> PG
  Actions --> PG
  Routes --> PG
  Routes --> Files
  Actions --> Files
  CI --> PG
  Cron["Vercel Cron<br/>09:00 IST"] --> Routes
```

<details>
<summary><strong>What happens when someone changes data</strong> (sequence diagram)</summary>
<br>

```mermaid
sequenceDiagram
  actor U as Person
  participant UI as Form (React Hook Form)
  participant A as Server action (createAction)
  participant DB as Postgres (one transaction)

  U->>UI: Submit
  UI->>A: Raw input
  A->>A: Authenticate the session
  A->>A: Validate with Zod
  A->>A: Check role, scope and record
  A->>DB: Write the change
  A->>DB: Write audit entries
  A->>DB: Write notifications
  DB-->>A: Commit, or roll back all three
  A-->>UI: ActionResult (data or a plain-language error)
  UI-->>U: Updated screen and a toast
```

</details>

**Design decisions worth knowing**

- **The database has one door.** Every table has row level security on with no policies, so Supabase's public API can't reach any of it. Only the server connects, and it checks permissions in code.
- **Every check is on the server.** The proxy only redirects people with no cookie. Pages, actions and route handlers each call `requireUser` or `requirePermission`, and queries filter by what the person may see.
- **One way to change data.** `createAction` runs the same steps every time, and the change, its audit entries and its notifications commit together or not at all.
- **Business rules are plain functions** (leave balances, payroll, review visibility, CSV checks, reminders) with their own unit tests, shared by the UI previews and the server.
- **Files** go through a three-call storage interface: local disk in development, a private Supabase bucket in production.

<details>
<summary><strong>Skills on show, and where to find them in the code</strong></summary>
<br>

| Skill                                                     | Where to look                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Authorization design (roles, scopes, record-level checks) | [`src/lib/rbac.ts`](src/lib/rbac.ts), [`src/server/authz.ts`](src/server/authz.ts)                               |
| A single safe path for mutations                          | [`src/server/action.ts`](src/server/action.ts)                                                                   |
| Relational data modeling (45 tables)                      | [`prisma/schema.prisma`](prisma/schema.prisma)                                                                   |
| Deterministic seed data                                   | [`prisma/seed/`](prisma/seed)                                                                                    |
| Pure, tested business logic                               | `src/features/*/logic/` (leave, payroll, performance, attendance)                                                |
| Time zones and calendar-day correctness                   | [`src/lib/tz.ts`](src/lib/tz.ts)                                                                                 |
| Secure file handling and storage adapters                 | [`src/lib/storage.ts`](src/lib/storage.ts), [`src/features/documents/`](src/features/documents)                  |
| Safe CSV import and export                                | [`src/lib/csv.ts`](src/lib/csv.ts), [`src/features/people/import-logic.ts`](src/features/people/import-logic.ts) |
| Rich text without trusting stored HTML                    | [`src/features/announcements/logic/content.ts`](src/features/announcements/logic/content.ts)                     |
| Design tokens and contrast testing                        | [`src/app/globals.css`](src/app/globals.css), [`src/styles/tokens.test.ts`](src/styles/tokens.test.ts)           |
| Accessible interactive components                         | [`src/components/ui/`](src/components/ui)                                                                        |
| End-to-end and accessibility testing                      | [`tests/e2e/`](tests/e2e), including [`sweep.spec.ts`](tests/e2e/sweep.spec.ts)                                  |
| CI/CD and scheduled jobs                                  | [`.github/workflows/`](.github/workflows), [`vercel.json`](vercel.json)                                          |

</details>

---

## Quality

<table>
  <tr>
    <th scope="col">Check</th>
    <th scope="col">What it covers</th>
  </tr>
  <tr>
    <td><strong>369 unit tests</strong></td>
    <td>Leave, payroll, review visibility, CSV import and export, search, reminders, storage, permissions and design-token contrast.</td>
  </tr>
  <tr>
    <td><strong>End-to-end suite</strong></td>
    <td>420 tests across every flow on desktop and a Pixel 7, with axe accessibility scans in both themes.</td>
  </tr>
  <tr>
    <td><strong>Every-screen sweep</strong></td>
    <td>Opens each screen as the role that owns it and fails on console errors, sideways scrolling or serious axe violations. Also checks the skip link, visible focus and focus trapping in dialogs.</td>
  </tr>
  <tr>
    <td><strong>Live checks</strong></td>
    <td>The same sweep runs against the deployed site with <code>npm run test:live</code>, plus HTTPS cookies, PDF rendering in serverless functions, and a real upload, download and delete through the file store.</td>
  </tr>
  <tr>
    <td><strong>Continuous integration</strong></td>
    <td>Typecheck, lint and unit tests, then the full Playwright suite against a real Postgres, on every push.</td>
  </tr>
</table>

<details>
<summary><strong>Lighthouse results</strong> (live site)</summary>
<br>

| Page    | Desktop performance | Mobile performance, simulated slow 4G | Accessibility |
| ------- | ------------------- | ------------------------------------- | ------------- |
| Sign in | 100                 | 85 (78 to 99 across runs)             | 100           |
| Home    | 99                  | 72 (61 to 84 across runs)             | 100           |
| People  | 100                 | 72 (67 to 79 across runs)             | 100           |

Mobile figures are medians from one laptop, which is why they are given as ranges. That profile applies a 4x CPU slowdown and 1.6 Mbps, and desktop clears 90 everywhere. Signed-in pages fall short of 90 on it because they wait for the session and live data, then hydrate a full client app. With real throttling applied rather than simulated, the largest paint lands at about 2.5 to 3 seconds. Moving page headers into the static shell is the next improvement. SEO scores 100 on public pages; private pages are deliberately closed to crawlers.

</details>

---

## Run it yourself

You need **Node.js 22** and a **PostgreSQL 16** database. Supabase works, and so does any local Postgres.

**1. Install**

```bash
git clone https://github.com/rrushikeshp89/grove-hrms.git
cd grove-hrms
npm install
```

**2. Get a database** (pick one)

<details>
<summary><strong>Local Postgres with Docker</strong></summary>
<br>

```bash
docker run --name grove-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=grove -p 5432:5432 -d postgres:16
```

Use `postgresql://postgres:postgres@127.0.0.1:5432/grove` as `DATABASE_URL` in the next step.

</details>

<details>
<summary><strong>Supabase</strong></summary>
<br>

Create a project, then copy the **transaction pooler** string (port 6543) as `DATABASE_URL` and the **direct** string (port 5432) as `DIRECT_URL`. [`docs/DEPLOY.md`](docs/DEPLOY.md) walks through it.

</details>

**3. Configure**

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` and `BETTER_AUTH_SECRET`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**4. Create the tables and the demo company**

```bash
npm run db:migrate
npm run db:seed
```

> [!WARNING]
> `db:seed` empties every table before rebuilding Northwind Grove. Only run it against a demo database.

**5. Start**

```bash
npm run dev
```

Open <http://localhost:3000> and pick a role.

<details>
<summary><strong>All npm scripts</strong></summary>
<br>

| Command                                           | What it does                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                                     | Dev server on port 3000                                          |
| `npm run build` / `npm start`                     | Production build and server                                      |
| `npm run check`                                   | Typecheck, lint and unit tests. Must be clean before a commit    |
| `npm run typecheck` / `npm run lint` / `npm test` | Each of those on its own                                         |
| `npm run test:e2e`                                | Playwright on desktop and mobile, with axe scans in both themes  |
| `npm run test:live`                               | Smoke tests and the every-screen sweep against the deployed site |
| `npm run format`                                  | Prettier, with the Tailwind class sorter                         |
| `npm run db:migrate`                              | Apply migrations                                                 |
| `npm run db:seed`                                 | Truncate and rebuild the demo company                            |
| `npm run db:reset`                                | Migrate, then seed                                               |
| `npm run db:studio`                               | Browse the data in Prisma Studio                                 |

End-to-end tests need `DATABASE_URL`. Before each run they reseed the database, and they only do that for a local database unless you set `E2E_ALLOW_RESEED=1`.

</details>

<details>
<summary><strong>Project layout</strong></summary>
<br>

```text
src/app/                 routes; route-local pieces in _components/
src/components/ui/       design-system primitives (Radix + cva, styled from scratch)
src/components/shell/    app shell, sidebar, command palette, shortcut sheet
src/components/charts/   themed Recharts wrappers, each with a table view
src/features/<module>/   components, queries.ts, actions.ts, schemas.ts, logic/
src/server/              session, createAction, authorization helpers
src/config/              navigation and quick actions, filtered by permission
src/lib/                 pure helpers: rbac, tz, csv, storage, format, shortcuts
prisma/                  schema, migrations and the deterministic seed
tests/e2e/               Playwright specs, including the every-screen sweep
docs/                    plan, deployment guide and screenshots
```

</details>

---

## Honest limits

- **Payroll is simulated.** It says so on every screen. Don't run real payroll through it.
- **Email isn't sent.** Password reset messages are queued in a database table, and in demo mode the reset screen reads the link back. A real deployment needs a mail provider.
- **The demo is shared.** Everyone uses the same four accounts and the same company, so you may see other visitors' changes. It resets every night at 02:00 IST.
- **Signed-in pages are slower on weak phones.** See the Lighthouse results above.
- **Demo mode is on by default.** Set `DEMO_MODE=false` for anything real, which turns off one-click sign-in.

## Project docs

- [`docs/PLAN.md`](docs/PLAN.md): architecture, database schema, design spec and the phase-by-phase build notes
- [`docs/DEPLOY.md`](docs/DEPLOY.md): Supabase, Vercel and GitHub Actions setup
- [`CLAUDE.md`](CLAUDE.md): conventions and design rules for working in the codebase
- [`.env.example`](.env.example): every environment variable, explained

<div align="center">

<sub>Grove is a portfolio project by <a href="https://github.com/rrushikeshp89">rrushikeshp89</a>. Northwind Grove and everyone in it are fictional.</sub>

</div>
