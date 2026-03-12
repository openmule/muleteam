import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Platform-authenticated requests come with pre-verified user headers
  const platformUser = request.headers.get("x-platform-user-email");
  if (platformUser) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token") || request.cookies.get("platform_token");

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /invite/* (public invite registration)
     * - /api/* (API routes handle their own auth)
     * - /_next/* (Next.js internals)
     * - /favicon.ico
     * - /cli/* (CLI script downloads)
     */
    "/((?!login|invite/|api/|_next/|favicon\\.ico|cli/).*)",
  ],
};
