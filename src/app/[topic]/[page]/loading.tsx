import { ContentSkeleton } from "@/components/ContentSkeleton";
import { Skeleton } from "@/components/Skeleton";

/**
 * Loading skeleton for cluster pages.
 * Displayed while AI content is being generated/loaded.
 */
export default function ClusterPageLoading() {
  return (
    <article className="space-y-6">
      {/* Header skeleton */}
      <div className="glass glow-ring rounded-3xl p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Skeleton height="16px" width="50px" />
          <span className="text-white/30">/</span>
          <Skeleton height="16px" width="80px" />
          <span className="text-white/30">/</span>
          <Skeleton height="16px" width="120px" />
        </div>

        {/* Title */}
        <Skeleton height="36px" width="70%" className="mt-3" />
        <Skeleton height="18px" width="90%" className="mt-2 max-w-3xl" />

        {/* Action buttons */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Skeleton height="48px" width="200px" variant="rounded" />
          <Skeleton height="48px" width="160px" variant="rounded" />
        </div>
      </div>

      {/* Metrics skeleton */}
      <section className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-3xl p-6">
            <Skeleton height="12px" width="80px" />
            <Skeleton height="32px" width="120px" className="mt-2" />
          </div>
        ))}
      </section>

      {/* Interpretation + Tips skeleton */}
      <section className="grid gap-6 md:grid-cols-5">
        <div className="glass rounded-3xl p-6 md:col-span-3">
          <Skeleton height="24px" width="160px" />
          <div className="mt-3 space-y-3">
            <Skeleton height="16px" width="100%" />
            <Skeleton height="16px" width="95%" />
            <Skeleton height="16px" width="85%" />
          </div>
        </div>

        <aside className="glass rounded-3xl p-6 md:col-span-2">
          <Skeleton height="24px" width="140px" />
          <div className="mt-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height="32px" width="100%" variant="rounded" />
            ))}
          </div>
        </aside>
      </section>

      {/* Keywords skeleton */}
      <section className="glass rounded-3xl p-6">
        <Skeleton height="24px" width="220px" />
        <Skeleton height="14px" width="300px" className="mt-2" />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <Skeleton height="16px" width="80%" />
              <Skeleton height="12px" width="60%" className="mt-1" />
            </div>
          ))}
        </div>
      </section>

      {/* AI Brief skeleton */}
      <section className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton height="24px" width="80px" />
          <Skeleton height="16px" width="100px" />
        </div>
        <div className="mt-4">
          <ContentSkeleton />
        </div>
      </section>

      {/* Related pages skeleton */}
      <section className="glass rounded-3xl p-6">
        <Skeleton height="24px" width="180px" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <Skeleton height="16px" width="70%" />
              <Skeleton height="12px" width="50%" className="mt-1" />
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
