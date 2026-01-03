// Server-only module (import removed for backend compatibility)

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

// ============================================================================
// Default Retryable Error Detection
// ============================================================================

const DEFAULT_RETRYABLE_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /EHOSTUNREACH/i,
  /timeout/i,
  /fetch failed/i,
  /network/i,
  /502/,
  /503/,
  /504/,
];

function isDefaultRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    return DEFAULT_RETRYABLE_PATTERNS.some((pattern) =>
      pattern.test(error.message),
    );
  }
  return false;
}

// ============================================================================
// Retry Function
// ============================================================================

/**
 * Wraps an async function with exponential backoff retry logic
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the result or rejects with the last error
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => fetchSomething(),
 *   { maxAttempts: 3, initialDelayMs: 100 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = isDefaultRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = initialDelayMs;
  const attempts: number[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts.push(attempt);

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt or error is not retryable
      if (attempt >= maxAttempts || !retryableErrors(error)) {
        throw error;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        try {
          onRetry(attempt, error);
        } catch {
          // Ignore callback errors
        }
      }

      // Log retry attempt in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${currentDelay}ms:`,
          error instanceof Error ? error.message : String(error),
        );
      }

      // Wait before next attempt with exponential backoff
      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Wraps an async function with retry logic and returns detailed result
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns RetryResult with success status and metadata
 */
export async function withRetryVerbose<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = isDefaultRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;
  let currentDelay = initialDelayMs;
  let totalDelayMs = 0;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts++;

    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !retryableErrors(error)) {
        return {
          success: false,
          error: lastError,
          attempts,
          totalDelayMs,
        };
      }

      if (onRetry) {
        try {
          onRetry(attempt, error);
        } catch {
          // Ignore callback errors
        }
      }

      await sleep(currentDelay);
      totalDelayMs += currentDelay;
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts,
    totalDelayMs,
  };
}

/**
 * Calculate delay for a given attempt with exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number = 100,
  maxDelayMs: number = 10000,
  backoffMultiplier: number = 2,
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Retry Decorator (for class methods)
// ============================================================================

/**
 * Decorator to add retry logic to class methods
 *
 * @example
 * ```ts
 * class MyService {
 *   @Retry({ maxAttempts: 3 })
 *   async fetchData() {
 *     // ...
 *   }
 * }
 * ```
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
