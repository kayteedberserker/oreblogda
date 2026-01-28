import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;
const MY_DOMAIN = "oreblogda.com";
const MY_SecondDOMAIN = " oreblogda.vercel.app"
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get('user-agent') || '';
  const response = NextResponse.next();

  // --- 1. HANDLE API ROUTES (Security & CORS) ---
  if (pathname.startsWith("/api")) {
    
    // A. CORS Headers (Crucial for Mobile App)
    response.headers.set("Access-Control-Allow-Origin", "*"); 
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oreblogda-secret");

    // Handle Preflight (OPTIONS)
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // B. IDENTIFY TRUSTED SOURCES
    
    // 1. Search Engines (SEO Protection)
    const isSearchEngine = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot/i.test(userAgent);

    // 2. Vercel Cron Jobs (Allow automated resets)
    const isCronJob = userAgent.includes("vercel-cron");

    // 3. Internal Site Requests
    const referer = req.headers.get('referer');
    const origin = req.headers.get('origin');
    const isInternal = 
      (referer && referer.includes(MY_DOMAIN)) || 
      (origin && origin.includes(MY_DOMAIN)) || (referer && referer.includes(MY_SecondDOMAIN)) || 
      (origin && origin.includes(MY_SecondDOMAIN))


    // C. SECURITY ENFORCEMENT
    // If it's NOT a search engine, NOT an internal request, and NOT a Cron Job...
    if (!isSearchEngine && !isInternal && !isCronJob) {
      const clientSecret = req.headers.get('x-oreblogda-secret');
      
      // ...then it MUST be the Mobile App with the correct secret
      if (!clientSecret || clientSecret !== APP_SECRET) {
        // Log it to Vercel so you can track attempts
        console.error(`⛔ BLOCKED: Unauthorized external request to ${pathname} | UA: ${userAgent}`);
        
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            message: "NEURAL_LINK_DENIED: Access restricted to authorized operatives." 
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
