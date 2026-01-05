import { getEnv } from "./env";
import type { JsonValue } from "./elongoat.types";

const env = getEnv();
/**
 * Production-Grade Error Handling System
 *
 * Provides standardized error classes, error codes, and consistent
 * error response formatting for API routes.
 */
/* -------------------------------------------------------------------------------------------------
 * Error Codes Enum
 * ------------------------------------------------------------------------------------------------- */

/**
 * Standard error codes for categorizing and handling errors.
 * Format: <SERVICE>_<ERROR_TYPE>[_DETAIL]
 */
export enum ErrorCode {
  // Generic errors (1000-1999)
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",

  // Validation errors (2000-2999)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_JSON = "INVALID_JSON",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",
  OUT_OF_RANGE = "OUT_OF_RANGE",
  CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",

  // Authentication/Authorization (3000-3999)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  EXPIRED_TOKEN = "EXPIRED_TOKEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Database errors (4000-4999)
  DATABASE_ERROR = "DATABASE_ERROR",
  DATABASE_CONNECTION_FAILED = "DATABASE_CONNECTION_FAILED",
  DATABASE_QUERY_FAILED = "DATABASE_QUERY_FAILED",
  DATABASE_TIMEOUT = "DATABASE_TIMEOUT",
  RECORD_NOT_FOUND = "RECORD_NOT_FOUND",
  DUPLICATE_RECORD = "DUPLICATE_RECORD",
  CONSTRAINT_VIOLATION_DB = "CONSTRAINT_VIOLATION_DB",

  // AI Provider errors (5000-5999)
  AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR",
  AI_PROVIDER_UNAVAILABLE = "AI_PROVIDER_UNAVAILABLE",
  AI_PROVIDER_TIMEOUT = "AI_PROVIDER_TIMEOUT",
  AI_RATE_LIMITED = "AI_RATE_LIMITED",
  AI_INVALID_RESPONSE = "AI_INVALID_RESPONSE",
  AI_QUOTA_EXCEEDED = "AI_QUOTA_EXCEEDED",

  // Cache errors (6000-6999)
  CACHE_ERROR = "CACHE_ERROR",
  CACHE_CONNECTION_FAILED = "CACHE_CONNECTION_FAILED",
  CACHE_MISS = "CACHE_MISS",

  // External service errors (7000-7999)
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  EXTERNAL_SERVICE_UNAVAILABLE = "EXTERNAL_SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_TIMEOUT = "EXTERNAL_SERVICE_TIMEOUT",

  // Rate limiting (8000-8999)
  RATE_LIMITED = "RATE_LIMITED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Request errors (9000-9999)
  REQUEST_TOO_LARGE = "REQUEST_TOO_LARGE",
  INVALID_CONTENT_TYPE = "INVALID_CONTENT_TYPE",
  MISSING_HEADER = "MISSING_HEADER",
}

/* -------------------------------------------------------------------------------------------------
 * Error Code to HTTP Status Mapping
 * ------------------------------------------------------------------------------------------------- */

const ERROR_CODE_STATUS_MAP: Readonly<Record<ErrorCode, number>> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.OUT_OF_RANGE]: 400,
  [ErrorCode.CONSTRAINT_VIOLATION]: 400,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.EXPIRED_TOKEN]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ErrorCode.RECORD_NOT_FOUND]: 404,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.AI_RATE_LIMITED]: 429,

  // 413 Payload Too Large
  [ErrorCode.REQUEST_TOO_LARGE]: 413,

  // 415 Unsupported Media Type
  [ErrorCode.INVALID_CONTENT_TYPE]: 415,

  // 500 Internal Server Error
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,

  // 502 Bad Gateway
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 502,
  [ErrorCode.AI_PROVIDER_UNAVAILABLE]: 502,

  // 503 Service Unavailable
  [ErrorCode.DATABASE_CONNECTION_FAILED]: 503,
  [ErrorCode.CACHE_CONNECTION_FAILED]: 503,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 503,
  [ErrorCode.DATABASE_ERROR]: 503,

  // 504 Gateway Timeout
  [ErrorCode.DATABASE_TIMEOUT]: 504,
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: 504,
  [ErrorCode.AI_PROVIDER_TIMEOUT]: 504,

  // Other
  [ErrorCode.AI_PROVIDER_ERROR]: 500,
  [ErrorCode.AI_INVALID_RESPONSE]: 502,
  [ErrorCode.AI_QUOTA_EXCEEDED]: 429,
  [ErrorCode.CACHE_ERROR]: 500,
  [ErrorCode.CACHE_MISS]: 404,
  [ErrorCode.DATABASE_QUERY_FAILED]: 500,
  [ErrorCode.DUPLICATE_RECORD]: 409,
  [ErrorCode.CONSTRAINT_VIOLATION_DB]: 409,
  [ErrorCode.MISSING_HEADER]: 400,
} as const;

