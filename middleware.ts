// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;

export function middleware(request: NextRequest) {
  // 1. Only protect API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    
    // 2. Extract headers
    const clientSecret = request.headers.get('x-oreblogda-secret');
    const referer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    
    // 3. INTERNAL CHECK: 
    // Get your domain (e.g., oreblogda.com) from environment variables or hardcode it
    const myDomain = "oreblogda.com"; 
    
    const isInternal = 
      (referer && referer.includes(myDomain)) || 
      (origin && origin.includes(myDomain));

    // 4. SECURITY LOGIC:
    // If it's NOT internal AND the secret is wrong/missing, block it.
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
  }

  return NextResponse.next();
}

// 5. Configure which paths this runs on
export const config = {
  matcher: '/api/:path*',
};
