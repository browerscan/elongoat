// Server-only module (import removed for backend compatibility)
import { getEnv } from "./env";

const env = getEnv();

// ============================================================================
// Types
// ============================================================================

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenMaxAttempts?: number;
}

interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

class CircuitBreaker {
  private readonly name: string;
  private readonly config: CircuitBreakerConfig;
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private halfOpenAttempts = 0;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      const now = Date.now();
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.transitionTo("half-open");
        this.halfOpenAttempts = 0;
      } else {
        throw new CircuitBreakerOpenError(
          "Circuit breaker '" + this.name + "' is open. Rejecting request.",
          this.getStats(),
        );
      }
    }

    if (
      this.state === "half-open" &&
      this.config.halfOpenMaxAttempts &&
      this.halfOpenAttempts >= this.config.halfOpenMaxAttempts
    ) {
      this.transitionTo("open");
      throw new CircuitBreakerOpenError(
        "Circuit breaker '" + this.name + "' half-open attempts exhausted.",
        this.getStats(),
      );
    }

    try {
      const result = await this.withTimeout(fn, this.config.timeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error("Operation timed out after " + timeoutMs + "ms"));
      }, timeoutMs);
    });

    const result = await Promise.race([fn(), timeoutPromise]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    return result;
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === "half-open") {
      this.transitionTo("closed");
      this.failureCount = 0;
    } else if (this.state === "closed") {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.threshold) {
      this.transitionTo("open");
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
      console.warn(
        "[CircuitBreaker:" +
          this.name +
          "] Opened after " +
          this.failureCount +
          " failures.",
      );
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      console.log(
        "[CircuitBreaker:" +
          this.name +
          "] State transition: " +
          oldState +
          " -> " +
          newState,
      );
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.halfOpenAttempts = 0;

    console.log("[CircuitBreaker:" + this.name + "] Manually reset");
  }

  forceOpen(): void {
    this.transitionTo("open");
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class CircuitBreakerOpenError extends Error {
  public readonly stats: CircuitBreakerStats;

  constructor(message: string, stats: CircuitBreakerStats) {
    super(message);
    this.name = "CircuitBreakerOpenError";
    this.stats = stats;
  }
}

// ============================================================================
// Circuit Breaker Registry with TTL Cleanup
// ============================================================================

interface CircuitBreakerEntry {
  breaker: CircuitBreaker;
  lastAccessTime: number;
}

const circuitBreakers = new Map<string, CircuitBreakerEntry>();

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  timeout: 30000,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
};

// TTL for inactive circuit breakers (default: 1 hour)
const CIRCUIT_BREAKER_TTL_MS = env.CIRCUIT_BREAKER_TTL_MS;

// Cleanup interval (default: 5 minutes)
const CIRCUIT_BREAKER_CLEANUP_INTERVAL_MS =
  env.CIRCUIT_BREAKER_CLEANUP_INTERVAL_MS;

// Maximum number of circuit breakers to prevent unbounded growth
const MAX_CIRCUIT_BREAKERS = env.MAX_CIRCUIT_BREAKERS;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Clean up stale circuit breakers that haven't been accessed within TTL
 */
function cleanupStaleCircuitBreakers(): void {
  const now = Date.now();
  const staleThreshold = now - CIRCUIT_BREAKER_TTL_MS;
  let cleanedCount = 0;

  for (const [name, entry] of circuitBreakers.entries()) {
    // Only clean up closed circuit breakers that haven't been accessed recently
    if (
      entry.lastAccessTime < staleThreshold &&
      entry.breaker.getStats().state === "closed"
    ) {
      circuitBreakers.delete(name);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0 && env.NODE_ENV === "development") {
    console.log(
      `[CircuitBreaker] Cleaned up ${cleanedCount} stale circuit breakers. Remaining: ${circuitBreakers.size}`,
    );
  }
}

/**
 * Start the cleanup interval if not already running
 */
function ensureCleanupInterval(): void {
  if (cleanupInterval === null && typeof setInterval !== "undefined") {
    cleanupInterval = setInterval(
      cleanupStaleCircuitBreakers,
      CIRCUIT_BREAKER_CLEANUP_INTERVAL_MS,
    );
    // Don't prevent Node.js from exiting
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }
}

export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  ensureCleanupInterval();

  const existing = circuitBreakers.get(name);
  if (existing) {
    // Update last access time
    existing.lastAccessTime = Date.now();
    return existing.breaker;
  }

  // Check if we've exceeded the maximum number of circuit breakers
  if (circuitBreakers.size >= MAX_CIRCUIT_BREAKERS) {
    // Force cleanup of stale entries
    cleanupStaleCircuitBreakers();

    // If still at max, remove oldest entries
    if (circuitBreakers.size >= MAX_CIRCUIT_BREAKERS) {
      const entries = Array.from(circuitBreakers.entries()).sort(
        (a, b) => a[1].lastAccessTime - b[1].lastAccessTime,
      );
      // Remove oldest 10% of entries
      const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
      for (let i = 0; i < toRemove; i++) {
        circuitBreakers.delete(entries[i][0]);
      }
      console.warn(
        `[CircuitBreaker] Exceeded max circuit breakers (${MAX_CIRCUIT_BREAKERS}), removed ${toRemove} oldest entries`,
      );
    }
  }

  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const breaker = new CircuitBreaker(name, fullConfig);
  circuitBreakers.set(name, {
    breaker,
    lastAccessTime: Date.now(),
  });

  return breaker;
}

export function getAllCircuitBreakerStats(): Record<
  string,
  CircuitBreakerStats
> {
  const stats: Record<string, CircuitBreakerStats> = {};

  for (const [name, entry] of circuitBreakers.entries()) {
    stats[name] = entry.breaker.getStats();
  }

  return stats;
}

export function resetAllCircuitBreakers(): void {
  for (const entry of circuitBreakers.values()) {
    entry.breaker.reset();
  }
}

export function getCircuitBreakerHealth(): {
  healthy: boolean;
  details: Record<string, { state: CircuitState; healthy: boolean }>;
} {
  const details: Record<string, { state: CircuitState; healthy: boolean }> = {};
  let healthy = true;

  for (const [name, entry] of circuitBreakers.entries()) {
    const stats = entry.breaker.getStats();
    const isHealthy = stats.state !== "open";

    details[name] = {
      state: stats.state,
      healthy: isHealthy,
    };

    if (!isHealthy) {
      healthy = false;
    }
  }

  return { healthy, details };
}

/**
 * Stop the cleanup interval (for testing or shutdown)
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get current registry size (for monitoring)
 */
export function getCircuitBreakerCount(): number {
  return circuitBreakers.size;
}

/**
 * Force cleanup of stale circuit breakers (for testing or manual maintenance)
 */
export function forceCleanup(): number {
  const before = circuitBreakers.size;
  cleanupStaleCircuitBreakers();
  return before - circuitBreakers.size;
}
