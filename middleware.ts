import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const APP_SECRET = process.env.APP_INTERNAL_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const MY_DOMAIN = "oreblogda";
const MY_DEV_DOMAIN = ":3000";

// 🔹 1. PUBLIC ROUTES: No Token Required even in Debug Mode
const PUBLIC_API_ROUTES = [
"/api/mobile/sync-identity",
"/api/mobile/register",
"/api/mobile/recover",
"/api/mobile/secure-uplink",
"/api/version",
"/api/contact",
"/api/mobile/refresh",
];

export async function middleware(req: NextRequest) {
const { pathname } = req.nextUrl;
const userAgent = req.headers.get('user-agent') || '';
const method = req.method;

// Clone request headers so we can mutate them securely for downstream routes
const requestHeaders = new Headers(req.headers);

// 🌐 SUBDOMAIN ROUTING LAYER
const host = req.headers.get('host') || '';
const currentHost = process.env.NODE_ENV === 'production'
? host.replace('.oreblogda.com', '')
: host.replace('.localhost:3000', '');

// 🛡️ COLLABS SUBDOMAIN AUTHORIZATION GATE
if (currentHost === 'collabs') {
// 🔄 SYNCED: Explicitly included '/auth/login' here to halt infinite redirect loop mechanics
const isAuthPage = pathname === '/auth/login' || pathname === '/auth/me' || pathname === '/api/collabs/auth/me';

if (!isAuthPage) {
const collabsToken = req.cookies.get("collabs_token")?.value;

if (!collabsToken) {
if (pathname.startsWith("/api")) {
return new NextResponse(
JSON.stringify({ success: false, message: "COLLAB_SESSION_REQUIRED" }),
{ status: 401, headers: { 'content-type': 'application/json' } }
);
}
return NextResponse.redirect(new URL("/auth/login", req.url));
}

try {
const secret = new TextEncoder().encode(JWT_SECRET);
const { payload } = await jwtVerify(collabsToken, secret);

// Attach verified session claims cleanly into headers for backend routes to access
requestHeaders.set('x-collab-user-id', String(payload.userId));
requestHeaders.set('x-collab-clan-id', String(payload.clanId));
requestHeaders.set('x-collab-username', String(payload.username));
} catch (err) {
if (pathname.startsWith("/api")) {
return new NextResponse(
JSON.stringify({ success: false, message: "COLLAB_SESSION_EXPIRED" }),
{ status: 401, headers: { 'content-type': 'application/json' } }
);
}
// Wipes broken/expired cookie cleanly and signs them out completely
const clearRedirect = NextResponse.redirect(new URL("/auth/login", req.url));
clearRedirect.cookies.delete("collabs_token");
return clearRedirect;
}
}
}

// Only rewrite if it's the collabs subdomain AND not an API route
if (currentHost === 'collabs' && !pathname.startsWith("/api") && !pathname.startsWith("/collabs")) {
const url = req.nextUrl.clone();
url.pathname = `/collabs${pathname === '/' ? '' : pathname}`;

console.log("DEBUG: Final Rewrite Path ->", url.pathname);
return NextResponse.rewrite(url, {
request: {
headers: requestHeaders,
}
});
}

// 🛡️ THE SYSTEM TOGGLE
// If true: Test the new Token/JWT logic.
// If false: Standard public access (no token check).

if (pathname.startsWith("/api")) {
// Handle OPTIONS Preflight instantly
if (method === "OPTIONS") {
const preflightResponse = new NextResponse(null, { status: 204 });
preflightResponse.headers.set("Access-Control-Allow-Origin", "*");
preflightResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
preflightResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oreblogda-secret, x-user-deviceId, x-the-system-debug");
return preflightResponse;
}

// B. IDENTIFY SOURCES
const isSearchEngine = /Googlebot|AdsBot-Google|Bingbot|DuckDuckBot|YandexBot/i.test(userAgent);
const isCronJob = userAgent.includes("vercel-cron");
const isCloudinaryWebhookRoute = pathname === "/api/webhooks/cloudinary";
const referer = req.headers.get('referer');
const origin = req.headers.get('origin');
const isInternal = (referer?.includes(MY_DOMAIN)) || (origin?.includes(MY_DOMAIN)) || (referer?.includes(MY_DEV_DOMAIN)) || (origin?.includes(MY_DEV_DOMAIN));

// C. APP PROTECTION LAYER
if (!isSearchEngine && !isInternal && !isCronJob && !isCloudinaryWebhookRoute) {
const clientSecret = req.headers.get('x-oreblogda-secret');

// 1. Basic App Secret Check (Always Active)
if (!clientSecret || clientSecret !== APP_SECRET) {
return new NextResponse(
JSON.stringify({ success: false, message: "NEURAL_LINK_DENIED: Unauthorized Source." }),
{ status: 401, headers: { 'content-type': 'application/json', "Access-Control-Allow-Origin": "*" } }
);
}

// 2. NEW FEATURE: JWT/Token Logic
// 🔓 UPDATE: GET requests and PUBLIC_API_ROUTES bypass JWT validation
const isPublicAction = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));
const isGetRequest = method === "GET";

if (!isPublicAction && !isGetRequest) {
const authHeader = req.headers.get('authorization');
const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
const clientDeviceId = req.headers.get('x-user-deviceId');

if (!token) {
return new NextResponse(
JSON.stringify({ success: false, message: "ENCRYPTION_KEY_MISSING: Authentication Required." }),
{ status: 455, headers: { 'content-type': 'application/json', "Access-Control-Allow-Origin": "*" } }
);
}

try {
const secret = new TextEncoder().encode(JWT_SECRET);
const { payload } = await jwtVerify(token, secret);

// 🔄 CLONE & READ BODY SAFELY WITHOUT LOCKING STREAM
let bodyDeviceId: string | null = null;
try {
const contentType = req.headers.get('content-type') || '';
if (contentType.includes('application/json')) {
const clonedReq = req.clone(); // Forks request stream safely
const body = await clonedReq.json();
if (body && typeof body === 'object' && 'deviceId' in body) {
bodyDeviceId = String(body.deviceId);
}
}
} catch (bodyErr) {
// Failsafe catch if payload body is empty or unparseable
}

// 🚨 VALIDATE BOTH HEADERS AND BODY PAYLOADS AGAINST JWT USERID
const headerMismatch = payload.userId !== clientDeviceId;
const bodyMismatch = bodyDeviceId !== null && bodyDeviceId !== String(payload.userId);

if (headerMismatch || bodyMismatch) {
return new NextResponse(
JSON.stringify({ success: false, message: "NEURAL_MISMATCH: Hardware signature invalid." }),
{ status: 403, headers: { 'content-type': 'application/json', "Access-Control-Allow-Origin": "*" } }
);
}

// ✅ OVERWRITE INCORRECT/SPOOFABLE HEADERS WITH THE VERIFIED PAYLOAD VALUE
requestHeaders.set('x-user-deviceId', String(payload.userId));
requestHeaders.set('x-user-level', String(payload.level));

} catch (err: any) {
const isExpired = err.code === 'ERR_JWT_EXPIRED';

return new NextResponse(
JSON.stringify({
success: false,
message: isExpired ? "TOKEN_EXPIRED" : "SESSION_INVALID",
detail: isExpired ? "Your neural link requires refreshing." : "Please re-authenticate."
}),
{ status: 421, headers: { 'content-type': 'application/json', "Access-Control-Allow-Origin": "*" } }
);
}
}
}

// Build standard downstream path with our securely altered request headers 
const apiResponse = NextResponse.next({
request: {
headers: requestHeaders,
}
});

// A. Standard Security Headers on output response
apiResponse.headers.set("Access-Control-Allow-Origin", "*");
apiResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
apiResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-oreblogda-secret, x-user-deviceId, x-the-system-debug");

const userLevel = requestHeaders.get('x-user-level');
if (userLevel) {
apiResponse.headers.set('x-user-level', userLevel);
}

return apiResponse;
}

// --- 2. AUTHORS DIARY (Web Only) ---
const webToken = req.cookies.get("token")?.value;
if (pathname.startsWith("/authorsdiary") && !webToken) {
return NextResponse.redirect(new URL("/auth/login", req.url));
}

return NextResponse.next({
request: {
headers: requestHeaders,
}
});
}

export const config = {
matcher: [
/*
* Match all paths except:
* 1. _next/static (static files)
* 2. _next/image (image optimization)
* 3. favicon.ico, manifest.json, robots.txt, etc.
* 4. Files with extensions (like .png, .js, .css)
*/
'/((?!_next/static|_next/image|assets|favicon.ico|manifest.json|robots.txt|sitemap.xml|.*\\..*).*)',
],
};