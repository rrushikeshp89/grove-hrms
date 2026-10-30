# Grove

A human resource management system people actually enjoy using: calm, warm, and quietly delightful. It's built as a portfolio project with production-grade engineering.

> **Status: complete (Phase 9 of 9).** Every module in [`docs/PLAN.md`](docs/PLAN.md) is built and tested. It runs locally against any Postgres, and [`docs/DEPLOY.md`](docs/DEPLOY.md) covers putting it on Supabase and Vercel.

## Try it

Sign in at `/login` with one click as any of four people at Northwind Grove, a fictional Bengaluru company with about 100 employees:

| Role         | Person                                       | Email                               |
| ------------ | -------------------------------------------- | ----------------------------------- |
| Employee     | Arjun Mehta, Senior Frontend Engineer        | `arjun.mehta@northwindgrove.in`     |
| Team manager | Priya Raman, Engineering Manager (8 reports) | `priya.raman@northwindgrove.in`     |
| HR manager   | Rahul Deshpande, Head of People              | `rahul.deshpande@northwindgrove.in` |
| Super admin  | Aditya Banerjee, COO                         | `aditya.banerjee@northwindgrove.in` |

The password is `grove-demo-2026`, and every other employee uses it too. Once you're signed in, the account menu switches between the demo roles.

![Home for an employee: clock in, leave balances, announcements](docs/screenshots/home.png)

<table>
  <tr>
    <td><img src="docs/screenshots/people.png" alt="People directory"></td>
    <td><img src="docs/screenshots/org-chart.png" alt="Org chart"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/analytics.png" alt="Analytics with a table view for every chart"></td>
    <td><img src="docs/screenshots/hiring.png" alt="Hiring board with drag and drop"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/payroll.png" alt="Simulated payroll runs"></td>
    <td><img src="docs/screenshots/audit.png" alt="Audit log"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/command-palette.png" alt="Command palette searching across the app"></td>
    <td><img src="docs/screenshots/home-dark.png" alt="The same home in the dark theme"></td>
  </tr>
</table>

## What's here today

- **Sign-in and accounts**
  - Email and password sign-in with database sessions (Better Auth).
  - Password reset by emailed link. In demo mode, the reset screen shows the link it would have sent.
  - An active-sessions list where you can sign out other devices.
  - Theme and density preferences that follow your account between devices.
- **Role-based access control**
  - Four roles. Each permission has a scope: your own records, your team, or everyone.
  - The same rules are enforced on the server for every page and action, and decide what the UI shows.
  - Admins and HR can see the full access matrix.
- **People directory**
  - Search by name, title, team, skill or employee ID, with filters for department, location, status and employment type.
  - Grid and table views. The whole view lives in the URL, so it can be shared or bookmarked.
  - HR can add employees. Codes are issued in sequence, and new people appear in the org chart straight away.
- **Profiles**
  - Overview, Team, Personal and Activity tabs, with each section edited in place.
  - What you can see and change depends on who you are. You edit your own bio, skills and private details. Your managers can read your private details but not change them. HR edits job details and can't create a reporting loop.
  - Emergency contacts, and a change history built from the audit log ("Backend Engineer → Senior Backend Engineer").
- **Org chart**
  - Built from manager relationships, with pan, zoom and collapsible teams.
  - Keyboard navigation follows the standard tree pattern, and a search box finds anyone.
  - Clicking a person opens a profile preview. Every profile links to its place in the chart.
- **Departments**
  - Heads, headcount and job titles for each department, with create, edit and delete for HR.
  - Nothing that is still in use can be deleted.
- **Attendance**
  - Press-and-hold clock in and out, with a live timer. It won't let you clock in on a day of full leave.
  - A monthly timesheet that marks late arrivals, early departures, half days, leave and holidays, with month-by-month history.
  - Corrections for the last 30 days go to your manager for approval, and an approved correction updates the timesheet.
  - Managers see who's in, late, on leave or not in yet across their team today.
- **Leave**
  - Balances come from each policy's accrual (up front or monthly, pro-rated from your joining date), plus a ledger of carry-forward, usage, holds and adjustments.
  - The apply sheet shows holidays and teammates' leave on the range picker, and supports half days. It previews the day count and explains notice, balance and overlap rules before you send.
  - Approval goes to your manager first. HR approves second when the leave type needs it or the request runs past 5 days.
  - A small celebration when your leave is approved. You can cancel pending or future leave and get the days back.
  - A team calendar by month and department.
- **Holidays.** The company calendar for each location and year, with the next holiday highlighted.
- **Approvals inbox**
  - Leave and attendance corrections in one place, with team clashes and holidays shown on each request.
  - Approve one or select many, with optimistic updates. Declining asks for a short note.
  - HR and admins can switch to every open request. There's also a list of recent decisions.
