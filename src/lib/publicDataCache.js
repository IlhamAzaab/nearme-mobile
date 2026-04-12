const cacheStore = new Map();
const inFlightStore = new Map();

function nowMs() {
  return Date.now();
}

function isFresh(entry, ttlMs) {
  if (!entry) return false;
  return nowMs() - entry.timestamp < ttlMs;
}

export function getCachedJson(key, ttlMs = 120000) {
  const entry = cacheStore.get(key);
  if (!isFresh(entry, ttlMs)) return null;
  return entry.data;
}

export function setCachedJson(key, data) {
  cacheStore.set(key, {
    data,
    timestamp: nowMs(),
  });
}

export async function fetchJsonWithCache(
  key,
  fetcher,
  { ttlMs = 120000, forceRefresh = false } = {},
) {
  if (!forceRefresh) {
    const cached = getCachedJson(key, ttlMs);
    if (cached != null) return cached;
  }

  if (inFlightStore.has(key)) {
    return inFlightStore.get(key);
  }

  const request = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setCachedJson(key, data);
      return data;
    })
    .finally(() => {
      inFlightStore.delete(key);
    });

  inFlightStore.set(key, request);
  return request;
}

export function clearCachedJson(key) {
  if (key) {
    cacheStore.delete(key);
    inFlightStore.delete(key);
    return;
  }

  cacheStore.clear();
  inFlightStore.clear();
}
