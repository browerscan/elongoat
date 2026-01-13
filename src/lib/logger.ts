import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface StructuredError {
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  name?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  service?: string;
  timestamp?: string;
}

export interface LogContext {
  [key: string]: unknown;
}

export interface ErrorLogOptions {
  error?: Error | unknown;
  context?: LogContext;
  service?: string;
  statusCode?: number;
  errorCode?: string;
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Convert any error to a structured error object
 */
export function toStructuredError(
  error: unknown,
  context?: LogContext,
): StructuredError {
  const base: StructuredError = {
    message: "Unknown error",
    context,
  };

  if (error instanceof Error) {
    base.message = error.message;
    base.name = error.name;
    base.stack = isDev ? error.stack : undefined;

    // Extract common error properties
    if ("code" in error && typeof error.code === "string") {
      base.code = error.code;
    }
    if ("status" in error && typeof error.status === "number") {
      base.statusCode = error.status;
    }
    if ("statusCode" in error && typeof error.statusCode === "number") {
      base.statusCode = error.statusCode;
    }
    // Handle cause for nested errors
    if (error.cause) {
      base.cause = error.cause;
    }
  } else if (typeof error === "string") {
    base.message = error;
  } else if (typeof error === "object" && error !== null) {
    Object.assign(base, error);
    if (!base.message) {
      base.message = "Object error";
    }
  }

  return base;
}

/**
 * Extract safe error information for logging (removes sensitive data)
 */
export function sanitizeError(error: StructuredError): StructuredError {
  const sanitized = { ...error };

  // Remove potentially sensitive keys
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "cookie",
    "session",
  ];

  if (sanitized.context) {
    for (const key of sensitiveKeys) {
      delete sanitized.context[key];
      delete sanitized.context[key.toLowerCase()];
      delete sanitized.context[key.toUpperCase()];
    }
  }

  return sanitized;
}

/**
 * Create a log entry with error context
 */
export function createErrorLog(
  message: string,
  options: ErrorLogOptions = {},
): Record<string, unknown> {
  const { error, context, service, statusCode, errorCode } = options;

  const logEntry: Record<string, unknown> = {
    message,
    ...(service && { service }),
    ...(statusCode && { statusCode }),
    ...(errorCode && { errorCode }),
  };

  if (error) {
    const structured = toStructuredError(error, context);
    const sanitized = sanitizeError(structured);
    Object.assign(logEntry, {
      error: {
        name: sanitized.name,
        message: sanitized.message,
        code: sanitized.code,
        statusCode: sanitized.statusCode || statusCode,
        ...(sanitized.stack && { stack: sanitized.stack }),
        ...(sanitized.context && { context: sanitized.context }),
      },
    });
  } else if (context) {
    Object.assign(logEntry, { context });
  }

  return logEntry;
}

// ============================================================================
// Pino Logger Configuration
// ============================================================================

const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  base: isDev
    ? undefined
    : {
        env: process.env.NODE_ENV,
        hostname: process.env.HOSTNAME,
      },
  hooks: {
    // Add timestamp to all logs
    logMethod(inputArgs, method) {
      const timestamp = new Date().toISOString();
      if (inputArgs.length >= 1) {
        const firstArg = inputArgs[0];
        if (typeof firstArg === "object") {
          inputArgs[0] = { ...firstArg, timestamp };
        } else {
          inputArgs.unshift({ timestamp, message: firstArg });
        }
      }
      return method.apply(this, inputArgs);
    },
  },
};

const transportConfig = isDev
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname,timestamp",
          translateTime: "HH:MM:ss",
        },
      },
    }
  : {};

export const logger = pino({
  ...baseConfig,
  ...transportConfig,
});

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Log an error with structured context
 */
export function logError(message: string, options: ErrorLogOptions = {}): void {
  const logEntry = createErrorLog(message, options);
  logger.error(logEntry);
}

/**
 * Log a warning with context
 */
export function logWarning(message: string, context?: LogContext): void {
  logger.warn({ ...context, message });
}

/**
 * Log info with context
 */
export function logInfo(message: string, context?: LogContext): void {
  logger.info({ ...context, message });
}

/**
 * Log debug information
 */
export function logDebug(message: string, context?: LogContext): void {
  logger.debug({ ...context, message });
}

// ============================================================================
// Service Logger Factory
// ============================================================================

/**
 * Create a logger scoped to a specific service
 */
export function createServiceLogger(serviceName: string) {
  return {
    error: (message: string, options: Omit<ErrorLogOptions, "service"> = {}) =>
      logError(message, { ...options, service: serviceName }),
    warn: (message: string, context?: LogContext) =>
      logger.warn({ ...context, service: serviceName, message }),
    info: (message: string, context?: LogContext) =>
      logger.info({ ...context, service: serviceName, message }),
    debug: (message: string, context?: LogContext) =>
      logger.debug({ ...context, service: serviceName, message }),
  };
}

// Export the main logger for backward compatibility
export default logger;
