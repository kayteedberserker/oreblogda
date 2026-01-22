// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This matches the secret you'll put in your mobile app
const APP_SECRET = process.env.APP_INTERNAL_SECRET;

export function middleware(request: NextRequest) {
  // 1. Only protect API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    
    // 2. Extract the custom header
    const clientSecret = request.headers.get('x-oreblogda-secret');
    
    // 3. Bot Check: If the secret is missing or wrong, block it immediately
    if (!clientSecret || clientSecret !== APP_SECRET) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          message: "NEURAL_LINK_DENIED: Unauthorized access protocol." 
        }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

// 4. Configure which paths this runs on
export const config = {
  matcher: '/api/:path*',
};

