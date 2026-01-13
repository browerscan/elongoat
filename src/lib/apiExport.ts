/**
 * API Export Configuration Helper
 *
 * Provides conditional export configuration for API routes.
 * During static export (frontend build), routes are set to static.
 * During normal server operation (backend), routes can be dynamic.
 */

/**
 * Detects if the current build is a static export.
 * Static export happens during:
 * - next build with output: "export"
 * - Phase: "phase-export" or "phase-production-build"
 * - Production build without DATABASE_URL (frontend-only)
 */
export function isStaticExport(): boolean {
  if (process.env.NEXT_PHASE === "phase-export") return true;
  if (process.env.NEXT_PHASE?.includes("build")) return true;
  // Production without database indicates frontend-only build
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    return true;
  }
  return false;
}

/**
 * Returns the appropriate dynamic export value.
 * Use this in API routes instead of hardcoding `export const dynamic`.
 *
 * @example
 * ```ts
 * import { dynamicExport } from "@/lib/apiExport";
 * export const dynamic = dynamicExport("force-dynamic");
 * ```
 */
export function dynamicExport(
  defaultValue: "force-dynamic" | "error" | "force-static" = "force-dynamic",
): "force-dynamic" | "error" | "force-static" {
  return isStaticExport() ? "force-static" : defaultValue;
}

/**
 * Returns the appropriate revalidate value.
 * Static exports use longer cache times.
 *
 * @example
 * ```ts
 * import { revalidateExport } from "@/lib/apiExport";
 * export const revalidate = revalidateExport(0); // 0 for backend, 3600 for frontend
 * ```
 */
export function revalidateExport(
  backendValue: number,
  frontendValue: number = 3600,
): number {
  return isStaticExport() ? frontendValue : backendValue;
}
