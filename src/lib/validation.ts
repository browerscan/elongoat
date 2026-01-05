/**
 * Request Validation Middleware
 *
 * Provides request size limits, input sanitization, Zod schema validation,
 * and consistent validation error responses.
 */

import { z } from "zod";
import { NextRequest } from "next/server";
import { ErrorCode, createErrorResponse } from "./errors";
import type { JsonValue } from "./elongoat.types";

/* -------------------------------------------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------------------------------------------- */

/**
 * Default size limits for various request types.
 */
export const DEFAULT_SIZE_LIMITS = {
  /**
   * Maximum request body size in bytes (1MB default).
   */
  MAX_BODY_SIZE: 1024 * 1024,

  /**
   * Maximum query string length in bytes.
   */
  MAX_QUERY_LENGTH: 2048,

  /**
   * Maximum path length in bytes.
   */
  MAX_PATH_LENGTH: 512,

  /**
   * Maximum header size per header in bytes.
   */
  MAX_HEADER_SIZE: 8192,

  /**
   * Maximum number of headers.
   */
  MAX_HEADER_COUNT: 100,

  /**
   * Maximum number of query parameters.
   */
  MAX_QUERY_PARAMS: 50,
} as const;

/* -------------------------------------------------------------------------------------------------
 * Request Size Validation
 * ------------------------------------------------------------------------------------------------- */

/**
 * Size limit configuration interface.
 */
export interface SizeLimits {
  maxBodySize: number;
  maxQueryLength: number;
  maxPathLength: number;
  maxHeaderSize: number;
  maxHeaderCount: number;
  maxQueryParams: number;
}

/**
 * Result of request size validation.
 */
export interface SizeValidationResult {
  valid: boolean;
  error?: {
    code: ErrorCode;
    message: string;
    details: {
      limit: number;
      actual: number;
      type: string;
      headerName?: string;
    };
  };
}

/**
 * Validates request size limits.
 * Returns an error result if any limit is exceeded.
 */
