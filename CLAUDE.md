@AGENTS.md

# Grove HRMS

Portfolio-grade HRMS. Brief: `PROJECT_BRIEF.md`. Approved plan, schema and design spec: `docs/PLAN.md`.
We build one phase at a time; each phase ends with typecheck + lint + tests green, a short review summary, and a commit. Don't start the next phase until the user says so.

## Commands

- `npm run dev`: dev server on :3000 (`.claude/launch.json` → `grove-dev`)
- `npm run check`: typecheck + lint + unit tests. Must be clean before any commit.
- `npm run typecheck`: runs `next typegen` first (needed for `LayoutProps`/`PageProps`)
- `npm test`: Vitest, `src/**/*.test.ts`, node environment
- `npm run test:e2e`: Playwright (builds and serves on :3100; desktop + Pixel 7 projects, axe scans in both themes). Needs `DATABASE_URL`; global setup reseeds a local DB first.
- `npm run db:migrate` (deploy migrations), `npm run db:seed` (truncate + rebuild Northwind Grove), `npm run db:generate`
- New migration: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` against a dev DB (or `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` when no shadow DB is available)
- `npm run format`: Prettier with the Tailwind class sorter

## Stack notes (versions matter)

- Next.js 16.4 with **Cache Components** and Partial Prefetching on. Anything reading the clock, cookies, headers or other request data must sit behind `<Suspense>` or render after mount (`useMounted`). Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- `proxy.ts` (not `middleware.ts`) is the Next 16 name, and it's for cheap redirects only. Authorization lives on the server in actions and queries.
- Server → client props must be serializable. Never pass Lucide icon components across that boundary; resolve them on the client (see `AppShell`, which takes a role and builds the navigation itself).
- TanStack Table **v9**: register features with `tableFeatures({...})`, use `useTable` and `table.FlexRender`. Use `columnsFor<T>()` from `components/ui/data-table.tsx`.
- Zod 4 (`{ error: "…" }` messages), React Hook Form with `@hookform/resolvers/zod`.
- react-day-picker v10, Recharts 3, Motion (`motion/react`), radix-ui (unified package), cmdk.
- Theme, density and sidebar state live on `<html>`, set before paint by `preferencesScript` (`lib/preferences.ts`). Read them with `useTheme()` and `useHtmlData()`. There is no next-themes.
- Prisma 7 (`prisma-client` generator → `src/generated/prisma`, gitignored, regenerated on `postinstall`), config in `prisma.config.ts` (loads `.env.local`). The client in `lib/db.ts` is lazy, so builds don't need credentials.
- Better Auth 1.7 (`lib/auth.ts`): email/password, DB sessions with a 5-minute cookie cache, `nextCookies()` last. Sign-up is disabled; accounts come from the seed or HR. Demo accounts can't change or reset passwords (before-hook).
- `forbidden()` is enabled via `experimental.authInterrupts`; `app/forbidden.tsx` renders it.
- npm only (pnpm isn't installed). Ask before adding any major dependency not listed in `docs/PLAN.md` §5.

## Structure

```
src/app/                 routes; route-local pieces in _components/
src/components/ui/       design-system primitives (Radix + cva, styled from scratch)
src/components/shell/    AppShell, Sidebar, CommandPalette, ShortcutSheet, PageHeader
src/components/charts/   themed Recharts wrappers with a table fallback (ChartCard)
src/features/<module>/   components/, queries.ts (server-only reads), actions.ts ("use server"), schemas.ts (shared Zod), logic/
src/server/              session.ts (DAL: getCurrentUser/requireUser/requirePermission), action.ts (createAction),
                         authz.ts (managerChain, reportIds, assertCan, visibleEmployeeIds)
