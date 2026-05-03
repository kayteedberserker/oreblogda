import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const MY_DOMAIN = "oreblogda";

// 🔹 1. PUBLIC ROUTES: No Token Required
const PUBLIC_API_ROUTES = [
  "/api/mobile/sync-identity",
  "/api/mobile/register",
  "/api/mobile/recover",
  "/api/mobile/secure-uplink",
  "/api/mobile/refresh", // 🛡️ MUST BE PUBLIC so we can get new tokens!
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get('user-agent') || '';
  const method = req.method;
  const response = NextResponse.next();

  if (pathname.startsWith("/api")) {
    // A. Standard Security Headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oreblogda-secret, x-user-deviceId");

    if (method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }

    // B. IDENTIFY SOURCES
    const isSearchEngine = /Googlebot|AdsBot-Google|Bingbot|DuckDuckBot|YandexBot/i.test(userAgent);
    const isCronJob = userAgent.includes("vercel-cron");
    const referer = req.headers.get('referer');
    const origin = req.headers.get('origin');
    const isInternal = (referer?.includes(MY_DOMAIN)) || (origin?.includes(MY_DOMAIN));

    // C. APP PROTECTION LAYER
    if (!isSearchEngine && !isInternal && !isCronJob) {
      const clientSecret = req.headers.get('x-oreblogda-secret');

      // 1. Check App Secret
      if (!clientSecret || clientSecret !== APP_SECRET) {
        return new NextResponse(
          JSON.stringify({ success: false, message: "NEURAL_LINK_DENIED: Unauthorized Source." }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }

      // 2. JWT Logic
      const isPublicAction = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));
      
      // 🛡️ PROTECT: In THE SYSTEM, we check tokens for ALL non-public API calls, 
      // not just "Write" actions, to ensure user data remains private.
      if (!isPublicAction) {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const clientDeviceId = req.headers.get('x-user-deviceId');
        
        if (!token) {
          return new NextResponse(
            JSON.stringify({ success: false, message: "ENCRYPTION_KEY_MISSING: Authentication Required." }),
            { status: 401, headers: { 'content-type': 'application/json' } }
          );
        }

        try {
          const secret = new TextEncoder().encode(JWT_SECRET);
          // This will throw if the 15-minute access token is expired
          const { payload } = await jwtVerify(token, secret);
          // Device DNA Check
          if (payload.userId !== clientDeviceId) {
            return new NextResponse(
              JSON.stringify({ success: false, message: "NEURAL_MISMATCH: Hardware signature invalid." }),
              { status: 403, headers: { 'content-type': 'application/json' } }
            );
          }

          // Pass user data to the route
          response.headers.set('x-user-level', String(payload.level));
        } catch (err: any) {
          // 🛡️ REFRESH TRIGGER: If expired, send a specific code for the frontend to catch
          const isExpired = err.code === 'ERR_JWT_EXPIRED';
          
          return new NextResponse(
            JSON.stringify({ 
              success: false, 
              message: isExpired ? "TOKEN_EXPIRED" : "SESSION_INVALID", 
              detail: isExpired ? "Your neural link requires refreshing." : "Please re-authenticate." 
            }),
            { status: 401, headers: { 'content-type': 'application/json' } }
          );
        }
      }
    }

    return response;
  }

  // --- 2. AUTHORS DIARY (Web Only) ---
  const webToken = req.cookies.get("token")?.value;
  if (pathname.startsWith("/authorsdiary") && !webToken) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return response;
}

export const config = {
  matcher: ["/authorsdiary/:path*", "/api/:path*"],
};