import { Skeleton } from "../../components/Skeleton";

/**
 * Loading skeleton for Q&A index page.
 */
export default function QuestionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="glass rounded-3xl p-6">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="18px" width="70%" className="mt-2 max-w-2xl" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton height="40px" width="100px" variant="rounded" />
          <Skeleton height="40px" width="120px" variant="rounded" />
        </div>
      </div>

      {/* Custom Q&A section skeleton */}
      <section className="glass rounded-3xl p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <Skeleton height="24px" width="100px" />
            <Skeleton height="14px" width="300px" className="mt-1" />
          </div>
          <Skeleton height="12px" width="80px" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <Skeleton height="10px" width="120px" />
              <Skeleton height="16px" width="85%" className="mt-1" />
            </div>
          ))}
        </div>
      </section>

      {/* Search skeleton */}
      <div className="glass glow-ring flex items-center gap-3 rounded-2xl px-4 py-3">
        <Skeleton variant="circle" height="16px" width="16px" />
        <Skeleton height="20px" width="300px" />
        <div className="ml-auto">
          <Skeleton height="16px" width="80px" />
        </div>
      </div>

      {/* Questions grid skeleton */}
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton height="16px" width="90%" />
                <Skeleton height="12px" width="70%" className="mt-1" />
                <Skeleton height="10px" width="40%" className="mt-2" />
              </div>
              <Skeleton height="16px" width="16px" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton height="40px" width="80px" variant="rounded" />
        <Skeleton height="40px" width="40px" variant="rounded" />
        <Skeleton height="40px" width="40px" variant="rounded" />
        <Skeleton height="40px" width="40px" variant="rounded" />
        <Skeleton height="40px" width="80px" variant="rounded" />
      </div>
    </div>
  );
}