export function validateRequestSize(
  req: NextRequest,
  limits: Partial<SizeLimits> = {},
): SizeValidationResult {
  const mergedLimits: SizeLimits = {
    maxBodySize: DEFAULT_SIZE_LIMITS.MAX_BODY_SIZE,
    maxQueryLength: DEFAULT_SIZE_LIMITS.MAX_QUERY_LENGTH,
    maxPathLength: DEFAULT_SIZE_LIMITS.MAX_PATH_LENGTH,
    maxHeaderSize: DEFAULT_SIZE_LIMITS.MAX_HEADER_SIZE,
    maxHeaderCount: DEFAULT_SIZE_LIMITS.MAX_HEADER_COUNT,
    maxQueryParams: DEFAULT_SIZE_LIMITS.MAX_QUERY_PARAMS,
    ...limits,
  };

  // Check body size (from Content-Length header if available)
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > mergedLimits.maxBodySize) {
      return {
        valid: false,
        error: {
          code: ErrorCode.REQUEST_TOO_LARGE,
          message: "Request body exceeds maximum size",
          details: {
            limit: mergedLimits.maxBodySize,
            actual: size,
            type: "body",
          },
        },
      };
    }
  }

  // Check query string length
  const queryString = req.nextUrl.search;
  if (queryString.length > mergedLimits.maxQueryLength) {
    return {
      valid: false,
      error: {
        code: ErrorCode.REQUEST_TOO_LARGE,
        message: "Query string exceeds maximum length",
        details: {
          limit: mergedLimits.maxQueryLength,
          actual: queryString.length,
          type: "query",
        },
      },
    };
  }

  // Check number of query parameters
  const queryParamCount = req.nextUrl.searchParams.size;
  if (queryParamCount > mergedLimits.maxQueryParams) {
    return {
      valid: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Too many query parameters",
        details: {
          limit: mergedLimits.maxQueryParams,
          actual: queryParamCount,
          type: "query_params",
        },
      },
    };
  }

  // Check path length
  const pathLength = req.nextUrl.pathname.length;
  if (pathLength > mergedLimits.maxPathLength) {
    return {
      valid: false,
      error: {
        code: ErrorCode.REQUEST_TOO_LARGE,
        message: "Request path exceeds maximum length",
        details: {
          limit: mergedLimits.maxPathLength,
          actual: pathLength,
          type: "path",
        },
      },
    };
  }

  // Check header count and sizes
  let headerCount = 0;
  req.headers.forEach((value, key) => {
    headerCount++;
    if (headerCount > mergedLimits.maxHeaderCount) {
      return; // Already over limit
    }

    // Check individual header size
    const headerSize = key.length + value.length;
    if (headerSize > mergedLimits.maxHeaderSize) {
      return; // Over size limit
    }
  });

  // Re-check count
  if (headerCount > mergedLimits.maxHeaderCount) {
    return {
      valid: false,
      error: {
        code: ErrorCode.REQUEST_TOO_LARGE,
        message: "Too many headers",
        details: {
          limit: mergedLimits.maxHeaderCount,
          actual: headerCount,
          type: "headers",
        },
      },
    };
  }

  // Check individual header sizes
  let oversizedHeaderResult: { name: string; size: number } | null = null;
  req.headers.forEach((value, key) => {
    if (oversizedHeaderResult !== null) return; // Already found one
    const headerSize = key.length + value.length;
    if (headerSize > mergedLimits.maxHeaderSize) {
      oversizedHeaderResult = { name: key, size: headerSize };
    }
  });

  if (oversizedHeaderResult !== null) {
    const headerSize = (oversizedHeaderResult as { name: string; size: number })
      .size;
    const headerName = (oversizedHeaderResult as { name: string; size: number })
      .name;
    const details: {
      limit: number;
      actual: number;
      type: string;
      headerName?: string;
    } = {
      limit: mergedLimits.maxHeaderSize,
      actual: headerSize,
      type: "header",
    };
    if (headerName) {
      details.headerName = headerName;
    }
    return {
      valid: false,
      error: {
        code: ErrorCode.REQUEST_TOO_LARGE,
        message: "Header exceeds maximum size",
        details,
      },
    };
  }

  return { valid: true };
}

/**
 * Middleware that validates request size and returns an error response if limits are exceeded.
 */
