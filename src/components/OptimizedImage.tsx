"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";

// ============================================================================
// Types
// ============================================================================

export interface OptimizedImageProps extends Omit<ImageProps, "blurDataURL"> {
  /**
   * Whether to generate a blur placeholder automatically.
   * Uses a data URI base64 placeholder.
   */
  blur?: boolean;

  /**
   * Custom blur data URL. If not provided and blur is true,
   * a default placeholder will be used.
   */
  blurDataURL?: string;

  /**
   * Whether to fade in the image when loaded.
   */
  fadeIn?: boolean;

  /**
   * Fade in duration in milliseconds.
   */
  fadeInDuration?: number;

  /**
   * Placeholder background color while loading.
   */
  placeholderColor?: string;

  /**
   * Whether to use a skeleton loader.
   */
  skeleton?: boolean;

  /**
   * Whether to use lazy loading (default: true for non-priority images).
   */
  lazy?: boolean;

  /**
   * Alt text is required for accessibility.
   * Use empty string for purely decorative images.
   */
  alt: string;
}

// ============================================================================
// Default Blur Placeholder
// ============================================================================

/**
 * Generates a simple SVG data URI placeholder.
 */
function generateBlurPlaceholder(
  width = 10,
  height = 10,
  color = "#e5e7eb",
): string {
  const svg =
    '<svg width="' +
    width +
    '" height="' +
    height +
    '" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="' +
    color +
    '"/></svg>';
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

// ============================================================================
// Skeleton Loader Component
// ============================================================================

function ImageSkeleton({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={
        "animate-pulse bg-gray-200 dark:bg-gray-700 " + (className || "")
      }
      style={{ width, height }}
    />
  );
}

// ============================================================================
// Main Optimized Image Component
// ============================================================================

/**
 * Production-optimized Next.js Image component with:
 * - Blur placeholders
 * - Lazy loading (default for non-priority images)
 * - Async decoding for non-blocking rendering
 * - Fade-in animation
 * - Skeleton loader option
 * - Proper srcsets (handled by Next.js)
 * - WebP format support (handled by Next.js)
 */
export function OptimizedImage({
  blur = false,
  blurDataURL,
  fadeIn = true,
  fadeInDuration = 300,
  placeholderColor,
  skeleton = false,
  lazy = true,
  className = "",
  priority,
  alt,
  ...props
}: OptimizedImageProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Generate default blur placeholder if needed
  const defaultBlurDataURL =
    blurDataURL || generateBlurPlaceholder(10, 10, placeholderColor);

  // Determine if we should use blur placeholder
  const useBlur = blur && !skeleton;

  // Determine loading strategy: priority images eager load, others lazy
  const loadingStrategy = priority ? undefined : lazy ? "lazy" : undefined;

  // Handle image load
  const handleLoad = (): void => {
    setIsLoading(false);
  };

  // Handle image error
  const handleError = (): void => {
    setIsLoading(false);
    setError(true);
  };

  // Build transition class name
  let transitionClass = "";
  if (fadeIn && !isLoading) {
    transitionClass = "transition-opacity duration-" + fadeInDuration;
  }
  if (isLoading && fadeIn) {
    transitionClass = "opacity-0";
  }

  const imageClassName = [className, transitionClass].filter(Boolean).join(" ");

  return (
    <div className="relative overflow-hidden">
      {skeleton && isLoading && (
        <ImageSkeleton
          width={props.width}
          height={props.height}
          className={className}
        />
      )}

      {error && (
        <div
          className={
            "flex items-center justify-center bg-gray-100 dark:bg-gray-800 " +
            className
          }
          style={{ width: props.width, height: props.height }}
          role="img"
          aria-label={alt || "Error loading image"}
        >
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      {!error && (
        <Image
          {...props}
          alt={alt}
          placeholder={useBlur ? "blur" : "empty"}
          blurDataURL={useBlur ? defaultBlurDataURL : undefined}
          className={imageClassName}
          loading={loadingStrategy as "lazy" | undefined}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Configuration for common image types.
 */
export const ImagePresets = {
  /**
   * Avatar/user profile image.
   */
  avatar: {
    width: 40,
    height: 40,
    blur: true,
    fadeIn: true,
    className: "rounded-full",
  } as const,

  /**
   * Thumbnail image.
   */
  thumbnail: {
    width: 150,
    height: 150,
    blur: true,
    fadeIn: true,
    className: "rounded-lg",
  } as const,

  /**
   * Hero/large image.
   */
  hero: {
    fill: true,
    blur: true,
    fadeIn: true,
    priority: true,
    placeholderColor: "#f3f4f6",
    className: "object-cover",
  } as const,

  /**
   * Content image.
   */
  content: {
    fill: false,
    blur: false,
    fadeIn: true,
    skeleton: true,
    className: "rounded-lg",
  } as const,

  /**
   * Icon/logo image.
   */
  logo: {
    blur: false,
    fadeIn: false,
    priority: true,
  } as const,
} as const;

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Avatar image component.
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      blur
      fadeIn
      className={"rounded-full " + className}
    />
  );
}

/**
 * Thumbnail image component.
 */
export function ThumbnailImage({
  src,
  alt,
  width = 150,
  height = 150,
  className = "",
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}): JSX.Element {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      blur
      fadeIn
      className={"rounded-lg " + className}
    />
  );
}

/**
 * Responsive image component for content.
 */
export function ContentImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}): JSX.Element {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      blur
      fadeIn
      placeholderColor="#f3f4f6"
      className={"object-cover " + className}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
    />
  );
}

export default OptimizedImage;
