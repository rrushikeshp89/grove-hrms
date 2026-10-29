import { execSync } from "node:child_process";

/**
 * Reseeds before the suite so tests that change data (password reset) start
 * clean. The seed truncates every table, so it only runs against a local
 * database unless E2E_ALLOW_RESEED=1 says otherwise.
 */
export default function globalSetup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("Set DATABASE_URL for end-to-end tests (see README › Testing).");
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (!local && process.env.E2E_ALLOW_RESEED !== "1") {
    console.warn(
      "[e2e] Skipping reseed: DATABASE_URL is not local. Set E2E_ALLOW_RESEED=1 to force it.",
    );
    return;
  }
  execSync("npm run db:seed", { stdio: "inherit" });
}
