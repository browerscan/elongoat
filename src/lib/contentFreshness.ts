export type ContentFreshness = {
  createdAt: string;
  expiresAt: string | null;
  isStale: boolean;
  freshnessPercent: number;
  status: "fresh" | "aging" | "stale";
};

const FRESHNESS_THRESHOLDS = {
  FRESH: 7 * 24 * 60 * 60 * 1000, // 7 days
  AGING: 30 * 24 * 60 * 60 * 1000, // 30 days
  STALE: 90 * 24 * 60 * 60 * 1000, // 90 days
};

/**
 * Calculate content freshness metadata
 */
export function calculateFreshness(
  createdAt: string,
  expiresAt: string | null,
): ContentFreshness {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const expires = expiresAt ? new Date(expiresAt).getTime() : null;
  const age = now - created;

  let isStale = false;
  let freshnessPercent = 0;
  let status: ContentFreshness["status"] = "fresh";

  if (expires) {
    const timeUntilExpiry = expires - now;
    const totalLifetime = expires - created;
    freshnessPercent = Math.max(
      0,
      Math.min(100, (timeUntilExpiry / totalLifetime) * 100),
    );
    isStale = now > expires;
  } else {
    // For content without expiry, use fixed thresholds
    if (age > FRESHNESS_THRESHOLDS.STALE) {
      freshnessPercent = 0;
      status = "stale";
      isStale = true;
    } else if (age > FRESHNESS_THRESHOLDS.AGING) {
      freshnessPercent = 25;
      status = "aging";
    } else if (age > FRESHNESS_THRESHOLDS.FRESH) {
      freshnessPercent = 50;
      status = "aging";
    } else {
      freshnessPercent = 100;
      status = "fresh";
    }
  }

  return {
    createdAt,
    expiresAt,
    isStale,
    freshnessPercent,
    status,
  };
}

/**
 * Get a human-readable freshness label
 */
export function getFreshnessLabel(freshness: ContentFreshness): string {
  if (freshness.isStale) return "Content may be outdated";

  switch (freshness.status) {
    case "fresh":
      return "Recently updated";
    case "aging":
      return "Content may need refresh";
    case "stale":
      return "Content outdated";
    default:
      return "";
  }
}

/**
 * Get freshness color class for UI
 */
export function getFreshnessColor(freshness: ContentFreshness): string {
  switch (freshness.status) {
    case "fresh":
      return "text-green-400";
    case "aging":
      return "text-yellow-400";
    case "stale":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

/**
 * Format a date for freshness display
 */
export function formatDateFreshness(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Check if content should be regenerated based on age
 */
export function shouldRegenerate(
  createdAt: string,
  expiresAt: string | null,
  minFreshnessPercent = 30,
): boolean {
  const freshness = calculateFreshness(createdAt, expiresAt);
  return freshness.isStale || freshness.freshnessPercent < minFreshnessPercent;
}
