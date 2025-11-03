/**
 * Retry utilities with exponential backoff
 * Used for API calls that may fail temporarily
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 * Returns the result of the function or throws the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delayMs = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Log retry attempt
      console.log(`Retry attempt ${attempt}/${finalConfig.maxAttempts} after ${delayMs}ms delay. Error: ${lastError.message}`);

      // Wait before retrying
      await sleep(delayMs);

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
    }
  }

  // All attempts failed
  throw lastError || new Error('Unknown error during retry');
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry only on specific error types
 * Useful for retrying only on network errors, not on validation errors
 */
export async function retryOnSpecificErrors<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: Error) => boolean,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delayMs = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      console.log(`Retry attempt ${attempt}/${finalConfig.maxAttempts} after ${delayMs}ms delay. Error: ${lastError.message}`);

      await sleep(delayMs);
      delayMs = Math.min(delayMs * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
    }
  }

  throw lastError || new Error('Unknown error during retry');
}

/**
 * Check if error is a network error (should retry)
 */
export function isNetworkError(error: Error): boolean {
  const networkErrorMessages = [
    'network',
    'timeout',
    'fetch',
    'connection',
    'econnrefused',
    'enotfound',
    'etimedout',
  ];

  const errorMessage = error.message.toLowerCase();
  return networkErrorMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if error is a rate limit error (should retry with longer delay)
 */
export function isRateLimitError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('rate limit') || errorMessage.includes('429');
}

/**
 * Check if HTTP status code is retryable
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  // Retry on:
  // - 408: Request Timeout
  // - 429: Too Many Requests
  // - 500: Internal Server Error
  // - 502: Bad Gateway
  // - 503: Service Unavailable
  // - 504: Gateway Timeout
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  return retryableStatusCodes.includes(statusCode);
}
