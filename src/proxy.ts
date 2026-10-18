import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: the real session check happens in the data access layer.
const SESSION_COOKIE = "club_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/renewals/:path*",
    "/transactions/:path*",
    "/events/:path*",
    "/reports/:path*",
    "/audit/:path*",
    "/settings/:path*",
    "/account/:path*",
    "/search/:path*",
    "/api/receipts/:path*",
    "/api/attachments/:path*",
    "/api/export/:path*",
  ],
};
