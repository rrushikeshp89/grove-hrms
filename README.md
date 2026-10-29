# Grove

A human resource management system people actually enjoy using: calm, warm, and quietly delightful. It's built as a portfolio project with production-grade engineering.

> **Status: Phase 1 of 9, foundation and design system.** The full feature set (directory, attendance, leave, payroll, performance, recruitment, analytics) is planned in [`docs/PLAN.md`](docs/PLAN.md). This README grows with each phase.

## What's here today

- **"Warm Calm" design system.** Light and dark themes are both first-class, built on design tokens that are checked against WCAG AA by an automated test. Typography is Fraunces, Geist and Geist Mono. There are density modes (comfortable and compact) and spring-based motion that respects reduced-motion settings.
- **Component library.** Accessible Radix primitives styled from scratch: forms wired to Zod, a date-range picker that marks holidays and teammates who are away, a combobox, a TanStack data table (sorting, selection, bulk actions, keyboard navigation), charts with a table fallback, a tactile hold-to-confirm clock-in button, empty, error and skeleton states, and milestone confetti.
- **App shell.** Collapsible sidebar, mobile navigation sheet, a ⌘K/Ctrl+K command palette, `g`-sequence navigation shortcuts, and a `?` cheat sheet. All of them run off one action registry.
- **Living showcase.** `/design` (Foundations, Components, Data & charts, Patterns).

## Tech stack

Next.js 16 (App Router, Cache Components) · TypeScript (strict) · Tailwind CSS v4 · Radix UI · Motion · TanStack Table · React Hook Form + Zod · Recharts · Vitest · Playwright + axe. Coming in Phase 2: Prisma + Supabase Postgres and Better Auth.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # typecheck + lint + unit tests
npm run test:e2e     # Playwright, desktop + mobile, axe in both themes
```

## Project docs

- [`docs/PLAN.md`](docs/PLAN.md): architecture, database schema, design spec, phase plan
- [`CLAUDE.md`](CLAUDE.md): conventions and design rules