export function withSizeLimit(
  handler: (req: NextRequest) => Promise<Response>,
  limits?: Partial<SizeLimits>,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    const sizeValidation = validateRequestSize(req, limits);

    if (!sizeValidation.valid && sizeValidation.error) {
      return Response.json(
        createErrorResponse(
          sizeValidation.error.code,
          sizeValidation.error.message,
          sizeValidation.error.details,
        ),
        {
          status: 413,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return handler(req);
  };
}

/* -------------------------------------------------------------------------------------------------
 * Input Sanitization
 * ------------------------------------------------------------------------------------------------- */

/**
 * Patterns for detecting potential injection attacks.
 */
const SANITIZATION_PATTERNS = [
  // SQL injection patterns
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|CREATE|TRUNCATE)\s+/gi,
  /(--)|(;)|(\/\*)|(\*\/)/g,
  /\bOR\s+.*=.*\b/gi,

  // XSS patterns
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onload=, etc.

  // Command injection
  /[;&|`$()]/g,

  // Path traversal
  /\.\.[\/\\]/g,
] as const;

/**
 * Sanitization options.
 */
export interface SanitizationOptions {
  /**
   * Whether to trim whitespace.
   */
  trim?: boolean;

  /**
   * Maximum string length.
   */
  maxLength?: number;

  /**
   * Whether to check for injection patterns.
   */
  checkInjection?: boolean;

  /**
   * Whether to remove HTML tags.
   */
  stripHtml?: boolean;

  /**
   * Whether to normalize whitespace.
   */
  normalizeWhitespace?: boolean;
}

/**
 * Default sanitization options.
 */
const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  trim: true,
  checkInjection: true,
  stripHtml: true,
  normalizeWhitespace: true,
};

/**
 * Result of input sanitization.
 */
export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  detectedPatterns?: string[];
}

/**
 * Sanitizes a string input to prevent injection attacks.
 * Returns the sanitized string and whether modifications were made.
 */
export function sanitizeString(
  input: string,
  options: SanitizationOptions = {},
): SanitizationResult {
  const opts = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };
  let result = input;
  let wasModified = false;
  const detectedPatterns: string[] = [];

  // Trim whitespace
  if (opts.trim && result !== result.trim()) {
    result = result.trim();
    wasModified = true;
  }

  // Apply max length
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.slice(0, opts.maxLength);
    wasModified = true;
  }

  // Check for injection patterns
  if (opts.checkInjection) {
    for (const pattern of SANITIZATION_PATTERNS) {
      if (pattern.test(result)) {
        detectedPatterns.push(pattern.source);
        // Remove detected patterns
        result = result.replace(pattern, "");
        wasModified = true;
      }
    }
  }

  // Strip HTML tags
  if (opts.stripHtml) {
    const htmlTagRegex = /<[^>]*>/g;
    if (htmlTagRegex.test(result)) {
      result = result.replace(htmlTagRegex, "");
      wasModified = true;
    }
  }

  // Normalize whitespace
  if (opts.normalizeWhitespace) {
    const normalized = result.replace(/\s+/g, " ").trim();
    if (normalized !== result) {
      result = normalized;
      wasModified = true;
    }
  }

  return {
    sanitized: result,
    wasModified,
    detectedPatterns:
      detectedPatterns.length > 0 ? detectedPatterns : undefined,
  };
}

/**
 * Sanitizes an object's string values recursively.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options?: SanitizationOptions,
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value, options).sanitized;
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeString(item, options).sanitized;
        } else if (typeof item === "object" && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, options);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Checks if a string contains potential injection patterns.
 */
export function containsInjectionPatterns(input: string): boolean {
  for (const pattern of SANITIZATION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

/**
 * Gets detected injection pattern descriptions.
 */
export function getDetectedPatterns(input: string): string[] {
  const patterns: string[] = [];

  if (/<script[^>]*>.*?<\/script>/gi.test(input)) {
    patterns.push("Script tag injection");
  }
  if (/javascript:/gi.test(input)) {
    patterns.push("JavaScript protocol");
  }
  if (/on\w+\s*=/gi.test(input)) {
    patterns.push("Event handler injection");
  }
  if (/[;&|`$()]/g.test(input)) {
    patterns.push("Command injection characters");
  }
  if (/\.\.[\/\\]/g.test(input)) {
    patterns.push("Path traversal attempt");
  }
  if (/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\s+/gi.test(input)) {
    patterns.push("SQL injection pattern");
  }

  return patterns;
}

/* -------------------------------------------------------------------------------------------------
 * Zod Schema Validation
 * ------------------------------------------------------------------------------------------------- */

/**
 * Validation result for schema validation.
 */
export interface SchemaValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validates data against a Zod schema.
 * Returns a structured result with detailed error information.
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): SchemaValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    success: false,
    errors,
  };
}

/**
 * Middleware that validates request body against a Zod schema.
 */
export function withSchemaValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, data: T) => Promise<Response>,
  options?: {
    sanitize?: boolean;
    sanitizationOptions?: SanitizationOptions;
  },
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    try {
      // Parse request body
      const body = await req.json().catch(() => ({}));

      // Optionally sanitize input
      const dataToValidate = options?.sanitize
        ? sanitizeObject(
            body as Record<string, unknown>,
            options.sanitizationOptions,
          )
        : body;

      // Validate against schema
      const validation = validateSchema(schema, dataToValidate);

      if (!validation.success) {
        return Response.json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Request validation failed",
            validation.errors
              ? ({ errors: validation.errors } as JsonValue)
              : undefined,
          ),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return handler(req, validation.data!);
    } catch (error) {
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return Response.json(
          createErrorResponse(
            ErrorCode.INVALID_JSON,
            "Invalid JSON in request body",
          ),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      throw error; // Re-throw for error handler middleware
    }
  };
}

