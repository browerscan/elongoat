import { Clock } from "lucide-react";

export interface LastModifiedProps {
  date: Date | string;
  prefix?: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Display last modified date for content freshness signals
 * Important for SEO as it shows content is maintained
 */
export function LastModified({
  date,
  prefix = "Last updated",
  className = "",
  showIcon = true,
}: LastModifiedProps) {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Format as relative time if within 30 days, otherwise show date
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let displayText: string;

  if (diffDays === 0) {
    displayText = "today";
  } else if (diffDays === 1) {
    displayText = "yesterday";
  } else if (diffDays < 7) {
    displayText = `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    displayText = `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    displayText = `${months} ${months === 1 ? "month" : "months"} ago`;
  } else {
    // Show full date for older content
    displayText = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <time
      dateTime={dateObj.toISOString()}
      className={`inline-flex items-center gap-1.5 text-xs text-white/50 ${className}`}
      title={dateObj.toLocaleString()}
    >
      {showIcon && <Clock className="h-3 w-3" />}
      <span>
        {prefix} {displayText}
      </span>
    </time>
  );
}

/**
 * Get a standardized last modified date for content
 * Checks content_cache table first, falls back to cluster generation date
 */
export async function getContentLastModified(
  slug: string,
  fallbackDate: Date | string,
): Promise<Date> {
  try {
    const { getDbPool } = await import("../lib/db");
    const pool = getDbPool();

    if (pool) {
      const result = await pool.query<{ updated_at: Date }>(
        `SELECT updated_at FROM elongoat.content_cache WHERE slug = $1`,
        [slug],
      );

      if (result.rows.length > 0 && result.rows[0].updated_at) {
        return new Date(result.rows[0].updated_at);
      }
    }
  } catch {
    // Fall through to fallback
  }

  return typeof fallbackDate === "string"
    ? new Date(fallbackDate)
    : fallbackDate;
}
