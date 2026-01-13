"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
  fill?: boolean;
  style?: React.CSSProperties;
}

/**
 * Lazy image component with intersection observer for performance
 * Only loads images when they enter or approach the viewport
 */
export function LazyImage({
  src,
  alt,
  width,
  height,
  className = "",
  containerClassName = "",
  priority = false,
  placeholder = "blur",
  blurDataURL,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  quality = 75,
  fill = false,
  style,
}: LazyImageProps) {
  const [isInView, setIsInView] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up intersection observer
  useEffect(() => {
    if (priority || isInView) return;

    const element = imgRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading 50px before entering viewport
      },
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setIsLoaded(true);
    setHasError(true);
  };

  // Generate default blur placeholder
  const defaultBlur =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23ffffff10'/%3E%3Crect filter='url(%23b)' width='100%25' height='100%25'/%3E%3C/svg%3E";

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 rounded-xl ${containerClassName}`}
        style={style}
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

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    ...style,
  };

  if (width) wrapperStyle.width = width;
  if (height) wrapperStyle.height = height;

  return (
    <div ref={imgRef} className={containerClassName} style={wrapperStyle}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-white/5"
          aria-hidden="true"
        />
      )}

      {/* Image */}
      {(isInView || priority) && (
        <Image
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
            isLoaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          style={{ objectFit: "cover" }}
        />
      )}
    </div>
  );
}

/**
 * Optimized avatar component with lazy loading
 */
export function LazyAvatar({
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
    <LazyImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      containerClassName="rounded-full overflow-hidden"
    />
  );
}

/**
 * Optimized cover image component
 */
export function LazyCover({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative w-full h-48 sm:h-64 md:h-80 ${className}`}>
      <LazyImage
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
