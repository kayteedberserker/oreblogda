import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;
const MY_DOMAIN = "oreblogda.com";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // --- 1. HANDLE API ROUTES (Security & CORS) ---
  if (pathname.startsWith("/api")) {
    
    // A. CORS Headers (Keep these for your mobile app/external access)
    response.headers.set("Access-Control-Allow-Origin", "*"); 
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    // 🔹 IMPORTANT: Added your custom secret header to the allowed headers list
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

    // If it's external, it MUST have the secret
    if (!isInternal) {
      if (!clientSecret || clientSecret !== APP_SECRET) {
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
  // Combine both matchers here
  matcher: ["/authorsdiary/:path*", "/api/:path*"], 
};
