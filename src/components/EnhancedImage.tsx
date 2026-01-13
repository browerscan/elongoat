"use client";

import { useState, useRef, CSSProperties } from "react";
import Image from "next/image";

export interface EnhancedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
}

/**
 * Enhanced Image component with:
 * - Progressive loading with blur placeholder
 * - Fade-in animation
 * - Error handling with fallback
 * - Optimized for static export
 */
export function EnhancedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  priority = false,
  placeholder = "blur",
  blurDataURL,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  quality = 75,
}: EnhancedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate a subtle blur placeholder if none provided
  const defaultBlur =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23ffffff10'/%3E%3Crect filter='url(%23b)' width='100%25' height='100%25'/%3E%3C/svg%3E";

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 rounded-xl ${className}`}
        style={fill ? undefined : { width, height }}
      >
        <svg
          className="h-8 w-8 text-white/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const wrapperStyle: CSSProperties = {
    position: "relative",
    overflow: "hidden",
  };

  if (!fill) {
    if (width) wrapperStyle.width = width;
    if (height) wrapperStyle.height = height;
  }

  return (
    <div className={`relative ${className}`} style={wrapperStyle}>
      {isLoading && (
        <div
          className="absolute inset-0 animate-pulse bg-white/5"
          aria-hidden="true"
        />
      )}
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL || defaultBlur}
        sizes={sizes}
        quality={quality}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}

/**
 * Avatar component for user images with circle crop
 */
export function Avatar({
  src,
  alt,
  size = 40,
  className = "",
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`relative inline-block rounded-full ${className}`}>
      <EnhancedImage
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
      />
    </div>
  );
}

/**
 * Cover image component for article headers
 */
export function CoverImage({
  src,
  alt,
  priority = true,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative w-full h-48 sm:h-64 md:h-80 ${className}`}>
      <EnhancedImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </div>
  );
}
