// Server-only module (import removed for backend compatibility)

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
// Circuit Breaker Registry
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  timeout: 30000,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
};

export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    circuitBreakers.set(name, new CircuitBreaker(name, fullConfig));
  }

  return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakerStats(): Record<
  string,
  CircuitBreakerStats
> {
  const stats: Record<string, CircuitBreakerStats> = {};

  for (const [name, breaker] of circuitBreakers.entries()) {
    stats[name] = breaker.getStats();
  }

  return stats;
}

export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}

export function getCircuitBreakerHealth(): {
  healthy: boolean;
  details: Record<string, { state: CircuitState; healthy: boolean }>;
} {
  const details: Record<string, { state: CircuitState; healthy: boolean }> = {};
  let healthy = true;

  for (const [name, breaker] of circuitBreakers.entries()) {
    const stats = breaker.getStats();
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
