import "server-only";

import { NextResponse } from "next/server";
import { getSecurityHeaders } from "@/lib/securityHeaders";

/**
 * Middleware for applying security headers to all responses
 * Run on every request to ensure consistent security posture
 */

export function middleware() {
  const response = NextResponse.next();

  // Apply security headers to all responses
  const { headers } = getSecurityHeaders({
    contentSecurityPolicy: true,
    strictTransportSecurity: true,
    xContentTypeOptions: true,
    xFrameOptions: true,
    xXssProtection: true,
    referrerPolicy: true,
    permissionsPolicy: true,
  });

  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      response.headers.set(key, value);
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
