import "server-only";

import { NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

export interface CacheHeaders {
  "Cache-Control": string;
  ETag?: string;
  "Last-Modified"?: string;
  Vary?: string;
}

export interface CacheOptions {
  /**
   * Maximum age in seconds for client caching
   */
  maxAge?: number;

  /**
   * Maximum age in seconds for shared caches (CDN, proxy)
   */
  sMaxAge?: number;

  /**
   * Time in seconds to serve stale content while revalidating
   */
  staleWhileRevalidate?: number;

  /**
   * Time in seconds to serve stale content on error
   */
  staleIfError?: number;

  /**
   * Whether the response is public (cacheable by all) or private (only client)
   */
  public?: boolean;

  /**
   * Whether cache must revalidate with origin before using stale content
   */
  mustRevalidate?: boolean;

  /**
   * Whether the resource can never be cached
   */
  noCache?: boolean;

  /**
   * Whether the resource must not be stored in any cache
   */
  noStore?: boolean;

  /**
   * Whether the response is immutable (never changes)
   */
  immutable?: boolean;

  /**
   * ETag value for conditional requests
   */
  eTag?: string;

  /**
   * Last modified date for conditional requests
   */
  lastModified?: Date | string;

  /**
   * Vary header values
   */
  vary?: string[];

  /**
   * Generate ETag automatically from response data
   */
  generateETag?: boolean;
}

// ============================================================================
// Cache-Control Header Builder
// ============================================================================

/**
 * Builds a Cache-Control header value from options.
 */
export function buildCacheControl(options: CacheOptions): string {
  const parts: string[] = [];

  if (options.noStore) {
    parts.push("no-store", "private");
    return parts.join(", ");
  }

  if (options.noCache) {
    parts.push("no-cache");
  }

  if (options.public) {
    parts.push("public");
  } else if (!options.noCache && !options.noStore) {
    parts.push("private");
  }

  if (options.maxAge !== undefined) {
    parts.push("max-age=" + String(options.maxAge));
  }

  if (options.sMaxAge !== undefined) {
    parts.push("s-maxage=" + String(options.sMaxAge));
  }

  if (options.staleWhileRevalidate !== undefined) {
    parts.push(
      "stale-while-revalidate=" + String(options.staleWhileRevalidate),
    );
  }

  if (options.staleIfError !== undefined) {
    parts.push("stale-if-error=" + String(options.staleIfError));
  }

  if (options.mustRevalidate) {
    parts.push("must-revalidate");
  }

  if (options.immutable) {
    parts.push("immutable");
  }

  return parts.join(", ");
}

// ============================================================================
// ETag Generation
// ============================================================================

/**
 * Generates a weak ETag from data.
 */
export async function generateETag(data: unknown): Promise<string> {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return 'W/"' + hashHex.slice(0, 16) + '"';
}

/**
 * Generates a simple hash-based ETag synchronously.
 */
export function generateSimpleETag(data: unknown): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'W/"' + Math.abs(hash).toString(16) + '"';
}

// ============================================================================
// Last-Modified Header
// ============================================================================

/**
 * Formats a date for the Last-Modified header.
 */
export function formatDateForHeader(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }
  return date.toUTCString();
}

// ============================================================================
// Conditional Request Helpers
// ============================================================================

/**
 * Checks if the request's If-None-Match header matches the ETag.
 */
export function checkETagMatch(request: Request, eTag: string): boolean {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (!ifNoneMatch) return false;

  // Handle multiple ETags and weak ETags
  const tags = ifNoneMatch.split(",").map((t) => t.trim());
  const eTagValue = eTag.startsWith("W/") ? eTag.slice(2) : eTag;
  const eTagValueNoQuote = eTagValue.replace(/^"/, "").replace(/"$/, "");

  for (const tag of tags) {
    if (tag === "*") return true;
    const tagValue = tag.startsWith("W/") ? tag.slice(2) : tag;
    const tagValueNoQuote = tagValue.replace(/^"/, "").replace(/"$/, "");
    if (tagValueNoQuote === eTagValueNoQuote) return true;
  }

  return false;
}

/**
 * Checks if the request's If-Modified-Since header matches the last modified date.
 */
export function checkModifiedSince(
  request: Request,
  lastModified: Date | string,
): boolean {
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;

  const modifiedDate =
    typeof lastModified === "string" ? new Date(lastModified) : lastModified;

  const ifModifiedDate = new Date(ifModifiedSince);

  return ifModifiedDate >= modifiedDate;
}

/**
 * Checks if conditional GET headers indicate the client has a fresh cache.
 */
export function isCacheFresh(
  request: Request,
  eTag?: string,
  lastModified?: Date | string,
): boolean {
  if (eTag && checkETagMatch(request, eTag)) {
    return true;
  }

  if (lastModified && checkModifiedSince(request, lastModified)) {
    return true;
  }

  return false;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates cached response headers from options.
 */
export async function createCacheHeaders(
  options: CacheOptions,
  data?: unknown,
): Promise<CacheHeaders> {
  const headers: CacheHeaders = {
    "Cache-Control": buildCacheControl(options),
  };

  // Handle ETag
  if (options.eTag) {
    headers["ETag"] = options.eTag;
  } else if (options.generateETag && data !== undefined) {
    headers["ETag"] = await generateETag(data);
  }

  // Handle Last-Modified
  if (options.lastModified) {
    headers["Last-Modified"] = formatDateForHeader(options.lastModified);
  } else if (options.generateETag && !options.eTag && data !== undefined) {
    // Use current time as Last-Modified if we're generating ETag
    headers["Last-Modified"] = formatDateForHeader(new Date());
  }

  // Handle Vary
  if (options.vary && options.vary.length > 0) {
    headers["Vary"] = options.vary.join(", ");
  }

  return headers;
}

/**
 * Wraps a NextResponse with caching headers.
 */
export async function withCacheHeaders(
  response: NextResponse,
  options: CacheOptions,
  data?: unknown,
): Promise<NextResponse> {
  const headers = await createCacheHeaders(options, data);

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      response.headers.set(key, value);
    }
  }

  return response;
}

