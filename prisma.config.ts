import { defineConfig } from "prisma/config";

// Next.js loads .env.local for the app; the Prisma CLI and the seed script
// need it loaded explicitly.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the shell environment (CI, Vercel)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Supabase.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
