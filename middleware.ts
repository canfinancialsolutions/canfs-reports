// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'canfs_auth';
const PROTECTED_ROUTES = ['/dashboard', '/fna', '/prospect'];
const AUTH_PAGE = '/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Check for auth cookie
    const authCookie = request.cookies.get(AUTH_COOKIE);
    const isAuthenticated = authCookie?.value === 'true';

    if (!isAuthenticated) {
      // Redirect to auth page if not authenticated
      const url = request.nextUrl.clone();
      url.pathname = AUTH_PAGE;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/fna/:path*', '/prospect/:path*'],
};
