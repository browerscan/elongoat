"use client";

import { Skeleton } from "./Skeleton";

/**
 * Content skeleton for page-level content loading.
 *
 * Provides placeholder UI for blog posts, articles, and Q&A content.
 */
export function ContentSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <Skeleton height="36px" width="90%" className="mb-4" />
      <Skeleton height="24px" width="60%" className="mb-8" />

      {/* Content paragraph skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton
            key={i}
            height="16px"
            width={i % 3 === 0 ? "80%" : "100%"}
          />
        ))}
      </div>

      {/* Subsection skeleton */}
      <div className="mt-8 space-y-3">
        <Skeleton height="28px" width="40%" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              height="16px"
              width={i % 2 === 0 ? "90%" : "100%"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Card skeleton for question cards and similar content.
 */
export function CardSkeleton(): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="space-y-3">
        <Skeleton height="20px" width="85%" />
        <Skeleton height="14px" width="60%" />
      </div>
    </div>
  );
}

/**
 * List of card skeletons - useful for Q&A lists.
 */
export function CardListSkeleton({
  count = 6,
}: {
  count?: number;
}): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Video card skeleton for the videos page.
 */
export function VideoCardSkeleton(): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Thumbnail skeleton */}
      <Skeleton
        variant="rounded"
        width="100%"
        height="180px"
        className="rounded-t-2xl rounded-b-none"
      />

      <div className="p-4 space-y-3">
        <Skeleton height="18px" width="95%" />
        <Skeleton height="14px" width="70%" />
      </div>
    </div>
  );
}

/**
 * Grid of video card skeletons.
 */
export function VideoGridSkeleton({
  count = 6,
}: {
  count?: number;
}): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Topic list skeleton for the topics page.
 */
export function TopicListSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton height="32px" width="200px" />
        <Skeleton height="36px" width="100px" variant="rounded" />
      </div>

      {/* List items */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton variant="circle" width="32px" height="32px" />
              <Skeleton height="16px" width={String(150 + i * 10) + "px"} />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton height="20px" width="40px" />
              <Skeleton height="20px" width="40px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Header skeleton for page headers.
 */
export function PageHeaderSkeleton(): JSX.Element {
  return (
    <div className="mb-8 space-y-4">
      <Skeleton height="40px" width="70%" className="max-w-md" />
      <Skeleton height="20px" width="50%" className="max-w-sm" />
    </div>
  );
}

/**
 * X post skeleton for the X monitor page.
 */
export function XPostSkeleton(): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex gap-3">
        <Skeleton variant="circle" width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton height="16px" width="100px" />
            <Skeleton height="14px" width="60px" />
          </div>
          <div className="space-y-2">
            <Skeleton height="16px" width="100%" />
            <Skeleton height="16px" width="95%" />
            <Skeleton height="16px" width="80%" />
          </div>
          <div className="flex gap-4 pt-2">
            <Skeleton height="16px" width="40px" />
            <Skeleton height="16px" width="40px" />
            <Skeleton height="16px" width="40px" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading spinner component for general use.
 */
export function LoadingSpinner({
  size = "md",
  text,
}: {
  size?: "sm" | "md" | "lg";
  text?: string;
}): JSX.Element {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className={
          "animate-spin rounded-full border-2 border-white/20 border-t-white " +
          sizeClasses[size]
        }
        role="status"
        aria-label={text || "Loading"}
      />
      {text && (
        <span className="text-sm text-white/60" aria-live="polite">
          {text}
        </span>
      )}
    </div>
  );
}

/**
 * AI Brief skeleton - matches the AI content section styling.
 */
export function AIBriefSkeleton(): JSX.Element {
  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton height="24px" width="80px" />
        <Skeleton height="16px" width="100px" />
      </div>
      <div className="mt-4 space-y-4">
        {/* TL;DR section */}
        <div className="space-y-2">
          <Skeleton height="20px" width="60px" />
          <div className="ml-4 space-y-1.5">
            <Skeleton height="14px" width="95%" />
            <Skeleton height="14px" width="88%" />
            <Skeleton height="14px" width="72%" />
          </div>
        </div>

        {/* Main content paragraphs */}
        <div className="space-y-3">
          <Skeleton height="18px" width="200px" />
          <div className="space-y-1.5">
            <Skeleton height="14px" width="100%" />
            <Skeleton height="14px" width="97%" />
            <Skeleton height="14px" width="85%" />
          </div>
        </div>

        {/* Key angles section */}
        <div className="space-y-2">
          <Skeleton height="18px" width="180px" />
          <div className="ml-4 space-y-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height="14px" width={`${85 - i * 5}%`} />
            ))}
          </div>
        </div>

        {/* FAQ section */}
        <div className="space-y-2">
          <Skeleton height="18px" width="50px" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton height="14px" width="70%" />
                <Skeleton height="12px" width="90%" className="opacity-60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Cluster page metrics skeleton.
 */
export function MetricsSkeleton(): JSX.Element {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-3xl p-6">
          <Skeleton height="12px" width="80px" />
          <Skeleton height="32px" width="120px" className="mt-2" />
        </div>
      ))}
    </section>
  );
}

/**
 * Keywords grid skeleton.
 */
export function KeywordsGridSkeleton({
  count = 8,
}: {
  count?: number;
}): JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <Skeleton height="16px" width="80%" />
          <Skeleton height="12px" width="60%" className="mt-1" />
        </div>
      ))}
    </div>
  );
}
