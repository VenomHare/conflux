import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("conflux_session")?.value);
  const path = request.nextUrl.pathname;
  if (path === "/w" || path.startsWith("/w/") || path === "/onboarding") {
    if (!hasSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }
  if ((path === "/login" || path === "/register") && hasSession) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/register", "/onboarding", "/w/:path*"] };