/**
 * Creates a cached JSON response.
 */
export async function cachedResponse<T>(
  data: T,
  options: CacheOptions = {},
  status: number = 200,
): Promise<NextResponse<T>> {
  const headers = await createCacheHeaders(options, data);

  return NextResponse.json(data, {
    status,
    headers: headers as unknown as HeadersInit,
  });
}

/**
 * Creates a 304 Not Modified response for conditional GETs.
 */
export function notModifiedResponse(): NextResponse {
  return new NextResponse(null, {
    status: 304,
    headers: {
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * Handles conditional GET requests. Returns 304 if cache is fresh.
 */
export async function handleConditionalGet<T>(
  request: Request,
  data: T,
  options: CacheOptions = {},
): Promise<NextResponse<T> | Response> {
  // Generate ETag if needed
  let eTag = options.eTag;
  if (!eTag && options.generateETag !== false) {
    eTag = await generateETag(data);
  }

  // Check if cache is fresh
  if (isCacheFresh(request, eTag, options.lastModified)) {
    const headers: Record<string, string> = {
      "Cache-Control": buildCacheControl(options),
    };

    if (eTag) {
      headers["ETag"] = eTag;
    }

    if (options.lastModified) {
      headers["Last-Modified"] = formatDateForHeader(options.lastModified);
    }

    return new NextResponse(null, {
      status: 304,
      headers,
    });
  }

  // Return full response
  return cachedResponse(data, { ...options, eTag });
}

// ============================================================================
// Predefined Cache Policies
// ============================================================================

export const CachePolicies = {
  /**
   * No caching at all.
   */
  noStore: {
    noStore: true,
  } as const,

  /**
   * Revalidate on each request but allow caching.
   */
  noCache: {
    noCache: true,
  } as const,

  /**
   * Cache for 1 minute with stale while revalidate.
   */
  short: {
    maxAge: 60,
    staleWhileRevalidate: 120,
    public: true,
  } as const,

  /**
   * Cache for 5 minutes with stale while revalidate.
   */
  medium: {
    maxAge: 300,
    staleWhileRevalidate: 600,
    public: true,
  } as const,

  /**
   * Cache for 1 hour with stale while revalidate.
   */
  long: {
    maxAge: 3600,
    staleWhileRevalidate: 7200,
    public: true,
  } as const,

  /**
   * Cache for 1 day with immutable flag.
   */
  immutable: {
    maxAge: 86400,
    staleWhileRevalidate: 172800,
    immutable: true,
    public: true,
  } as const,

  /**
   * API response cache (short with revalidation).
   */
  api: {
    maxAge: 0,
    sMaxAge: 300,
    staleWhileRevalidate: 600,
    public: true,
  } as const,

  /**
   * Static assets (long cache).
   */
  static: {
    maxAge: 31536000, // 1 year
    immutable: true,
    public: true,
  } as const,
} as const;

// ============================================================================
// API Route Decorator
// ============================================================================

/**
 * Wraps an API route handler with automatic caching.
 */
export function withCache<T extends unknown[]>(
  handler: (request: Request, ...args: T) => Promise<NextResponse>,
  getDefaultOptions: () => CacheOptions | Promise<CacheOptions>,
): (request: Request, ...args: T) => Promise<NextResponse> {
  return async (request: Request, ...args: T): Promise<NextResponse> => {
    const options = await getDefaultOptions();

    // Check for conditional GET
    const ifNoneMatch = request.headers.get("if-none-match");
    const ifModifiedSince = request.headers.get("if-modified-since");

    if (ifNoneMatch || ifModifiedSince) {
      // For conditional requests, we need to execute the handler
      // to get the actual ETag/lastModified, or use pre-configured values
      if (options.eTag || options.lastModified) {
        if (isCacheFresh(request, options.eTag, options.lastModified)) {
          return notModifiedResponse();
        }
      }
    }

    // Execute the handler
    const response = await handler(request, ...args);

    // Apply cache headers
    return await withCacheHeaders(response, options);
  };
}

// ============================================================================
// Vary Header Helpers
// ============================================================================

/**
 * Common Vary header combinations.
 */
export const Vary = {
  /**
   * Vary on encoding, cookies (for personalized responses).
   */
  personalized: ["Accept-Encoding", "Cookie"],

  /**
   * Vary on encoding only (for static content).
   */
  static: ["Accept-Encoding"],

  /**
   * Vary on encoding and authorization (for authenticated endpoints).
   */
  authenticated: ["Accept-Encoding", "Authorization"],

  /**
   * Vary on encoding and user agent (for device-specific content).
   */
  device: ["Accept-Encoding", "User-Agent"],
} as const;
