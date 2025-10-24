import { NextResponse } from "next/server";

export function middleware(req) {
  const token = req.cookies.get("token")?.value;

  // Protect all routes under /dashboard
  if (req.nextUrl.pathname.startsWith("/authorsdiary") && !token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/authordiary/:path*"], // Apply only to dashboard routes
};
