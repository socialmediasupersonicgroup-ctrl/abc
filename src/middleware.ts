import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/** Blocks every page, server action and API route (except sign-in and health) until the owner signs in. */
export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new NextResponse("Sign-in required", { status: 401 });
  }
  const url = req.nextUrl.clone();
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
