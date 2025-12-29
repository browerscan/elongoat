import "server-only";

import { z } from "zod";

// ============================================================================
// Configuration
// ============================================================================

const MAX_STRING_LENGTH = 10_000;
const MAX_TEXT_LENGTH = 100_000;
const MAX_URL_LENGTH = 2048;
const MAX_EMAIL_LENGTH = 320;
const MAX_SLUG_LENGTH = 255;

// Control characters that should be removed (except common whitespace)
const CONTROL_CHARS = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g;

// ============================================================================
// Types
// ============================================================================

export interface SanitizeOptions {
  maxLength?: number;
  removeControlChars?: boolean;
  trim?: boolean;
  collapseWhitespace?: boolean;
  removeHtml?: boolean;
  escapeHtml?: boolean;
}

export interface SanitizeResult<T = string> {
  value: T;
  wasModified: boolean;
  errors: string[];
}

// ============================================================================
// String Sanitization
// ============================================================================

/**
 * Sanitize a string input with configurable options
 */
export function sanitizeString(
  input: unknown,
  options: SanitizeOptions = {},
): SanitizeResult {
  const errors: string[] = [];
  let wasModified = false;
  let value: string;

  // Handle non-string input
  if (typeof input !== "string") {
    if (input === null || input === undefined) {
      return {
        value: "",
        wasModified: true,
        errors: ["Input was null/undefined"],
      };
    }
    value = String(input);
    wasModified = true;
  } else {
    value = input;
  }

  const originalValue = value;

  // Apply trim
  if (options.trim !== false) {
    value = value.trim();
    if (value !== originalValue) wasModified = true;
  }

  // Remove control characters (except \n, \r, \t)
  if (options.removeControlChars !== false) {
    value = value.replace(CONTROL_CHARS, "");
    if (
      value.length !==
      originalValue.length -
        [...originalValue].filter((c) => CONTROL_CHARS.test(c)).length
    ) {
      wasModified = true;
    }
  }

  // Collapse whitespace
  if (options.collapseWhitespace) {
    value = value.replace(/\s+/g, " ");
    if (value !== originalValue.replace(/\s+/g, " ")) wasModified = true;
  }

  // Remove HTML tags
  if (options.removeHtml) {
    const beforeLength = value.length;
    value = value.replace(/<[^>]*>/g, "");
    if (value.length !== beforeLength) wasModified = true;
  }

  // Escape HTML entities
  if (options.escapeHtml) {
    const beforeHtml = value;
    value = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
    if (value !== beforeHtml) wasModified = true;
  }

  // Apply max length
  const maxLength = options.maxLength ?? MAX_STRING_LENGTH;
  if (value.length > maxLength) {
    value = value.slice(0, maxLength);
    wasModified = true;
    errors.push(`Input truncated to ${maxLength} characters`);
  }

  return { value, wasModified, errors };
}

/**
 * Sanitize user-provided text (like chat messages, comments)
 * Preserves whitespace but removes dangerous content
 */
export function sanitizeText(input: unknown): SanitizeResult {
  return sanitizeString(input, {
    maxLength: MAX_TEXT_LENGTH,
    removeControlChars: true,
    trim: true,
    collapseWhitespace: false,
    escapeHtml: true,
  });
}

/**
 * Sanitize a slug/URL path segment
 */
export function sanitizeSlug(input: unknown): SanitizeResult {
  const result = sanitizeString(input, {
    maxLength: MAX_SLUG_LENGTH,
    removeControlChars: true,
    trim: true,
    collapseWhitespace: true,
  });

  // Additional slug-specific sanitization
  let value = result.value;
  const originalValue = value;

  // Remove any characters that aren't URL-safe
  value = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (value !== originalValue) {
    result.wasModified = true;
    result.value = value;
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(value)) {
    result.errors.push("Slug contains invalid characters");
  }

  return result;
}

/**
 * Sanitize a URL
 */
