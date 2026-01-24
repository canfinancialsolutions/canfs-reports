// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes – allow without login
  const publicPaths = ['/auth', '/_next', '/favicon.ico', '/api/auth'];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Read simple auth cookie
  const hasSession = request.cookies.get('canfs_auth')?.value === 'true';

  // Protect /dashboard and /prospect and /fna (add any others here)
  const protectedPrefixes = ['/dashboard', '/prospect', '/fna'];

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('redirect', pathname); // optional: remember where they were going
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Limit middleware to app routes (you can tighten this if you want)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