/**
 * Maps error codes to appropriate HTTP status codes.
 */
export function getHttpStatusForErrorCode(code: ErrorCode): number {
  return ERROR_CODE_STATUS_MAP[code] ?? 500;
}

/* -------------------------------------------------------------------------------------------------
 * Base Error Classes
 * ------------------------------------------------------------------------------------------------- */

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Readonly<JsonValue>;
  public readonly cause?: Readonly<Error>;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: JsonValue,
    cause?: Error,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = getHttpStatusForErrorCode(code);
    this.details = details;
    this.cause = cause;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Converts the error to a JSON-serializable object.
   */
  toJSON(): AppErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      // Only include cause in development
      ...(env.NODE_ENV === "development" && this.cause
        ? { cause: this.cause.message }
        : {}),
    };
  }

  /**
   * Converts the error to a standard API error response.
   */
  toApiResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details as JsonValue }),
      },
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }
}

/**
 * JSON representation of an AppError.
 */
export interface AppErrorJSON {
  name: string;
  code: ErrorCode;
  message: string;
  details?: Readonly<JsonValue>;
  statusCode: number;
  timestamp: string;
  cause?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Specialized Error Classes
 * ------------------------------------------------------------------------------------------------- */

/**
 * Validation error for invalid user input.
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: JsonValue, cause?: Error) {
    super(message, ErrorCode.VALIDATION_ERROR, details, cause);
  }

  /**
   * Creates a ValidationError from Zod parse errors.
   */
  static fromZodError(error: {
    errors: Array<{ path: Array<string | number>; message: string }>;
  }): ValidationError {
    const details = error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    return new ValidationError("Validation failed", details);
  }
}

/**
 * Database-related errors.
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DATABASE_ERROR,
    details?: JsonValue,
    cause?: Error,
  ) {
    super(message, code, details, cause);
  }

  /**
   * Creates a connection failed error.
   */
  static connectionFailed(cause?: Error): DatabaseError {
    return new DatabaseError(
      "Database connection failed",
      ErrorCode.DATABASE_CONNECTION_FAILED,
      undefined,
      cause,
    );
  }

  /**
   * Creates a query failed error.
   */
  static queryFailed(query: string, cause?: Error): DatabaseError {
    return new DatabaseError(
      "Database query failed",
      ErrorCode.DATABASE_QUERY_FAILED,
      { query: query.slice(0, 200) },
      cause,
    );
  }

  /**
   * Creates a timeout error.
   */
  static timeout(timeoutMs: number, cause?: Error): DatabaseError {
    return new DatabaseError(
      `Database query exceeded ${timeoutMs}ms timeout`,
      ErrorCode.DATABASE_TIMEOUT,
      { timeoutMs },
      cause,
    );
  }

  /**
   * Creates a not found error.
   */
  static notFound(resource: string, identifier: string): DatabaseError {
    return new DatabaseError(
      `${resource} not found`,
      ErrorCode.RECORD_NOT_FOUND,
      { resource, identifier },
    );
  }

  /**
   * Creates a duplicate record error.
   */
  static duplicate(resource: string, identifier: string): DatabaseError {
    return new DatabaseError(
      `${resource} already exists`,
      ErrorCode.DUPLICATE_RECORD,
      { resource, identifier },
    );
  }
}

/**
 * AI Provider-related errors.
 */
export class AIProviderError extends AppError {
  public readonly provider: string;

  constructor(
    message: string,
    provider: string,
    code: ErrorCode = ErrorCode.AI_PROVIDER_ERROR,
    details?: JsonValue,
    cause?: Error,
  ) {
    super(message, code, details, cause);
    this.provider = provider;
  }

  /**
   * Creates an unavailable error.
   */
  static unavailable(provider: string, cause?: Error): AIProviderError {
    return new AIProviderError(
      `${provider} service is unavailable`,
      provider,
      ErrorCode.AI_PROVIDER_UNAVAILABLE,
      undefined,
      cause,
    );
  }

