@AGENTS.md

# Grove HRMS

Portfolio-grade HRMS. Brief: `PROJECT_BRIEF.md`. Approved plan, schema and design spec: `docs/PLAN.md`.
We build one phase at a time; each phase ends with typecheck + lint + tests green, a short review summary, and a commit. Don't start the next phase until the user says so.

## Commands

- `npm run dev`: dev server on :3000 (`.claude/launch.json` → `grove-dev`)
- `npm run check`: typecheck + lint + unit tests. Must be clean before any commit.
- `npm run typecheck`: runs `next typegen` first (needed for `LayoutProps`/`PageProps`)
- `npm test`: Vitest, `src/**/*.test.ts`, node environment
- `npm run test:e2e`: Playwright (builds and serves on :3100; desktop + Pixel 7 projects, axe scans in both themes)
- `npm run format`: Prettier with the Tailwind class sorter

## Stack notes (versions matter)

- Next.js 16.4 with **Cache Components** and Partial Prefetching on. Anything reading the clock, cookies, headers or other request data must sit behind `<Suspense>` or render after mount (`useMounted`). Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- `proxy.ts` (not `middleware.ts`) is the Next 16 name, and it's for cheap redirects only. Authorization lives on the server in actions and queries.
- Server → client props must be serializable. Never pass Lucide icon components across that boundary; resolve them on the client (see `AppShell`, which takes a role and builds the navigation itself).
- TanStack Table **v9**: register features with `tableFeatures({...})`, use `useTable` and `table.FlexRender`. Use `columnsFor<T>()` from `components/ui/data-table.tsx`.
- Zod 4 (`{ error: "…" }` messages), React Hook Form with `@hookform/resolvers/zod`.
- react-day-picker v10, Recharts 3, Motion (`motion/react`), radix-ui (unified package), cmdk.
- Theme, density and sidebar state live on `<html>`, set before paint by `preferencesScript` (`lib/preferences.ts`). Read them with `useTheme()` and `useHtmlData()`. There is no next-themes.
- npm only (pnpm isn't installed). Ask before adding any major dependency not listed in `docs/PLAN.md` §5.

## Structure

```
src/app/                 routes; route-local pieces in _components/
src/components/ui/       design-system primitives (Radix + cva, styled from scratch)
src/components/shell/    AppShell, Sidebar, CommandPalette, ShortcutSheet, PageHeader
src/components/charts/   themed Recharts wrappers with a table fallback (ChartCard)
src/features/<module>/   (Phase 2+) components/, queries.ts, actions.ts, schemas.ts, logic/
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

- Register palette commands and shortcuts with `useRegisterActions([...])` (memoized). One registry feeds the palette, the key handler and the `?` sheet. Single-key shortcuts are ignored while typing; set `global: true` only for modifier chords.
- In e2e tests, use `pressUntil` for keyboard shortcuts, because they only attach after hydration.
- Money is stored in integer minor units (paise) and formatted with `formatMoney`. Dates use date-fns with the `en-IN` locale.

## Environment

- Supabase Postgres (Phase 2+). The runtime uses the pooled URL (:6543) and migrations use the direct URL (:5432), both in `.env.local` (never committed; see `.env.example`).
- GitHub remote: `rrushikeshp89/grove-hrms` (private).