- **Command palette people search.** Ctrl+K finds any colleague by name or ID.
- **Role-tailored home**
  - A time-aware greeting with a one-line summary of your day: clocked in or not, requests waiting on you, birthdays.
  - Everyone gets the clock, leave balances with what's coming up, this month's attendance, Moments (birthdays, work anniversaries, new joiners) and holidays. On a phone the clock comes first.
  - Managers also see requests waiting on them and their team's day at a glance.
  - HR and admins also get a company pulse: headcount over the year, attrition, joiners, notice periods, open roles and who's in today.
  - Your own work anniversary gets a small celebration, once.
- **Analytics** (HR and admins)
  - Headcount over time, arrivals and departures, department and contract mix.
  - Attrition: annualized rate, rate per period, exit reasons and typical tenure at exit.
  - Time off by type and per person by department. Attendance as a weekday × arrival-time heatmap with on-time trends.
  - Hiring funnel with stage conversion, time to hire, open roles and a source breakdown.
  - Filter by period (presets or custom dates) and department. Filters live in the URL, charts switch between weekly and monthly, and every chart has a table view.
- **Hiring**
  - Roles by status with a mini pipeline on each card. Create and edit roles; a role closes itself once every opening is filled.
  - A kanban pipeline: Applied, Screening, Interview, Offer, Hired. Drag with a mouse or touch, move with the keyboard (Space to lift, arrows to choose a stage, Space to drop), or use each card's menu. Screen readers hear every move announced.
  - Candidate profiles with details, a journey timeline, notes and 1–5 ratings that roll up into an average.
  - Passing on someone asks for a reason, and they can be brought back to where they got to.
  - **Convert to employee** on an offer: creates the employee record (next sequential ID, role's title, department and location), marks the candidate hired, and starts onboarding.
  - A hiring manager can run their own role's pipeline; only the people team edits roles and completes hires.
- **Onboarding and offboarding**
  - Checklists built from editable templates, with tasks for the people team, IT, the manager and the person themselves, each with a due date counted from the first or last day.
  - Tick tasks off with instant feedback. You can tick your own tasks, and the people team can tick anything. Finishing the last one activates the new joiner, with a celebration.
  - Starting offboarding moves someone to notice with their last day and reason, and hands out the tasks.
  - Open tasks show on your Home. Adding an employee by hand starts onboarding too.
- **Self-service home** also shows your latest payslip, the newest announcements (unread marked) and any reviews waiting for you.
- **Performance**
  - Goals with key results and check-ins. Progress comes from the key results, and a status is suggested by comparing it with the time that's passed. Finishing a goal gets a celebration.
  - Goals line up: company goals, team goals and personal goals can each support the one above.
  - Review cycles run in steps: self reviews, manager reviews, calibration, then closed. The people team moves a cycle along; results reach people only when it closes.
  - Self, manager and peer reviews are short forms with a draft, a rating and a clear list of what's missing before you can submit.
  - Managers and the people team can ask colleagues for peer feedback. Whoever receives it sees it without names.
- **Payroll** (clearly marked as simulated everywhere)
  - Salary structures from a standard split of CTC. Revisions apply from a date and never touch a month that's been paid.
  - A monthly run: draft, review, finalize. Payslips are worked out from attendance, approved leave and holidays, with loss of pay, proration and whole-rupee rounding.
  - The review screen compares with last month: who joined, who left, and the biggest changes in net pay, with big swings flagged.
  - Four eyes: whoever prepares a run can't finalize it.
  - Designed payslips on screen and as PDFs, available to each person once the run is final.
- **Documents**
  - A private folder for each person, and a company policy library everyone can read. Uploads are checked for type, size and content before they're stored.
  - Managers don't get a back door into someone's folder: only the owner and the people team can open private files.
- **Announcements**
  - A rich-text editor for the people team, with headings, lists, quotes and links. Post to everyone or to chosen teams and locations, pin the important ones, or keep a draft.
  - Reactions, unread markers that clear as you read, and for publishers a count of who has read each post and who hasn't.
- **Notifications**
  - A bell with an unread count and a page for everything, with read and unread. Approvals, decisions, payslips, announcements, review steps, peer feedback and onboarding tasks each notify the right people, in the same transaction as the change that caused them.
  - The bell checks again every minute while the tab is visible.
- **Audit log** (super admin)
  - Every change, with who, what and when. Filter by person, area, record or dates, search it, open a row to see exactly what changed before and after, and export what you're looking at.
- **Settings**
  - Account, appearance and sessions for everyone. The people team also edits leave types and holidays; a super admin edits company details and working hours and changes roles.
  - Role changes can't target yourself, the last super admin or a demo account, and each one is audited.
- **Import and export**
  - Add people from a CSV: pick a file, see every row checked in a preview (departments, titles, managers, duplicate emails, dates), then import the valid ones. Up to 200 rows.
  - Download the directory (for the filters you have on), a leave year, a pay run, or the audit log as CSV, and the analytics page as a PDF report. CSV cells that could run as spreadsheet formulas are neutralized.
- **Search and quick actions**
  - The command palette searches people, jobs, candidates, announcements, policies and goals, and shows why each result matched. It only returns what you could open yourself.
  - `n` then `l`, `g`, `u`, `a`, `e` or `r` starts a leave request, goal, upload, announcement, employee or new role from anywhere. `/` opens search and `?` lists every shortcut.
- **"Warm Calm" design system**
  - Light and dark themes, with design tokens checked against WCAG AA by a test.
  - Accessible components styled from scratch.
  - A ⌘K/Ctrl+K command palette and keyboard shortcuts.
  - A public showcase at `/design`.
- **Data model.** The full schema for every planned module (45 tables), plus a seed that builds the company deterministically.

## Tech stack

Next.js 16 (App Router, Cache Components), TypeScript (strict), Tailwind CSS v4, Radix UI, Motion, TanStack Table, React Hook Form with Zod, Recharts, Prisma 7 on Supabase Postgres, Better Auth, Vitest, and Playwright with axe.

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

- **Every check is on the server.** The proxy only redirects people with no cookie. Pages, actions and route handlers each call `requireUser` / `requirePermission`, and queries filter by what the person may see (`visibleEmployeeIds`).
- **One way to change data.** `createAction` authenticates, validates with Zod, checks the role, then runs a transaction that writes the change, its audit entries and its notifications together.
- **Business rules are plain functions** (leave balances, payroll, review visibility, CSV import checks) with their own unit tests, shared by the UI previews and the server.
- **Files** go through a three-call storage interface: local disk in development, a private Supabase bucket in production.

Deploying it yourself is covered in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Quality

- **Tests.** About 360 unit tests cover the business rules (leave, payroll, review visibility, CSV import and export, search, reminders, storage). The Playwright suite runs every flow on desktop and a Pixel 7, and a sweep opens **every screen as the role that owns it**, in both themes, checking for console errors, sideways scrolling and axe violations. It also exercises keyboard paths: skip link, visible focus, and focus trapped in dialogs.
- **Accessibility.** axe reports no serious or critical violations anywhere. Lighthouse accessibility is 98 to 100 on the key pages.
- **Lighthouse** (production build, local database), performance / accessibility / best practices / SEO:

  | Page      | Desktop              | Mobile, simulated slow 4G |
  | --------- | -------------------- | ------------------------- |
  | Sign in   | 99 / 100 / 100 / 100 | 81 / 100 / 100 / 100      |
  | Home      | 95 / 100 / 100 / 100 | 67 / 100 / 100 / 100      |
  | People    | 98 / 100 / 100 / 100 | 65 / 100 / 100 / 100      |
  | Analytics | 97 / 100 / 100 / 100 | 53 / 100 / 100 / 100      |

  Desktop clears 90 everywhere. The mobile column is Lighthouse's most pessimistic profile (4x CPU slowdown, 1.6 Mbps). Measured without throttling, sign in scores 100 with a 1.1 s largest paint. The remaining mobile cost is JavaScript weight, and every page here also waits on a local single-connection database, so treat those numbers as a floor. Trimming the Motion bundle is the next lever.

## Getting started

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase connection strings and `BETTER_AUTH_SECRET`.

3. Create the tables.

   ```bash
   npm run db:migrate
   ```

4. Build the demo company. This truncates all tables first.

   ```bash
   npm run db:seed
   ```

5. Start the dev server at http://localhost:3000.

   ```bash
   npm run dev
   ```

## Testing

```bash
npm run check        # typecheck + lint + unit tests
npm run test:e2e     # Playwright on desktop and mobile, with axe checks in both themes
```

End-to-end tests need `DATABASE_URL` set. Before each run they reseed the database, which they only do for a local database unless you set `E2E_ALLOW_RESEED=1`. With a local database server you can run:

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/grove" npm run test:e2e
```

## Project docs

- [`docs/PLAN.md`](docs/PLAN.md): architecture, database schema, design spec, phase plan
- [`docs/DEPLOY.md`](docs/DEPLOY.md): Supabase, Vercel and GitHub Actions setup
- [`CLAUDE.md`](CLAUDE.md): conventions and design rules