src/proxy.ts             optimistic cookie redirects only; never the security boundary
prisma/                  schema.prisma, migrations/, seed/ (deterministic; named demo people in seed/people.ts)
src/config/navigation.ts nav groups; only routes that exist; navigationFor(role)
src/lib/                 pure helpers (format, shortcuts, command-filter, preferences, motion)
src/styles/tokens.test.ts WCAG contrast + token-discipline guard
tests/e2e/               Playwright
```

## Design rules ("Warm Calm")

- **Tokens only.** Colors come from CSS variables in `globals.css`, mapped to Tailwind names: `bg-bg`, `bg-surface`, `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `text-ink-subtle`, `border-hairline`, `border-border-input`, `bg-accent`, `bg-highlight`, `success|warning|danger|info` (+ `-subtle`). Tailwind's default palette is removed. ESLint bans hex literals in components, features and app, and a unit test bans `bg-[#…]`-style arbitrary colors.
- When adding a token, add it to both `:root` and `.dark`, and add any text/background pair you use to `tokens.test.ts`.
- The type scale is closed: `text-display-xl | display | title | heading | body | small | caption`. Use `font-display-soft` (Fraunces) for titles and hero numbers, Geist for UI, and `font-mono` for IDs and timestamps. Add `num` (tabular numerals) to every number people compare.
- Radii: `rounded-control` (8) for inputs/buttons, `rounded-card` (12), `rounded-overlay` (14), `rounded-full` for tags and avatars. Shadows: `shadow-xs|sm|md|lg|press` only.
- Use `h-row` / `px-cell` / `gap-list` (density-aware) in tables and lists. The `compact:` variant targets compact density.
- Icons are Lucide at stroke 1.75. No emoji in UI.
- Motion: springs from `lib/motion.ts` (`snappy`, `gentle`) and 150–250ms. Every animation explains a change. `MotionConfig reducedMotion="user"` is global; count-ups and rings render final values when reduced motion is on.
- Amber (`highlight`) and `celebrate()` are for real milestones only.
- Every page needs a loading skeleton shaped like its content, an `error.tsx` built on `ErrorState`, and specific `EmptyState` copy with one next action. No spinners for page loads, no "coming soon", no Lorem ipsum.
- Accessibility:
  - Wrap form controls in `<Field>`. Controls rendered through RHF `<Controller>` pick up the label/ARIA wiring via `useFieldProps`.
  - Avatars are decorative unless you pass `labelled`.
  - Charts go inside `ChartCard`, which provides the table view.
  - axe must report zero serious or critical violations.

## Patterns

- **Auth and data access.** Pages/components that read the session must sit inside `<Suspense>` (Cache Components). Use `requireUser()` / `requirePermission(p)` from `server/session.ts`; never trust the client. Gate a whole page once, inside one Suspense child, before streaming role-specific content.
- **Mutations.** Always `createAction({ schema, permission?, handler })`: authenticate → Zod → role check → transaction with queued `audit(...)` entries. Inside handlers use `assertCan(user, permission, ownerEmployeeId)` for record-level (team/own) checks, and throw `ActionError` for user-facing failures. Return values are `ActionResult<T>`.
- **Inside a handler, query only through `tx`.** That includes the authz helpers: pass `tx` as their last argument (`targetFor(id, tx)`, `reportIds(id, tx)`). Querying through the global `db` inside a transaction needs a second pool connection, and it deadlocks when `DATABASE_POOL_MAX=1`.
- **Server-to-client props.** Pass elements, never functions. In-place editing uses `EditableSection` with `form={<SomeForm />}`, and the form gets its close callback from `useEditableDone()`.
- **Forms.** Submit raw input with `form.getValues()` and let the server action run the authoritative Zod parse. Type the form as `useForm<Input, unknown, z.output<typeof schema>>`. Use `useWatch` rather than `form.watch` (React Compiler).
- **Profiles.** `features/people/access.ts` (`profileAccess`) decides what's visible and editable, and both the actions and the UI use it. Private fields and history are only fetched when `seePrivate` is true.
- **RBAC.** Permissions and scopes live in `lib/rbac.ts` (`can`, `GRANTS`). Navigation items declare a `permission`, not role lists. Filter queries in SQL via `visibleEmployeeIds`.
- **Time and dates.** Logic works on ISO date strings (`ISODate`) and the company zone `COMPANY_TZ` (Asia/Kolkata). Helpers are in `lib/tz.ts`: `todayIn`, `dbDate`/`isoFromDbDate` for `@db.Date` columns, `instantAt`, `clockTime`. Never compare `Date` objects for calendar days.
- **Leave and attendance logic.** Business rules are pure functions in `features/leave/logic/` and `features/attendance/logic/`, unit-tested and shared by client previews and server actions. Balance = `accrued(policy)` plus the ledger; never write ACCRUAL rows. Leave and corrections go through `features/requests/engine.ts` (`createRequest`, `applyDecision`), which owns the ledger side effects of a decision.
- **Seed.** Add each module's history as its own step under `prisma/seed/`. Keep it deterministic (`createRng(SEED)`); everyone uses `DEMO_PASSWORD`.

- Register palette commands and shortcuts with `useRegisterActions([...])` (memoized). One registry feeds the palette, the key handler and the `?` sheet. Single-key shortcuts are ignored while typing; set `global: true` only for modifier chords.
- In e2e tests, use `pressUntil` for keyboard shortcuts, because they only attach after hydration.
- Money is stored in integer minor units (paise) and formatted with `formatMoney`. Dates use date-fns with the `en-IN` locale.

## Environment

- Supabase Postgres. The runtime uses the pooled URL (:6543, `DATABASE_URL`) and migrations/seed use the direct URL (:5432, `DIRECT_URL`), both in `.env.local` (never committed; see `.env.example`).
- Without Supabase credentials, a local stand-in works: run PGlite's socket server (`@electric-sql/pglite-socket`, installed outside the repo) on :54329 and set `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable` plus `DATABASE_POOL_MAX=1` (PGlite interleaves concurrent connections).
- GitHub remote: `rrushikeshp89/grove-hrms` (private).
