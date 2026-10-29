# PROJECT BRIEF: [PRODUCT_NAME] — A Human Resource Management System people actually enjoy using

## 0. Who you are and how we'll work
You are a senior full-stack engineer and product designer building a portfolio-grade HRMS for my resume. The bar is: a recruiter or engineer opens the live demo and thinks "this feels like a real, premium product." Design quality and functional depth matter equally. Never sacrifice one for the other.

Working rules:
- Start in planning mode. Before writing any code, produce: (1) an architecture overview, (2) the database schema, (3) the design system spec, (4) a phased build plan. Wait for my approval.
- Build ONE phase at a time. At the end of each phase: run typecheck, lint, and tests; fix all errors; give me a short summary of what was built and what I should click to review it; make a git commit with a clear message. Do not start the next phase until I say so.
- Prefer fewer, well-finished features over many half-built ones. No placeholder screens, no "coming soon," no Lorem ipsum anywhere.
- Ask me before adding any major dependency not listed below.
- Keep a CLAUDE.md file updated with project conventions, commands, and design rules so future sessions stay consistent.

## 1. Tech stack
- Next.js (App Router, latest stable) + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui as a base, heavily customized to match the design system (it must NOT look like default shadcn)
- Motion (Framer Motion) for animation
- TanStack Table for data grids, TanStack Query where client caching is needed
- React Hook Form + Zod for forms and validation (shared schemas between client and server)
- Prisma + PostgreSQL
- Auth.js (or Better Auth) with role-based access control
- Recharts or visx for charts, styled to match the design system
- Vitest for unit tests, Playwright for key end-to-end flows
- Deployable to Vercel with a hosted Postgres (Neon or Supabase)

## 2. Design language: "Warm Calm"
The product should feel like a beautifully made notebook, not enterprise software. Calm, warm, confident, quietly delightful. Every screen should feel considered.

