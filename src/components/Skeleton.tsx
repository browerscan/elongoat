import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visual variant of the skeleton
   */
  variant?: "default" | "circle" | "rounded";
  /**
   * Width of the skeleton (CSS value)
   */
  width?: string;
  /**
   * Height of the skeleton (CSS value)
   */
  height?: string;
  /**
   * When true, animation is paused
   */
  static?: boolean;
}

/**
 * Base skeleton loading component.
 *
 * Uses a shimmer animation to indicate content is loading.
 * Matches the dark theme of ElonGoat.
 *
 * @example
 * ```tsx
 * <Skeleton variant="circle" width={40} height={40} />
 * <Skeleton variant="rounded" width="100%" height={200} />
 * ```
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = "default",
      width,
      height,
      static: isStatic = false,
      className = "",
      style,
      ...rest
    },
    ref,
  ) => {
    const baseClasses = [
      "shimmer-skeleton",
      "bg-white/10",
      !isStatic && "animate-shimmer",
    ];

    const variantClasses: Record<string, string> = {
      default: "rounded-md",
      rounded: "rounded-xl",
      circle: "rounded-full",
    };

    const combinedClassName = [
      ...baseClasses,
      variantClasses[variant],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const combinedStyle = {
      width,
      height,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={combinedClassName}
        style={combinedStyle}
        role="status"
        aria-label="Loading"
        aria-busy="true"
        {...rest}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

/**
 * HOC to create a skeleton wrapper for any component.
 */
export function withSkeleton<P extends { isLoading?: boolean }>(
  Component: React.ComponentType<P>,
  SkeletonComponent: React.ComponentType,
): React.ComponentType<P & { isLoading?: boolean }> {
  return function WithSkeletonComponent(props: P & { isLoading?: boolean }) {
    const { isLoading, ...rest } = props;

    if (isLoading) {
      return <SkeletonComponent />;
    }

    return <Component {...(rest as P)} />;
  };
}
