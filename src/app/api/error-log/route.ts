import { NextRequest, NextResponse } from "next/server";

/**
 * API endpoint for client-side error logging.
 *
 * Receives error data from the ErrorBoundary component and logs it.
 * In production, this could integrate with services like Sentry, DataDog, etc.
 *
 * POST /api/error-log
 *
 * Body:
 * {
 *   message: string;
 *   stack?: string;
 *   componentStack?: string;
 *   timestamp: string;
 *   userAgent: string;
 *   url: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();

    // Log to console for development
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", errorData);
    }

    // In production, you would send this to an error tracking service
    // Example: Sentry.captureException(...);

    // Optionally log to database for audit trail
    // const db = getDbPool();
    // await db.query(...)

    // Return success regardless of whether we logged successfully
    // We don't want error logging to break the app
    return NextResponse.json({ success: true }, { status: 202 });
  } catch {
    // Silently fail - error logging should never cause more errors
    return NextResponse.json({ success: true }, { status: 202 });
  }
}