export function sanitizeUrl(input: unknown): SanitizeResult<string | null> {
  const result = sanitizeString(input, {
    maxLength: MAX_URL_LENGTH,
    removeControlChars: true,
    trim: true,
    collapseWhitespace: true,
  });

  const value = result.value;

  // Validate URL format
  try {
    const url = new URL(value);
    // Only allow http/https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        value: null,
        wasModified: true,
        errors: ["Only HTTP/HTTPS URLs are allowed"],
      };
    }
    // Prevent javascript: and data: URLs
    if (value.startsWith("javascript:") || value.startsWith("data:")) {
      return {
        value: null,
        wasModified: true,
        errors: ["Dangerous URL protocol detected"],
      };
    }
    return {
      value: url.href,
      wasModified: result.wasModified,
      errors: result.errors,
    };
  } catch {
    return {
      value: null,
      wasModified: true,
      errors: ["Invalid URL format"],
    };
  }
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(input: unknown): SanitizeResult<string | null> {
  const result = sanitizeString(input, {
    maxLength: MAX_EMAIL_LENGTH,
    removeControlChars: true,
    trim: true,
    collapseWhitespace: true,
  });

  const value = result.value.toLowerCase();

  // Basic email validation (more permissive than RFC, but practical)
  const emailRegex =
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

  if (!emailRegex.test(value)) {
    return {
      value: null,
      wasModified: result.wasModified,
      errors: [...result.errors, "Invalid email format"],
    };
  }

  return { value, wasModified: result.wasModified, errors: result.errors };
}

// ============================================================================
// SQL Injection Prevention
// ============================================================================

/**
 * Detect potential SQL injection in input
 * @returns true if input appears to contain SQL injection patterns
 */
