/**
 * Route Cache Utility
 * Caches OSRM route results to reduce API calls
 */

const cache = new Map();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Generate a cache key from coordinates
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @returns {string}
 */
const generateKey = (origin, destination) => {
  const o = `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}`;
  const d = `${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
  return `${o}->${d}`;
};

/**
 * Get a cached route if available and not expired
 * @param {Object} origin
 * @param {Object} destination
 * @returns {Object|null} Cached route data or null
 */
export const getCachedRoute = (origin, destination) => {
  const key = generateKey(origin, destination);
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

/**
 * Store a route in cache
 * @param {Object} origin
 * @param {Object} destination
 * @param {Object} routeData
 */
export const setCachedRoute = (origin, destination, routeData) => {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  const key = generateKey(origin, destination);
  cache.set(key, {
    data: routeData,
    timestamp: Date.now(),
  });
};

/**
 * Clear route cache
 */
export const clearRouteCache = () => {
  cache.clear();
};

/**
 * Get current cache size
 * @returns {number}
 */
export const getCacheSize = () => cache.size;

export default {
  getCachedRoute,
  setCachedRoute,
  clearRouteCache,
  getCacheSize,
};
