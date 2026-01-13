/**
 * Loading skeleton components for better perceived performance
 * These provide visual feedback during data fetching
 */

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

/**
 * Base skeleton component
 */
export function Skeleton({
  className = "",
  variant = "rounded",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const variantClasses: Record<string, string> = {
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-sm",
    rounded: "rounded-xl",
  };

  const animationClasses: Record<string, string> = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height)
    style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`shimmer-skeleton ${variantClasses[variant]} ${animationClasses[animation]} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Card skeleton for content cards
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-3xl p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      {lines > 2 && (
        <>
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="90%" />
        </>
      )}
    </div>
  );
}

/**
 * Article skeleton for blog/article pages
 */
export function ArticleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-premium rounded-3xl p-6 space-y-4">
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="text" width="100%" height={32} />
        <Skeleton variant="text" width="70%" height={32} />
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={120} />
        </div>
      </div>

      {/* Content */}
      <div className="glass-premium rounded-3xl p-6 space-y-4">
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="95%" />
        <Skeleton variant="text" width="80%" />
      </div>

      {/* Sidebar */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-premium rounded-3xl p-6 space-y-3">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="rounded" width="100%" height={120} />
        </div>
        <div className="glass-premium rounded-3xl p-6 space-y-3">
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="rounded" width="100%" height={120} />
        </div>
      </div>
    </div>
  );
}

/**
 * Stats card skeleton for metrics
 */
export function StatsCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-xs text-white/55 mb-3">
        <Skeleton variant="circular" width={16} height={16} />
        <Skeleton variant="text" width={100} />
      </div>
      <Skeleton variant="text" width={80} height={32} className="mt-2" />
      <Skeleton variant="text" width={60} className="mt-1" />
    </div>
  );
}

/**
 * Topic hub skeleton
 */
export function TopicHubSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="hero-cosmic glass-premium rounded-3xl p-6 space-y-4">
        <Skeleton variant="text" width={150} />
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="40%" />
        <div className="flex gap-2">
          <Skeleton variant="rounded" width={100} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Card grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/**
 * Search results skeleton
 */
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="glass-card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Skeleton variant="circular" width={32} height={32} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="text" width="50%" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tweet skeleton for social feed
 */
export function TweetSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton variant="text" width={100} />
            <Skeleton variant="text" width={80} />
          </div>
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline loading spinner
 */
export function LoadingSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses: Record<string, string> = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

/**
 * Full page loading overlay
 */
export function FullPageLoader({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" className="text-accent" />
        <p className="text-sm text-white/60">{message}</p>
      </div>
    </div>
  );
}
