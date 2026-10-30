# Deploying Grove

Grove runs on **Vercel** (the app), **Supabase** (Postgres and file storage) and **GitHub Actions** (CI and the nightly demo reseed). Everything below is one-time setup; none of it needs code changes.

> Treat every key on this page as a secret. Put it in Vercel's or GitHub's secret store, never in the repository, a chat, or a screenshot.

## 1. Supabase

1. Create a project. Pick the region closest to your Vercel region (Mumbai for both is a good match for Bengaluru).
2. **Database connection strings** (Connect → ORMs):
   - `DATABASE_URL`: the **transaction pooler** string, port **6543**, with `?pgbouncer=true`. The app uses this at runtime.
   - `DIRECT_URL`: the **session / direct** string, port **5432**. Migrations and the seed use this.
3. **File storage**: Project Settings → API → copy the **Project URL** (`SUPABASE_URL`) and the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`). The private `documents` bucket is created automatically on the first upload.

## 2. First database load

From your machine, with `.env.local` filled in (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` **empties every table** before rebuilding Northwind Grove, and uploads the demo documents to the bucket. Only ever run it against a demo database.

## 3. Vercel

1. Import the GitHub repository. Framework preset: Next.js (detected). Build and install commands: the defaults.
2. Environment variables (Production):

   | Variable                                    | Value                                                                           |
   | ------------------------------------------- | ------------------------------------------------------------------------------- |
   | `DATABASE_URL`                              | pooled string from step 1                                                       |
   | `DIRECT_URL`                                | direct string (only needed if you run migrations from Vercel)                   |
   | `BETTER_AUTH_SECRET`                        | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`   |
   | `BETTER_AUTH_URL`                           | your production URL, e.g. `https://grove.vercel.app`                            |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | from step 1                                                                     |
   | `CRON_SECRET`                               | `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`      |
   | `DEMO_MODE`                                 | `true` for the public demo (one-click logins). **`false` for any real company** |
   | `DATABASE_POOL_MAX`                         | `1` or `2`; serverless instances should hold few connections                    |

3. Deploy. The nightly reminders job is declared in `vercel.json` (`/api/cron/reminders`, 09:00 IST); Vercel sends `CRON_SECRET` with it automatically.
4. Check `https://<your-domain>/api/health` returns `{"status":"ok"}`.

If you change the region, keep the Vercel function region next to the database (Project Settings → Functions).

## 4. Nightly demo reseed (optional)

For a public demo that resets itself, in the GitHub repository:

1. Settings → Secrets and variables → Actions → **Secrets**: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same values as above).
2. **Variables**: `RESEED_ENABLED` = `true`.
3. The workflow `reseed.yml` then runs every night at 02:00 IST. You can also start it from the Actions tab.

Leave `RESEED_ENABLED` unset on anything that holds real data: the job deletes everything.

## 5. Continuous integration

`ci.yml` runs on every push and pull request: typecheck, lint and unit tests, then the Playwright suite (desktop and mobile, with accessibility scans in both themes) against a throwaway Postgres container. It needs no secrets.

## What is and isn't production-ready

- Authentication, sessions, role checks and audit logging are real. Sign-up is disabled; accounts come from the seed or from HR.
- **Payroll is simulated** and says so everywhere. Do not run real payroll through it.
- Email isn't sent. Password reset messages are queued in the `EmailOutbox` table, and in demo mode the reset screen reads the link back from there. A real deployment needs a sender that delivers the outbox (an email provider hooked into `lib/auth.ts`).
- Uploaded files live in a private bucket and are only served through the app after an access check.
