import { Skeleton } from "../../components/Skeleton";

/**
 * Loading skeleton for topic hub pages.
 */
export default function TopicHubLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="glass glow-ring rounded-3xl p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Skeleton height="16px" width="50px" />
          <span className="text-white/30">/</span>
          <Skeleton height="16px" width="100px" />
        </div>

        {/* Title and description */}
        <Skeleton height="40px" width="60%" className="mt-3" />
        <Skeleton height="18px" width="80%" className="mt-2" />

        {/* Stats */}
        <div className="mt-5 flex flex-wrap gap-4">
          <Skeleton height="24px" width="100px" variant="rounded" />
          <Skeleton height="24px" width="120px" variant="rounded" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="glass glow-ring flex items-center gap-3 rounded-2xl px-4 py-3">
        <Skeleton variant="circle" height="16px" width="16px" />
        <Skeleton height="20px" width="200px" />
        <div className="ml-auto">
          <Skeleton height="16px" width="80px" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton height="16px" width="75%" />
                <Skeleton height="12px" width="50%" className="mt-1" />
                <Skeleton height="10px" width="40%" className="mt-2" />
              </div>
              <Skeleton height="16px" width="16px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