### Color
- Light mode background: warm off-white (around #FAF8F5), surfaces slightly lighter (#FFFFFF at low contrast), hairline borders in warm grey.
- Text: warm near-black ink (around #1C1917), secondary text in warm stone grey.
- ONE confident brand accent: [deep forest green around #1F5C4A] used sparingly for primary actions, focus rings, and key highlights.
- One secondary warm highlight: [soft amber around #E8A33D] for celebrations, badges, and moments of delight only.
- Semantic colors (success, warning, danger, info) desaturated and harmonious with the palette, never neon.
- Dark mode: warm charcoal (around #171513), not pure black; accent slightly lifted for contrast. Both modes are first-class.
- Define everything as CSS variables / design tokens. No hardcoded hex values in components.

### Typography
- Display / headings and large numbers: an expressive serif such as Fraunces or Instrument Serif.
- UI and body: a refined sans such as Geist or Inter.
- Monospace (Geist Mono or JetBrains Mono) for employee IDs, codes, and timestamps.
- Tabular numerals for all data, tables, salaries, and stats.
- Clear type scale with generous line-height; headings with slightly tight letter-spacing.

### Space, shape, depth
- 4px spacing grid, generous whitespace; let content breathe.
- Corner radius 10–14px for cards, 8px for inputs and buttons, full pill for tags and avatars.
- Depth through soft, layered, low-opacity shadows and hairline borders, not heavy drop shadows.
- Icons: Lucide only, consistent stroke width, never emoji as UI icons.
- Density toggle: "Comfortable" and "Compact" modes for tables and lists.

### Motion
- Durations 150–250ms, spring-based easing, always purposeful (it should explain a change, never just decorate).
- Subtle page and panel transitions, smooth layout animations when lists reorder or filter.
- Numbers count up on dashboards; progress rings animate in.
- Optimistic UI for approvals, check-ins, and status changes.
- Fully respect prefers-reduced-motion.

### Delight (used sparingly so it stays special)
- Time-aware greeting on the home screen ("Good morning, Priya") with today's relevant info.
- A satisfying, tactile clock-in/clock-out interaction.
- A small celebration (amber confetti or a gentle animation) only for real milestones: onboarding completed, work anniversary, leave approved.
- Empty states with friendly, specific copy and a simple illustration or icon composition, plus a clear next action.
- Error states that explain what happened and offer a recovery action.
- Skeleton loaders shaped like the real content, never generic spinners for page loads.

### Explicitly avoid
Purple/blue gradient hero sections, glassmorphism everywhere, four identical KPI cards in a row as the whole dashboard, default shadcn look, cluttered sidebars, walls of tables with no hierarchy, emoji icons, generic stock-photo vibes.

### Accessibility
WCAG 2.1 AA contrast in both themes, full keyboard navigation, visible focus states, proper ARIA labels, semantic HTML, screen-reader-friendly tables and dialogs.

## 3. Roles and permissions
Four roles with RBAC enforced on the server (not just hidden in the UI): Super Admin, HR Manager, Team Manager, Employee. Each role gets a tailored home dashboard and navigation.

## 4. Core modules
1. Authentication: email/password login, role-based redirects, password reset flow, session management. Include one-click demo login buttons for each role on the login page so recruiters can explore instantly.
2. Employee directory and profiles: searchable, filterable directory with grid and table views; rich profile pages (personal info, job details, manager, team, documents, activity timeline, emergency contacts); inline editing with permissions.
3. Organization chart: interactive, zoomable, collapsible tree built from manager relationships; click a node to open a profile preview.
4. Departments and designations management.
5. Attendance: clock in/out, daily and monthly timesheet views, late/early indicators, attendance regularization requests, manager overview of the team's day.
6. Leave management: configurable leave types and policies, balances with accrual, apply-for-leave flow with a date-range picker that shows team conflicts and holidays, multi-level approvals, team leave calendar.
7. Holidays calendar: company holidays by location.
8. Payroll (simulated, clearly labeled as demo): salary structures (basic, allowances, deductions), monthly payroll run with review step, downloadable PDF payslips with a clean designed layout.
9. Performance: goals/OKRs with progress tracking, review cycles, self-review and manager review forms, simple 360 feedback.
10. Recruitment (ATS): job postings, a drag-and-drop kanban pipeline for candidates (Applied → Screening → Interview → Offer → Hired), candidate profiles with notes and ratings, convert hired candidate into an employee.
11. Onboarding and offboarding: checklist templates, tasks assigned to HR, IT, manager, and the new hire, progress tracking.
12. Documents: upload and categorize employee documents, company policy library.
13. Announcements: rich-text company posts with reactions and read tracking.
14. Analytics dashboard (HR and Admin): headcount over time, department distribution, attrition rate, leave trends, attendance patterns, hiring funnel. Charts must be beautiful, readable, and match the design system, with date-range filters.
15. Notifications center: in-app notifications for approvals, mentions, and reminders, with read/unread state.
16. Audit log: who changed what and when, filterable (Admin only).
17. Settings: company profile, leave policies, roles, theme and density preferences per user.

## 5. Exceptional features (these make it stand out)
- Command palette (Cmd/Ctrl + K): jump to any page, search any employee, run quick actions like "Apply leave" or "Clock in."
- Keyboard shortcuts throughout, with a "?" shortcut cheat sheet.
- "Moments" widget: upcoming birthdays, work anniversaries, and new joiners.
- Employee self-service home: everything an employee needs on one calm screen (today's status, leave balance, pending tasks, payslip, announcements).
- Approvals inbox for managers: one unified queue for leave, attendance regularization, and other requests, with bulk approve.
- CSV import for employees with a validation preview step, and CSV/PDF export for tables and reports.
- Global search with highlighted matches.
- Activity timelines on profiles and requests.

## 6. Engineering quality
- Clean folder structure organized by feature, server actions or route handlers with Zod validation on every input.
- Proper loading, error, and empty states on every page.
- Database seeding script with realistic, diverse demo data: around 80–120 employees across 6–8 departments, with 12 months of attendance, leave, performance, and hiring history so charts and dashboards look alive.
- Unit tests for business logic (leave balance calculation, payroll math, permissions) and Playwright tests for key flows (login per role, apply and approve leave, clock in).
- Fully responsive; the employee self-service experience must work beautifully on mobile.
- Lighthouse score 90+ for performance and accessibility on key pages.
- A polished README: project overview, feature list, screenshots or GIFs, tech stack, architecture diagram, demo credentials, setup instructions.

## 7. Suggested phases (refine this in your plan)
Phase 1: Project setup, design tokens, theming (light/dark), core layout (sidebar, top bar, command palette shell), and a /design showcase page displaying every component in the system.
Phase 2: Database schema, seed data, auth, RBAC, demo logins.
Phase 3: Employee directory, profiles, departments, org chart.
Phase 4: Attendance, leave management, holidays, approvals inbox.
Phase 5: Role-based dashboards and analytics.
Phase 6: Recruitment ATS and onboarding/offboarding.
Phase 7: Performance, payroll (simulated), documents, announcements.
Phase 8: Notifications, audit log, settings, CSV import/export, shortcuts.
Phase 9: Polish pass (motion, empty states, accessibility audit, responsive QA), tests, README, deployment.

Begin with step 0: give me your plan, schema, and design system spec for approval.