export function detectSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION)\b)/gi,
    /(--)|(#)|(\/\*)|(\*\/)/g,
    /(\bOR\b|\bAND\b)\s+\w+\s*[=<>]/gi,
    /'.*'\s*=\s*'.*'/gi,
    /1\s*=\s*1/gi,
    /\bxp_cmdshell\b/gi,
    /\bsp_executesql\b/gi,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize input for use in SQL queries
 * Note: This does NOT replace parameterized queries!
 * Always use parameterized queries as the primary defense.
 */
export function sanitizeForSql(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove block comment start
    .replace(/\*\//g, "") // Remove block comment end
    .slice(0, 1000); // Limit length
}

/**
 * Escape identifiers for use in PostgreSQL queries
 * Only use when dynamic table/column names are unavoidable
 * Prefer parameterized queries with static identifiers
 */
export function escapePostgresIdentifier(identifier: string): string {
  // Remove any non-allowed characters
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, "");
  // Wrap in double quotes (Postgres identifier quoting)
  return `"${cleaned.replace(/"/g, '""')}"`;
}

// ============================================================================
// XSS Prevention
// ============================================================================

/**
 * Detect potential XSS (Cross-Site Scripting) patterns
 */
export function detectXss(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gis,
    /<iframe[^>]*>.*?<\/iframe>/gis,
    /<object[^>]*>.*?<\/object>/gis,
    /<embed[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /<img[^>]+src[^>]*>/gi,
    /<link[^>]*>/gi,
    /<style[^>]*>.*?<\/style>/gis,
    /@import/gi,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(input: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Sanitize HTML to allow only safe tags
 * This is a basic implementation - for production, consider using a library like DOMPurify
 */
export function sanitizeHtml(input: string): string {
  // Define allowed tags and attributes
  const allowedTags = new Set([
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "a",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
  ]);

  // Remove all tags that aren't allowed
  const result = input.replace(
    /<(\/*)([a-z][a-z0-9]*)([^>]*)>/gi,
    (match, slash, tag, attrs) => {
      const lowerTag = tag.toLowerCase();
      if (allowedTags.has(lowerTag)) {
        // For allowed tags, keep them but sanitize attributes
        if (attrs) {
          // For simplicity, strip all attributes from allowed tags
          // In production, you'd want to validate individual attributes
          return `<${slash}${lowerTag}>`;
        }
        return match;
      }
      return ""; // Remove disallowed tags
    },
  );

  return escapeHtml(result);
}

// ============================================================================
// Input Validation Schemas (Zod)
// ============================================================================

/**
 * Common validation schemas
 */
export const SanitizationSchemas = {
  username: z
    .string()
    .min(1, "Username is required")
    .max(50, "Username too long")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, hyphens, and underscores",
    ),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(MAX_SLUG_LENGTH, "Slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),

  email: z
    .string()
    .max(MAX_EMAIL_LENGTH, "Email too long")
    .email("Invalid email format"),

  url: z
    .string()
    .max(MAX_URL_LENGTH, "URL too long")
    .url("Invalid URL format")
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "Only HTTP/HTTPS URLs are allowed",
    ),

  message: z
    .string()
    .min(1, "Message is required")
    .max(MAX_TEXT_LENGTH, "Message too long")
    .refine(
      (msg) => !detectSqlInjection(msg),
      "Message contains invalid characters",
    )
    .refine((msg) => !detectXss(msg), "Message contains invalid content"),

  topic: z
    .string()
    .min(1, "Topic is required")
    .max(100, "Topic too long")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Topic contains invalid characters"),

  question: z
    .string()
    .min(10, "Question too short")
    .max(500, "Question too long")
    .refine(
      (q) => !detectSqlInjection(q),
      "Question contains invalid characters",
    ),

  pageSlug: z
    .string()
    .min(1, "Page slug is required")
    .max(100, "Page slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Page slug must contain only lowercase letters, numbers, and hyphens",
    ),
};

// ============================================================================
// Number Sanitization
// ============================================================================

/**
 * Sanitize numeric input to prevent injection through numeric fields
 */
export function sanitizeNumber(
  input: unknown,
  defaultValue: number = 0,
): number {
  if (typeof input === "number") {
    if (Number.isFinite(input)) {
      // Clamp to safe integer range
      return Math.max(
        Number.MIN_SAFE_INTEGER,
        Math.min(Number.MAX_SAFE_INTEGER, input),
      );
    }
    return defaultValue;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

/**
 * Sanitize integer with range limits
 */
export function sanitizeIntRange(
  input: unknown,
  min: number,
  max: number,
  defaultValue: number = 0,
): number {
  const value = sanitizeNumber(input, defaultValue);
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// Array/Object Sanitization
// ============================================================================

/**
 * Sanitize an array of strings
 */
export function sanitizeStringArray(
  input: unknown,
  options: SanitizeOptions = {},
): SanitizeResult<string[]> {
  if (!Array.isArray(input)) {
    const single = sanitizeString(input, options);
    return {
      value: single.value ? [single.value] : [],
      wasModified: true,
      errors: ["Input was not an array"],
    };
  }

  const results: string[] = [];
  const allErrors: string[] = [];
  let wasModified = false;

  for (const item of input) {
    const result = sanitizeString(item, options);
    results.push(result.value);
    if (result.wasModified) wasModified = true;
    allErrors.push(...result.errors);
  }

  return {
    value: results,
    wasModified,
    errors: allErrors,
  };
}

/**
 * Sanitize object keys and values
 */
export function sanitizeObject(
  input: unknown,
  options: SanitizeOptions = {},
): SanitizeResult<Record<string, string>> {
  if (typeof input !== "object" || input === null) {
    return {
      value: {},
      wasModified: true,
      errors: ["Input was not an object"],
    };
  }

  const result: Record<string, string> = {};
  let wasModified = false;
  const errors: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    const sanitizedKey = sanitizeSlug(key);
    const sanitizedValue = sanitizeString(value, options);

    if (sanitizedKey.value) {
      result[sanitizedKey.value] = sanitizedValue.value;
      if (sanitizedKey.wasModified || sanitizedValue.wasModified) {
        wasModified = true;
      }
      errors.push(...sanitizedKey.errors, ...sanitizedValue.errors);
    }
  }

  return { value: result, wasModified, errors };
}

// ============================================================================
// Batch Sanitization
// ============================================================================

/**
 * Sanitize multiple fields at once
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  data: T,
  fields: Partial<Record<keyof T, SanitizeOptions>>,
): SanitizeResult<Record<string, string>> {
  const result: Record<string, string> = {};
  let wasModified = false;
  const allErrors: string[] = [];

  for (const [key, options] of Object.entries(fields)) {
    const sanitizeResult = sanitizeString(data[key], options);
    result[key] = sanitizeResult.value;
    if (sanitizeResult.wasModified) wasModified = true;
    allErrors.push(...sanitizeResult.errors);
  }

  return {
    value: result,
    wasModified,
    errors: allErrors,
  };
}

// ============================================================================
// Security Headers Helper
// ============================================================================

/**
 * Get Content-Security-Policy header value
 */
export function getCspHeaderValue(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elongoat.io";
  const siteOrigin = new URL(siteUrl).origin;

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${siteOrigin}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}
