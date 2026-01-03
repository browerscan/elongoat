/**
 * Structured logging utility for consistent error handling
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.error("ContentCache", "Database fetch failed", { kind, slug }, error);
 *   logger.warn("TieredCache", "L2 cache miss", { key });
 *   logger.info("RAG", "Query completed", { resultCount: 5 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  timestamp: string;
}

/**
 * Formats an error object for logging
 */
function formatError(err: unknown): LogEntry["error"] | undefined {
  if (!err) return undefined;

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    };
  }

  return {
    name: "Unknown",
    message: String(err),
  };
}

/**
 * Creates a log entry with consistent structure
 */
function createLogEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext,
  error?: unknown,
): LogEntry {
  return {
    level,
    module,
    message,
    context: context && Object.keys(context).length > 0 ? context : undefined,
    error: formatError(error),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Outputs log entry in appropriate format
 */
function output(entry: LogEntry): void {
  const prefix = `[${entry.module}]`;
  const isDev = process.env.NODE_ENV === "development";

  // In development, use human-readable format
  if (isDev) {
    const contextStr = entry.context ? " " + JSON.stringify(entry.context) : "";
    const errorStr = entry.error ? ` Error: ${entry.error.message}` : "";

    switch (entry.level) {
      case "debug":
        console.debug(`${prefix} ${entry.message}${contextStr}${errorStr}`);
        break;
      case "info":
        console.info(`${prefix} ${entry.message}${contextStr}${errorStr}`);
        break;
      case "warn":
        console.warn(`${prefix} ${entry.message}${contextStr}${errorStr}`);
        break;
      case "error":
        console.error(`${prefix} ${entry.message}${contextStr}${errorStr}`);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
    return;
  }

  // In production, use structured JSON format for log aggregation
  switch (entry.level) {
    case "debug":
      // Skip debug logs in production
      break;
    case "info":
      console.info(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    case "error":
      console.error(JSON.stringify(entry));
      break;
  }
}

/**
 * Logger singleton with methods for each log level
 */
export const logger = {
  /**
   * Debug level - only shown in development
   */
  debug(module: string, message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "development") return;
    output(createLogEntry("debug", module, message, context));
  },

  /**
   * Info level - operational information
   */
  info(module: string, message: string, context?: LogContext): void {
    output(createLogEntry("info", module, message, context));
  },

  /**
   * Warning level - recoverable issues
   */
  warn(
    module: string,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    output(createLogEntry("warn", module, message, context, error));
  },

  /**
   * Error level - failures requiring attention
   */
  error(
    module: string,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    output(createLogEntry("error", module, message, context, error));
  },

  /**
   * Creates a child logger with a fixed module name
   */
  child(module: string) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(module, message, context),
      info: (message: string, context?: LogContext) =>
        logger.info(module, message, context),
      warn: (message: string, context?: LogContext, error?: unknown) =>
        logger.warn(module, message, context, error),
      error: (message: string, context?: LogContext, error?: unknown) =>
        logger.error(module, message, context, error),
    };
  },
};

export default logger;
