import { NextRequest, NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/securityHeaders";

/**
 * Middleware for applying security headers and CORS to all responses
 * Run on every request to ensure consistent security posture
 */

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io",
  "https://elongoat.io",
]);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.elongoat.io";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    const preflightResponse = new NextResponse(null, { status: 200 });

    if (origin && ALLOWED_ORIGINS.has(origin)) {
      preflightResponse.headers.set("Access-Control-Allow-Origin", origin);
      preflightResponse.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      preflightResponse.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With",
      );
      preflightResponse.headers.set("Access-Control-Max-Age", "86400");
    }

    return preflightResponse;
  }

  // Apply CORS for regular requests
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "false");
    response.headers.set(
      "Access-Control-Expose-Headers",
      "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
    );
  }

  // Get base security headers
  const { headers } = getSecurityHeaders({
    contentSecurityPolicy: true,
    strictTransportSecurity: true,
    xContentTypeOptions: true,
    xFrameOptions: true,
    xXssProtection: true,
    referrerPolicy: true,
    permissionsPolicy: true,
  });

  // Apply security headers, modifying CSP to include API URL
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      if (key === "Content-Security-Policy") {
        // Add API URL to connect-src for cross-origin API calls
        const apiOrigin = new URL(API_URL).origin;
        const cspWithApi = value.replace(/connect-src[^;]*/, `$& ${apiOrigin}`);
        response.headers.set(key, cspWithApi);
      } else {
        response.headers.set(key, value);
      }
    }
  }

  // Remove X-Powered-By header to reduce information disclosure
  response.headers.delete("x-powered-by");

  return response;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
