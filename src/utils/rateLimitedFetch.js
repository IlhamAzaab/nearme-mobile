/**
 * Rate-Limited Fetch Utility
 *
 * Prevents "Too many requests" (429) errors by:
 * 1. Throttling requests per-endpoint (minimum gap between identical calls)
 * 2. Exponential backoff on 429 responses (retry after increasing delays)
 * 3. Global request queue to prevent burst flooding
 * 4. Request deduplication (skip if identical request is in-flight)
 *
 * IMPORTANT: Deduplication clones responses so each caller can independently
 * read the body (.json(), .text(), etc.) without "Already read" errors.
 */

// Track in-flight requests to deduplicate
const inFlightRequests = new Map();

// Track last request time per endpoint to throttle
const lastRequestTime = new Map();

// Backoff state per endpoint
const backoffState = new Map();

// Minimum gap between requests to the same endpoint (ms)
const MIN_REQUEST_GAP = 2000; // 2 seconds

// Max retries on 429
const MAX_RETRIES = 3;

// Base backoff delay (ms) — doubles each retry
const BASE_BACKOFF_DELAY = 5000;
const REQUEST_TIMEOUT_MS = 25000;
const SLOW_ENDPOINT_TIMEOUT_MS = 65000;
const DEFAULT_TRANSIENT_RETRIES = 1;
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 2000;

const SLOW_ENDPOINTS = new Set([
  "/driver/deliveries/available/v2",
  "/driver/deliveries/pickups",
  "/driver/deliveries/deliveries-route",
  "/driver/deliveries/active",
  "/driver/profile",
]);

const isTimeoutOrNetworkError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "TimeoutError" ||
    message.includes("request timeout") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch")
  );
};

export const isTransientFetchError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "TimeoutError" ||
    error?.code === "E_TIMEOUT" ||
    message.includes("request timeout") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("timeout")
  );
};

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timedOut = false;

  let timeoutId;
  const abortFromExternal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, {
        once: true,
      });
    }
  }

  try {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError" && timedOut) {
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternal);
    }
  }
}

function getTimeoutForEndpoint(endpointKey, timeoutMs) {
  if (typeof timeoutMs === "number" && timeoutMs > 0) {
    return timeoutMs;
  }

  if (SLOW_ENDPOINTS.has(endpointKey)) {
    return SLOW_ENDPOINT_TIMEOUT_MS;
  }

  return REQUEST_TIMEOUT_MS;
}

/**
 * Extract endpoint key from URL (strips query params for throttling)
 */
function getEndpointKey(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    // If not a full URL, use as-is up to '?'
    return url.split("?")[0];
  }
}

/**
 * Check if we're in a backoff period for this endpoint
 */
function isInBackoff(endpointKey) {
  const state = backoffState.get(endpointKey);
  if (!state) return false;
  if (Date.now() < state.until) return true;
  // Backoff expired, clear it
  backoffState.delete(endpointKey);
  return false;
}

/**
 * Rate-limited fetch wrapper
 *
 * @param {string} url - The URL to fetch
 * @param {object} options - Standard fetch options
 * @param {object} config - Rate limiting config
 * @param {number} config.minGap - Min ms between same-endpoint calls (default: 2000)
 * @param {boolean} config.deduplicate - Skip if same request is in-flight (default: true)
 * @param {boolean} config.retryOn429 - Retry with backoff on 429 (default: true)
 * @returns {Promise<Response>}
 */
export async function rateLimitedFetch(url, options = {}, config = {}) {
  const {
    minGap = MIN_REQUEST_GAP,
    deduplicate = true,
    retryOn429 = true,
    timeoutMs,
    transientRetries = DEFAULT_TRANSIENT_RETRIES,
    transientRetryDelayMs = DEFAULT_TRANSIENT_RETRY_DELAY_MS,
  } = config;

  const endpointKey = getEndpointKey(url);
  const requestKey = `${options.method || "GET"}:${url}`;

  // 1. Check backoff
  if (isInBackoff(endpointKey)) {
    const state = backoffState.get(endpointKey);
    const waitMs = state.until - Date.now();
    console.log(
      `[RateLimiter] ⏳ Endpoint ${endpointKey} in backoff, waiting ${Math.round(waitMs / 1000)}s`,
    );
    // Wait for backoff to expire
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  // 2. Throttle: skip if called too recently
  const lastTime = lastRequestTime.get(endpointKey);
  if (lastTime) {
    const elapsed = Date.now() - lastTime;
    if (elapsed < minGap) {
      const waitMs = minGap - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // 3. Deduplicate: if an identical request is in-flight, wait for it
  //    and return a CLONED response so each caller can read the body
  if (deduplicate && inFlightRequests.has(requestKey)) {
    console.log(`[RateLimiter] ♻️ Reusing in-flight request: ${endpointKey}`);
    try {
      const cachedResult = await inFlightRequests.get(requestKey);
      // Build a fresh Response from the cached body so .json()/.text() works
      return new Response(cachedResult.body, {
        status: cachedResult.status,
        statusText: cachedResult.statusText,
        headers: cachedResult.headers,
      });
    } catch (e) {
      // If the original request failed, fall through and make a new one
    }
  }

  // 4. Execute with retry on 429
  const executeRequest = async (attempt = 0) => {
    lastRequestTime.set(endpointKey, Date.now());

    let response;
    try {
      response = await fetchWithTimeout(
        url,
        options,
        getTimeoutForEndpoint(endpointKey, timeoutMs),
      );
    } catch (error) {
      if (isTimeoutOrNetworkError(error) && attempt < transientRetries) {
        const retryDelay =
          transientRetryDelayMs + Math.floor(Math.random() * 350);
        console.warn(
          `[RateLimiter] ⚠️ transient error on ${endpointKey}, retrying in ${Math.round(retryDelay / 1000)}s`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return executeRequest(attempt + 1);
      }

      if (error?.name === "TimeoutError") {
        const timeoutError = new Error(`Request timeout for ${endpointKey}`);
        timeoutError.code = "E_TIMEOUT";
        timeoutError.endpoint = endpointKey;
        throw timeoutError;
      }

      throw error;
    }

    if (response.status === 429 && retryOn429 && attempt < MAX_RETRIES) {
      // Parse Retry-After header, or use exponential backoff
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : BASE_BACKOFF_DELAY * Math.pow(2, attempt);

      console.warn(
        `[RateLimiter] ⚠️ 429 on ${endpointKey} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s`,
      );

      // Set backoff for this endpoint
      backoffState.set(endpointKey, {
        until: Date.now() + delay,
        attempt: attempt + 1,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeRequest(attempt + 1);
    }

    // Clear backoff on successful response
    if (response.ok) {
      backoffState.delete(endpointKey);
    }

    return response;
  };

  // Execute and cache the body text so dedup callers can rebuild Response objects
  const resultPromise = executeRequest().then(async (response) => {
    // Read body once and cache it so cloned responses work
    const bodyText = await response.text();
    const cachedResult = {
      body: bodyText,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
    // Return a fresh Response for the original caller
    return cachedResult;
  });

  if (deduplicate) {
    inFlightRequests.set(requestKey, resultPromise);
  }

  try {
    const cachedResult = await resultPromise;
    return new Response(cachedResult.body, {
      status: cachedResult.status,
      statusText: cachedResult.statusText,
      headers: cachedResult.headers,
    });
  } finally {
    inFlightRequests.delete(requestKey);
  }
}

/**
 * Clear all rate limiting state (e.g., on logout)
 */
export function clearRateLimitState() {
  inFlightRequests.clear();
  lastRequestTime.clear();
  backoffState.clear();
}

export default rateLimitedFetch;
