/**
 * Response Compression and ETag Support
 *
 * Provides utilities for:
 * - Gzip/Brotli compression detection
 * - ETag generation for conditional requests
 * - If-None-Match handling
 * - Data compression/decompression using zlib
 */

import { createHash } from "crypto";
import { promisify } from "util";
import { gzip, gunzip, deflate, inflate } from "zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

// ============================================================================
// Types
// ============================================================================

export type CompressionEncoding = "gzip" | "br" | "deflate" | "identity";

export type CompressionMethod = "gzip" | "deflate";

export interface CompressionOptions {
  minSize?: number; // Minimum size in bytes to compress (default: 1024)
  compressibleTypes?: string[]; // MIME types to compress
  method?: CompressionMethod; // Compression method (default: gzip)
  level?: number; // Compression level 0-9 (default: 6)
}

export interface ETagResult {
  etag: string;
  weak: boolean;
}

export interface CompressedData {
  compressed: Buffer;
  method: CompressionMethod;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIN_SIZE = 1024; // 1KB

const DEFAULT_COMPRESSIBLE_TYPES = [
  "text/html",
  "text/css",
  "text/javascript",
  "text/xml",
  "text/plain",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/rss+xml",
  "application/atom+xml",
  "image/svg+xml",
];

// ============================================================================
// Compression Detection
// ============================================================================

/**
 * Parse Accept-Encoding header and return preferred encoding
 */
export function getPreferredEncoding(
  acceptEncoding: string | null,
): CompressionEncoding {
  if (!acceptEncoding) {
    return "identity";
  }

  const encodings = acceptEncoding
    .toLowerCase()
    .split(",")
    .map((e) => {
      const [encoding, qValue] = e.trim().split(";q=");
      return {
        encoding: encoding.trim(),
        q: qValue ? parseFloat(qValue) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  // Prefer brotli > gzip > deflate
  for (const { encoding, q } of encodings) {
    if (q === 0) continue;

    if (encoding === "br") return "br";
    if (encoding === "gzip") return "gzip";
    if (encoding === "deflate") return "deflate";
  }

  return "identity";
}

/**
 * Check if a content type is compressible
 */
export function isCompressible(
  contentType: string | null,
  customTypes?: string[],
): boolean {
  if (!contentType) return false;

  const types = customTypes ?? DEFAULT_COMPRESSIBLE_TYPES;
  const baseType = contentType.split(";")[0].trim().toLowerCase();

  return types.some((type) => baseType === type || baseType.startsWith(type));
}

/**
 * Check if content should be compressed based on size and type
 */
export function shouldCompress(
  contentType: string | null,
  contentLength: number,
  options: CompressionOptions = {},
): boolean {
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE;

  if (contentLength < minSize) {
    return false;
  }

  return isCompressible(contentType, options.compressibleTypes);
}

// ============================================================================
// ETag Generation
// ============================================================================

/**
 * Generate a strong ETag from content
 */
export function generateETag(content: string | Buffer): ETagResult {
  const hash = createHash("md5");
  hash.update(content);
  const digest = hash.digest("hex");

  return {
    etag: '"' + digest + '"',
    weak: false,
  };
}

/**
 * Generate a weak ETag from content metadata (faster, less precise)
 */
export function generateWeakETag(
  size: number,
  mtime: number | Date,
): ETagResult {
  const timestamp = mtime instanceof Date ? mtime.getTime() : mtime;
  const sizeHex = size.toString(16);
  const timeHex = timestamp.toString(16);
  const hash = sizeHex + "-" + timeHex;

  return {
    etag: 'W/"' + hash + '"',
    weak: true,
  };
}

/**
 * Generate ETag from JSON object
 */
export function generateJsonETag(data: unknown): ETagResult {
  const json = JSON.stringify(data);
  return generateETag(json);
}

// ============================================================================
// Conditional Request Handling
// ============================================================================

/**
 * Check if ETag matches If-None-Match header
 */
export function etagMatches(etag: string, ifNoneMatch: string | null): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  // Handle wildcard
  if (ifNoneMatch === "*") {
    return true;
  }

  // Parse multiple ETags
  const clientEtags = ifNoneMatch
    .split(",")
    .map((e) => e.trim())
    .map((e) => {
      // Remove weak indicator for comparison
      if (e.startsWith("W/")) {
        return e.slice(2);
      }
      return e;
    });

  // Compare (weak comparison - ignore W/ prefix)
  const serverEtag = etag.startsWith("W/") ? etag.slice(2) : etag;

  return clientEtags.includes(serverEtag);
}

/**
 * Create a 304 Not Modified response
 */
export function createNotModifiedResponse(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Add compression and ETag headers to a Response
 */
export function withCompressionHeaders(
  response: Response,
  options: {
    etag?: string;
    vary?: string[];
    cacheControl?: string;
  } = {},
): Response {
  const headers = new Headers(response.headers);

  if (options.etag) {
    headers.set("ETag", options.etag);
  }

  // Add Vary header for proper caching with compression
  const varyHeaders = ["Accept-Encoding", ...(options.vary ?? [])];
  headers.set("Vary", varyHeaders.join(", "));

  if (options.cacheControl) {
    headers.set("Cache-Control", options.cacheControl);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create a JSON response with ETag support
 */
export function jsonWithETag<T>(
  data: T,
  ifNoneMatch: string | null,
  options: {
    status?: number;
    cacheControl?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  const json = JSON.stringify(data);
  const { etag } = generateETag(json);

  // Check for 304
  if (etagMatches(etag, ifNoneMatch)) {
    return createNotModifiedResponse(etag);
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    ETag: etag,
    Vary: "Accept-Encoding",
    ...(options.headers ?? {}),
  });

  if (options.cacheControl) {
    headers.set("Cache-Control", options.cacheControl);
  }

  return new Response(json, {
    status: options.status ?? 200,
    headers,
  });
}

// ============================================================================
// Data Compression/Decompression
// ============================================================================

/**
 * Compress data using gzip or deflate
 * @param data - String or Buffer to compress
 * @param options - Compression options
 * @returns Compressed data with metadata
 */
export async function compress(
  data: string | Buffer,
  options: CompressionOptions = {},
): Promise<CompressedData> {
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const originalSize = input.length;
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE;

  // Skip compression for small data
  if (originalSize < minSize) {
    return {
      compressed: input,
      method: "gzip",
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
    };
  }

  const method = options.method ?? "gzip";
  const level = options.level ?? 6;

  let compressed: Buffer;
  if (method === "gzip") {
    compressed = await gzipAsync(input, { level });
  } else {
    compressed = await deflateAsync(input, { level });
  }

  const compressedSize = compressed.length;
  const ratio = originalSize > 0 ? compressedSize / originalSize : 1;

  // If compression didn't help, return original
  if (compressedSize >= originalSize) {
    return {
      compressed: input,
      method: "gzip",
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
    };
  }

  return {
    compressed,
    method,
    originalSize,
    compressedSize,
    ratio,
  };
}

/**
 * Decompress data that was compressed with compress()
 * @param data - Compressed Buffer
 * @param method - Compression method used (default: gzip)
 * @returns Decompressed Buffer
 */
export async function decompress(
  data: Buffer,
  method: CompressionMethod = "gzip",
): Promise<Buffer> {
  // Check if data might be uncompressed (first few bytes magic numbers)
  const isGzip = data[0] === 0x1f && data[1] === 0x8b;
  const isDeflate = !isGzip && (data[0] & 0x0f) === 0x08;

  // If no compression signature detected, return as-is
  if (!isGzip && !isDeflate) {
    return data;
  }

  if (method === "gzip" || isGzip) {
    return await gunzipAsync(data);
  } else {
    return await inflateAsync(data);
  }
}

/**
 * Compress a string for storage (returns base64 for JSON compatibility)
 * @param data - String to compress
 * @param options - Compression options
 * @returns Object with compressed data and metadata
 */
export async function compressForStorage(
  data: string,
  options: CompressionOptions = {},
): Promise<{
  data: string; // base64 encoded compressed data
  method: CompressionMethod;
  compressed: boolean;
}> {
  const result = await compress(data, options);

  // If no actual compression occurred, return original
  if (result.ratio >= 1) {
    return {
      data,
      method: "gzip",
      compressed: false,
    };
  }

  return {
    data: result.compressed.toString("base64"),
    method: result.method,
    compressed: true,
  };
}

/**
 * Decompress data from storage (handles base64 encoding)
 * @param data - Compressed base64 string or raw string
 * @param method - Compression method used
 * @returns Decompressed string
 */
export async function decompressFromStorage(
  data: string,
  method: CompressionMethod = "gzip",
): Promise<string> {
  // Try to detect if data is base64 encoded
  const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(data) && data.length > 100;

  if (!isBase64) {
    // Likely not compressed
    return data;
  }

  try {
    const buffer = Buffer.from(data, "base64");
    const decompressed = await decompress(buffer, method);
    return decompressed.toString("utf-8");
  } catch {
    // If decompression fails, return original
    return data;
  }
}
