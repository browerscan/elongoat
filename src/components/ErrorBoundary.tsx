"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import { PureComponent } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * When true, attempts to preserve child state by not unmounting on error.
   * Default: false
   */
  preserveState?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Production-grade error boundary component.
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, info) => console.error('Boundary caught:', error, info)}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends PureComponent<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to error reporting service in production
    if (process.env.NODE_ENV === "production") {
      // Integration point for error reporting services like Sentry
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
      this.logToService(error, errorInfo);
    }
  }

  private logToService(error: Error, errorInfo: ErrorInfo): void {
    // In production, send to error reporting service
    try {
      // Use native fetch to avoid dependency issues
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        url: typeof window !== "undefined" ? window.location.href : "unknown",
      };

      // Send to internal error logging endpoint
      void fetch("/api/error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
      }).catch(() => {
        // Silently fail - logging shouldn't break the app
      });
    } catch {
      // Ignore logging errors
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  retry = (): void => {
    this.reset();
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback: Fallback } = this.props;

    if (hasError && error) {
      if (Fallback) {
        return <Fallback error={error} retry={this.retry} />;
      }

      return <DefaultErrorFallback error={error} retry={this.retry} />;
    }

    return children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function DefaultErrorFallback({
  error,
  retry,
}: DefaultErrorFallbackProps): JSX.Element {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/20">
          <AlertCircle className="h-6 w-6 text-danger" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">
            Something went wrong
          </h3>
          <p className="text-sm text-white/60">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>

        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
          aria-label="Try again"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>

        {process.env.NODE_ENV === "development" && error.stack && (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-black/50 p-3 text-[10px] text-white/50">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * HOC to wrap a component with an error boundary.
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
): ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name || "Component"})`;

  return Wrapped;
}
