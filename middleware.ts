import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;
const MY_DOMAIN = "oreblogda.com";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // --- 1. HANDLE API ROUTES (Security & CORS) ---
  if (pathname.startsWith("/api")) {
    
    // A. CORS Headers
    response.headers.set("Access-Control-Allow-Origin", "*"); 
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oreblogda-secret");

    // Handle Preflight (OPTIONS)
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // B. BOT/SECURITY CHECK
    const clientSecret = req.headers.get('x-oreblogda-secret');
    const referer = req.headers.get('referer');
    const origin = req.headers.get('origin');
    
    const isInternal = 
      (referer && referer.includes(MY_DOMAIN)) || 
      (origin && origin.includes(MY_DOMAIN));

    // --- DEBUG LOGS FOR VERCEL ---
    console.log("--- NEURAL_LINK_DEBUG ---");
    console.log("Path:", pathname);
    console.log("Is Internal:", isInternal);
    console.log("Referer:", referer);
    console.log("Origin:", origin);
    console.log("Secret Provided:", clientSecret ? "YES (HIDDEN)" : "NO");
    console.log("Secret Match:", clientSecret === APP_SECRET);
    console.log("-------------------------");

    // If it's external, it MUST have the secret
    if (!isInternal) {
      if (!clientSecret || clientSecret !== APP_SECRET) {
        console.error("⛔ ACCESS_DENIED: Bot or External unauthorized source blocked.");
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            message: "NEURAL_LINK_DENIED: External unauthorized access protocol." 
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }
    }

    return response;
  }

  // --- 2. AUTH LOGIC (Authors Diary) ---
  const token = req.cookies.get("token")?.value;

  if (pathname.startsWith("/authorsdiary") && !token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

// --- 3. CONFIGURATION ---
export const config = {
  matcher: ["/authorsdiary/:path*", "/api/:path*"], 
};
