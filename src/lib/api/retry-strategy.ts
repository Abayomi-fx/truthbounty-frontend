/**
 * Retry Strategy — Exponential backoff for API requests
 *
 * Provides retry logic with exponential backoff for transient failures.
 * Never retries on terminal errors (404, 422, etc.).
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  addJitter?: boolean;
}

export interface RetryContext {
  attemptNumber: number;
  error: Error;
  totalAttempts: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  addJitter: true,
};

/**
 * Calculate delay for the next retry attempt with exponential backoff.
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  if (config.addJitter) {
    // Add jitter: randomize delay ±20%
    const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(cappedDelay + jitter);
  }

  return cappedDelay;
}

/**
 * Determine if an error should be retried.
 * Terminal errors (404, 422, user-rejected) should not be retried.
 */
export function shouldRetry(error: Error, attemptNumber: number, maxRetries: number): boolean {
  if (attemptNumber >= maxRetries) return false;

  // Don't retry on abort (user cancellation)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  // Check if error message indicates a terminal condition
  const message = error.message.toLowerCase();
  const terminalPhrases = [
    'not found',
    'does not exist',
    'has been removed',
    'rejected this request',
    'invalid',
  ];

  if (terminalPhrases.some((phrase) => message.includes(phrase))) {
    return false;
  }

  return true;
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @param onRetry - Optional callback invoked before each retry
 * @returns Promise resolving to the function's result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  onRetry?: (context: RetryContext) => void
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error = new Error('Retry failed with no error');
  let attempt = 0;

  while (attempt <= mergedConfig.maxRetries) {
    attempt++;

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!shouldRetry(lastError, attempt, mergedConfig.maxRetries)) {
        throw lastError;
      }

      // We've exhausted retries
      if (attempt > mergedConfig.maxRetries) {
        throw lastError;
      }

      // Notify before retry
      if (onRetry) {
        onRetry({
          attemptNumber: attempt,
          error: lastError,
          totalAttempts: mergedConfig.maxRetries + 1,
        });
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, mergedConfig);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for a function with consistent configuration.
 */
export function createRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: RetryConfig = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), config);
}