  /**
   * Creates a timeout error.
   */
  static timeout(
    provider: string,
    timeoutMs: number,
    cause?: Error,
  ): AIProviderError {
    return new AIProviderError(
      `${provider} request exceeded ${timeoutMs}ms timeout`,
      provider,
      ErrorCode.AI_PROVIDER_TIMEOUT,
      { timeoutMs },
      cause,
    );
  }

  /**
   * Creates a rate limit error.
   */
  static rateLimited(provider: string, retryAfter?: number): AIProviderError {
    return new AIProviderError(
      provider + " rate limit exceeded",
      provider,
      ErrorCode.AI_RATE_LIMITED,
      retryAfter !== undefined ? { retryAfter } : undefined,
    );
  }

  /**
   * Creates an invalid response error.
   */
  static invalidResponse(
    provider: string,
    details?: JsonValue,
  ): AIProviderError {
    return new AIProviderError(
      `${provider} returned an invalid response`,
      provider,
      ErrorCode.AI_INVALID_RESPONSE,
      details,
    );
  }

  toJSON(): AppErrorJSON & { provider: string } {
    return {
      ...super.toJSON(),
      provider: this.provider,
    };
  }

  toApiResponse(): ApiErrorResponse {
    return {
      ...super.toApiResponse(),
      error: {
        ...super.toApiResponse().error,
        ...(this.details && {
          details: {
            ...(this.details as Record<string, unknown>),
            provider: this.provider,
          } as JsonValue,
        }),
      },
    };
  }
}

/**
 * Authentication/Authorization errors.
 */
export class AuthError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    details?: JsonValue,
  ) {
    super(message, code, details);
  }

  /**
   * Creates an unauthorized error.
   */
  static unauthorized(): AuthError {
    return new AuthError("Authentication required", ErrorCode.UNAUTHORIZED);
  }

  /**
   * Creates an invalid token error.
   */
  static invalidToken(): AuthError {
    return new AuthError("Invalid or expired token", ErrorCode.INVALID_TOKEN);
  }

  /**
   * Creates a forbidden error.
   */
  static forbidden(resource?: string): AuthError {
    return new AuthError(
      resource ? `Access denied to ${resource}` : "Access denied",
      ErrorCode.FORBIDDEN,
    );
  }
}

/**
 * Rate limit errors.
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = "Rate limit exceeded",
    public readonly retryAfter?: number,
    public readonly limit?: number,
    public readonly remaining?: number,
    public readonly resetAt?: Date,
  ) {
    const details: Record<string, unknown> = {};
    if (retryAfter !== undefined) details.retryAfter = retryAfter;
    if (limit !== undefined) details.limit = limit;
    if (remaining !== undefined) details.remaining = remaining;
    if (resetAt !== undefined) details.resetAt = resetAt.toISOString();

    super(
      message,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      Object.keys(details).length > 0 ? (details as JsonValue) : undefined,
    );
  }

  static create(params: {
    limit: number;
    remaining: number;
    resetSeconds: number;
  }): RateLimitError {
    return new RateLimitError(
      "Rate limit exceeded",
      params.resetSeconds,
      params.limit,
      params.remaining,
      new Date(Date.now() + params.resetSeconds * 1000),
    );
  }

  toApiResponse(): ApiErrorResponse {
    const details: Record<string, string | number> = {};
    if (this.retryAfter !== undefined) {
      details.retryAfter = this.retryAfter;
    }
    if (this.limit !== undefined) {
      details.limit = this.limit;
    }
    details.remaining = this.remaining ?? 0;
    if (this.resetAt) {
      details.resetAt = this.resetAt.toISOString();
    }
    return {
      ...super.toApiResponse(),
      error: {
        ...super.toApiResponse().error,
        details: details as JsonValue,
      },
    };
  }
}

/* -------------------------------------------------------------------------------------------------
 * API Response Types
 * ------------------------------------------------------------------------------------------------- */

/**
 * Standard API error response format.
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: JsonValue;
  };
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

/**
 * Standard API success response wrapper.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp: string;
    [key: string]: JsonValue | undefined;
  };
}

/* -------------------------------------------------------------------------------------------------
 * Error Handler Middleware
 * ------------------------------------------------------------------------------------------------- */

