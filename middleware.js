import { NextResponse } from "next/server";
export const runtime = 'experimental-edge'; // <--- ADD THIS LINE
export function middleware(req) {
  const { pathname } = req.nextUrl;

  // --- 1. HANDLE API CORS ---
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();

    // In development, you can use '*', but for security it's better to 
    // allow specific origins if you know them.
    response.headers.set("Access-Control-Allow-Origin", "*"); 
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle Preflight requests
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }

    return response;
  }

  // --- 2. YOUR EXISTING AUTH LOGIC ---
  const token = req.cookies.get("token")?.value;

  if (pathname.startsWith("/authorsdiary") && !token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Update the matcher to include your API routes so the CORS logic runs
  matcher: ["/authorsdiary/:path*", "/api/:path*"], 
};