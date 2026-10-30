import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirects only: this checks that a session cookie exists, not
 * that it's valid. Real checks happen on the server in every page, action
 * and route handler (src/server/session.ts).
 */
// /api/cron checks its own shared secret; /api/health reveals nothing.
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/design",
  "/api/auth",
  "/api/cron",
  "/api/health",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/home" : "/login", request.url));
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublic && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static files.
  matcher: ["/((?!_next/|icon.svg|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico|txt|xml)$).*)"],
};