/* -------------------------------------------------------------------------------------------------
 * Common Validation Schemas
 * ------------------------------------------------------------------------------------------------- */

/**
 * Common validation schemas for API inputs.
 */
export const commonSchemas = {
  /**
   * UUID schema.
   */
  uuid: z.string().uuid(),

  /**
   * Email schema.
   */
  email: z.string().email(),

  /**
   * URL schema.
   */
  url: z.string().url(),

  /**
   * Slug schema (kebab-case).
   */
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Must be kebab-case (lowercase letters, numbers, hyphens)",
    ),

  /**
   * Pagination schema.
   */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),

  /**
   * ISO date string schema.
   */
  isoDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date format (YYYY-MM-DD)"),

  /**
   * ISO datetime string schema.
   */
  isoDateTime: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/,
      "Must be ISO 8601 datetime format",
    ),

  /**
   * Sanitized string schema (custom refinement).
   */
  safeString: z
    .string()
    .max(10_000)
    .refine(
      (val) => !containsInjectionPatterns(val),
      "String contains potentially dangerous content",
    ),

  /**
   * Request ID header schema.
   */
  requestId: z.string().optional(),

  /**
   * Trace ID header schema.
   */
  traceId: z.string().optional(),
} as const;

/**
 * Request query schemas.
 */
export const querySchemas = {
  /**
   * Common query parameters.
   */
  common: z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional(),
  }),

  /**
   * Search query parameters.
   */
  search: z.object({
    q: z.string().min(1).max(500),
    limit: z.coerce.number().int().positive().max(100).default(20),
    page: z.coerce.number().int().positive().default(1),
  }),
} as const;

/* -------------------------------------------------------------------------------------------------
 * Combined Middleware
 * ------------------------------------------------------------------------------------------------- */

/**
 * Combines multiple validation middleware.
 * Applies size limits, sanitization, and schema validation in order.
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (req: NextRequest, data: T) => Promise<Response>,
  options?: {
    sizeLimits?: Partial<SizeLimits>;
    sanitize?: boolean;
    sanitizationOptions?: SanitizationOptions;
  },
): (req: NextRequest) => Promise<Response> {
  const withLimit = withSizeLimit(
    async (req: NextRequest): Promise<Response> => {
      return withSchemaValidation(schema, handler, options)(req);
    },
    options?.sizeLimits,
  );

  return withLimit;
}

/**
 * Validates query parameters against a schema.
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  req: NextRequest,
): SchemaValidationResult<T> {
  // Convert URLSearchParams to plain object
  const queryObj: Record<string, unknown> = {};
  for (const [key, value] of Array.from(req.nextUrl.searchParams.entries())) {
    // Handle multiple values for same key
    if (queryObj[key] !== undefined) {
      if (Array.isArray(queryObj[key])) {
        (queryObj[key] as unknown[]).push(value);
      } else {
        queryObj[key] = [queryObj[key] as string, value];
      }
    } else {
      queryObj[key] = value;
    }
  }

  return validateSchema(schema, queryObj);
}

/* -------------------------------------------------------------------------------------------------
 * Validation Error Response Builder
 * ------------------------------------------------------------------------------------------------- */

/**
 * Creates a consistent validation error response.
 */
export function validationErrorResponse(
  errors: Array<{ path: string; message: string; code?: string }>,
): Response {
  return Response.json(
    createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      "Request validation failed",
      { errors },
    ),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

/**
 * Creates a detailed validation error response from Zod error.
 */
export function zodValidationErrorResponse(zodError: z.ZodError): Response {
  const errors = zodError.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return validationErrorResponse(errors);
}
