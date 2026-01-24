import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Protect /prospect (and any sub-routes)
  if (path.startsWith("/prospect") && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login"; // adjust if your login route differs
    url.searchParams.set("redirectedFrom", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/prospect/:path*"],
};