/**
 * Type for error handler function.
 */
export type ErrorHandler = (error: unknown, req?: Request) => Response;

/**
 * Global error handler for API routes.
 * Converts any error to a standardized JSON response.
 */
export function handleApiError(error: unknown, req?: Request): Response {
  const requestId =
    req?.headers.get("x-request-id") ?? crypto.randomUUID?.() ?? undefined;

  // Log the error for debugging
  logError(error, requestId);

  // Handle known AppError instances
  if (error instanceof AppError) {
    const response = error.toApiResponse();
    response.requestId = requestId;
    return Response.json(response, {
      status: error.statusCode,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...(error instanceof RateLimitError && error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : {}),
      },
    });
  }

  // Handle Zod errors
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const validationError = ValidationError.fromZodError(
      error as {
        errors: Array<{ path: Array<string | number>; message: string }>;
      },
    );
    const response = validationError.toApiResponse();
    response.requestId = requestId;
    return Response.json(response, {
      status: validationError.statusCode,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
    });
  }

  // Handle generic errors
  const statusCode = 500;
  const isDevelopment = env.NODE_ENV === "development";
  const message =
    isDevelopment && error instanceof Error
      ? error.message
      : "An internal error occurred";

  const response: ApiErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message,
      ...(isDevelopment && error instanceof Error
        ? {
            details: {
              stack: error.stack?.split("\n").slice(0, 5),
            } as JsonValue,
          }
        : {}),
    },
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
  };

  return Response.json(response, {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
  });
}

/**
 * Logs errors with context.
 */
function logError(error: unknown, requestId?: string): void {
  const isDevelopment = env.NODE_ENV === "development";

  if (error instanceof AppError) {
    // Log operational errors with info level
    if (error.isOperational && !isDevelopment) {
      console.info(
        `[${requestId ?? "no-request-id"}] ${error.code}: ${error.message}`,
      );
    } else {
      console.error(
        `[${requestId ?? "no-request-id"}] ${error.code}: ${error.message}`,
        error.details ?? "",
        error.cause ?? "",
      );
    }
  } else if (error instanceof Error) {
    console.error(
      `[${requestId ?? "no-request-id"}] Unhandled error: ${error.message}`,
      error.stack,
    );
  } else {
    console.error(
      `[${requestId ?? "no-request-id"}] Unknown error type:`,
      error,
    );
  }
}

/**
 * Wrapper for async route handlers to catch errors.
 */
export function withErrorHandler<T>(
  handler: (req: Request, context?: T) => Promise<Response>,
): (req: Request, context?: T) => Promise<Response> {
  return async (req: Request, context?: T): Promise<Response> => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error, req);
    }
  };
}

/* -------------------------------------------------------------------------------------------------
 * Error Utilities
 * ------------------------------------------------------------------------------------------------- */

/**
 * Checks if an error is operational (expected) vs. programming error.
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational;
}

/**
 * Creates a standardized error response from any error.
 */
export function createErrorResponse(
  code: ErrorCode,
  message?: string,
  details?: JsonValue,
): ApiErrorResponse {
  return {
    error: {
      code,
      message: message ?? getDefaultErrorMessage(code),
      details,
    },
    statusCode: getHttpStatusForErrorCode(code),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gets default error messages for error codes.
 */
function getDefaultErrorMessage(code: ErrorCode): string {
  const messages: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.VALIDATION_ERROR]: "Invalid input data",
    [ErrorCode.UNAUTHORIZED]: "Authentication required",
    [ErrorCode.FORBIDDEN]: "Access denied",
    [ErrorCode.RECORD_NOT_FOUND]: "Resource not found",
    [ErrorCode.RATE_LIMIT_EXCEEDED]: "Rate limit exceeded",
    [ErrorCode.DATABASE_ERROR]: "Database error",
    [ErrorCode.AI_PROVIDER_ERROR]: "AI service error",
    [ErrorCode.INTERNAL_ERROR]: "An internal error occurred",
  };
  return messages[code] ?? "An error occurred";
}

/**
 * Checks if an error should be retried.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return [
      ErrorCode.DATABASE_TIMEOUT,
      ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
      ErrorCode.AI_PROVIDER_TIMEOUT,
      ErrorCode.AI_RATE_LIMITED,
      ErrorCode.RATE_LIMIT_EXCEEDED,
    ].includes(error.code);
  }
  return false;
}
