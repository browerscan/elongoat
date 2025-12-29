import { Skeleton } from "./Skeleton";

/**
 * Chat-specific skeleton loading component.
 *
 * Displays a placeholder chat interface while content is loading.
 * Used for the initial chat load state.
 *
 * @example
 * ```tsx
 * {isLoading ? <ChatSkeleton /> : <ChatMessages />}
 * ```
 */
export function ChatSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Skeleton width="100%" height="14px" className="mb-2" />
          <Skeleton width="85%" height="14px" />
          <Skeleton width="60%" height="14px" />
        </div>
      </div>

      {/* Typing indicator */}
      <div className="flex justify-start">
        <div
          className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          role="status"
          aria-label="Assistant is typing"
        >
          <span className="flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-75" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-150" />
          </span>
          <span className="ml-2 text-xs text-white/50">Typing</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact typing indicator for inline use.
 *
 * @example
 * ```tsx
 * {isStreaming && <TypingIndicator />}
 * ```
 */
export function TypingIndicator(): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-2 text-white/65"
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
    >
      <span className="flex gap-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-75" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 delay-150" />
      </span>
      <span className="text-xs">Typing</span>
    </span>
  );
}

/**
 * Quick action button skeleton for the chat quick actions.
 */
export function ChatQuickActionSkeleton(): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          width={String(60 + i * 20) + "px"}
          height="28px"
          variant="rounded"
          className="rounded-full"
          aria-label={"Loading quick action " + String(i)}
        />
      ))}
    </div>
  );
}

/**
 * Full chat widget skeleton including header and input.
 */
export function ChatWidgetSkeleton(): JSX.Element {
  return (
    <div className="glass glow-ring w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl sm:w-[360px] md:w-[400px]">
      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton variant="circle" width="36px" height="36px" />
          <div className="min-w-0 space-y-2">
            <Skeleton width="100px" height="14px" />
            <Skeleton width="140px" height="12px" />
          </div>
        </div>
        <Skeleton variant="circle" width="32px" height="32px" />
      </div>

      {/* Content skeleton */}
      <div className="max-h-[50vh] overflow-y-auto px-3 py-3 sm:max-h-[52vh] sm:px-4 sm:py-4">
        <ChatQuickActionSkeleton />
        <div className="mt-4 space-y-3">
          <ChatSkeleton />
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t border-white/10 bg-black/30 p-2.5 sm:p-3">
        <div className="flex items-end gap-2">
          <Skeleton
            variant="rounded"
            width="100%"
            height="40px"
            className="sm:min-h-[44px]"
          />
          <Skeleton variant="circle" width="40px" height="40px" />
        </div>
      </div>
    </div>
  );
}
