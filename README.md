# Grove

A human resource management system people actually enjoy using: calm, warm, and quietly delightful. It's built as a portfolio project with production-grade engineering.

> **Status: Phase 3 of 9: people, departments and the org chart.** The full feature set (directory, attendance, leave, payroll, performance, recruitment, analytics) is planned in [`docs/PLAN.md`](docs/PLAN.md). This README grows with each phase.

## Try it

Sign in at `/login` with one click as any of four people at Northwind Grove, a fictional Bengaluru company with about 100 employees:

| Role         | Person                                       | Email                               |
| ------------ | -------------------------------------------- | ----------------------------------- |
| Employee     | Arjun Mehta, Senior Frontend Engineer        | `arjun.mehta@northwindgrove.in`     |
| Team manager | Priya Raman, Engineering Manager (8 reports) | `priya.raman@northwindgrove.in`     |
| HR manager   | Rahul Deshpande, Head of People              | `rahul.deshpande@northwindgrove.in` |
| Super admin  | Aditya Banerjee, COO                         | `aditya.banerjee@northwindgrove.in` |

The password is `grove-demo-2026`, and every other employee uses it too. Once you're signed in, the account menu switches between the demo roles.

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
- **Command palette people search.** Ctrl+K finds any colleague by name or ID.
- **Role-aware home**
  - Your profile, team and upcoming holidays.
  - Company-wide numbers for HR and admins.
- **"Warm Calm" design system**
  - Light and dark themes, with design tokens checked against WCAG AA by a test.
  - Accessible components styled from scratch.
  - A ⌘K/Ctrl+K command palette and keyboard shortcuts.
  - A public showcase at `/design`.
- **Data model.** The full schema for every planned module (45 tables), plus a seed that builds the company deterministically.

## Tech stack

Next.js 16 (App Router, Cache Components), TypeScript (strict), Tailwind CSS v4, Radix UI, Motion, TanStack Table, React Hook Form with Zod, Recharts, Prisma 7 on Supabase Postgres, Better Auth, Vitest, and Playwright with axe.

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
- [`CLAUDE.md`](CLAUDE.md): conventions and design rules
