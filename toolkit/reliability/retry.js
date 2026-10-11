/**
 * FORKBOMB piece: retry-with-backoff
 * License: MIT
 * Snap: wrap any async fn that might flake.
 */

export async function retry(fn, { retries = 5, baseMs = 100, onRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const delay = baseMs * 2 ** attempt;
      if (typeof onRetry === "function") onRetry({ attempt, delay, error });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export default retry;
