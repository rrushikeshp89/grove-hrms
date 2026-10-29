import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  // DATABASE_POOL_MAX caps connections per server process. Serverless
  // deployments behind a pooler want it small; tests against PGlite use 1.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

// One client per server process; dev hot reloads would otherwise open a new
// pool on every edit.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

function client(): PrismaClient {
  globalForDb.db ??= createClient();
  return globalForDb.db;
}

/**
 * Created on first use rather than at import, so `next build` (which imports
 * server modules while prerendering static pages) never needs credentials.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export type { Prisma } from "@/generated/prisma/client";
