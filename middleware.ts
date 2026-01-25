
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/prospect", "/fna"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow Next internals / static
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Always allow auth page and home page
  if (pathname === "/auth" || pathname === "/") {
    return NextResponse.next();
  }

  // Only enforce auth on protected pages
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.get("canfs_auth")?.value === "true";
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ Only run middleware on routes we care about (prevents weird global effects)
export const config = {
  matcher: ["/dashboard/:path*", "/prospect/:path*", "/fna/:path*", "/auth", "/"],
};
