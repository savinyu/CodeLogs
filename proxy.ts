import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/** Pages that need a session. Everything else in the matcher just keeps the session cache fresh. */
const PROTECTED = [
  "/today",
  "/progress",
  "/topics",
  "/sheets",
  "/friends",
  "/contests",
  "/connect",
  "/settings",
];

const isProtected = (path: string) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  // Optimistic check only: it looks for the session cookie, not a valid session.
  // Pages still call requireUser() to verify the session.
  if (!getSessionCookie(request)) {
    return isProtected(request.nextUrl.pathname)
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  // Better Auth keeps the session in a signed cookie for 5 minutes (lib/auth.ts), but pages
  // render as Server Components, which can't set cookies. Refresh it here once it lapses, so
  // page renders read the session without a database lookup. The new cookie goes to this
  // request's render as well as to the browser.
  const cached = await getCookieCache(request, { secret: env().BETTER_AUTH_SECRET });
  if (cached) return NextResponse.next();
  const { headers: authHeaders } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const setCookies = authHeaders.getSetCookie();
  if (setCookies.length === 0) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  const cookies = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  for (const header of setCookies) {
    const [pair = ""] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  requestHeaders.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const header of setCookies) response.headers.append("set-cookie", header);
  return response;
}

export const config = {
  matcher: [
    "/",
    "/u/:path*",
    "/today/:path*",
    "/progress/:path*",
    "/topics/:path*",
    "/sheets/:path*",
    "/friends/:path*",
    "/contests/:path*",
    "/connect/:path*",
    "/settings/:path*",
  ],
};
