import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { REFRESH_TOKEN_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/workspace") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/login") && token) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/workspace/:path*"],
};
