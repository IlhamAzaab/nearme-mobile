import { API_BASE_URL } from "../constants/api";

const DEFAULT_ACTIVE_DELIVERIES_TTL_MS = 15000;
const ACTIVE_DELIVERY_STATUSES = new Set([
  "accepted",
  "picked_up",
  "on_the_way",
  "at_customer",
]);

const cacheByToken = new Map();
const inFlightByToken = new Map();

function normalizeToken(token) {
  if (typeof token !== "string") return "";
  return token.trim();
}

function resolveTtl(ttlMs) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_ACTIVE_DELIVERIES_TTL_MS;
  }

  return Math.round(n);
}

function getCacheEntry(tokenKey) {
  return cacheByToken.get(tokenKey) || null;
}

function isCacheFresh(cacheEntry, ttlMs) {
  if (!cacheEntry?.fetchedAt) return false;
  return Date.now() - cacheEntry.fetchedAt <= ttlMs;
}

function normalizeDeliveries(payload) {
  if (!Array.isArray(payload?.deliveries)) return [];
  return payload.deliveries;
}

function setCacheEntry(tokenKey, deliveries, fetchedAt = Date.now()) {
  const nextEntry = {
    deliveries: Array.isArray(deliveries) ? deliveries : [],
    fetchedAt,
  };

  cacheByToken.set(tokenKey, nextEntry);
  return nextEntry;
}

export function extractActiveDeliveryIds(deliveries = []) {
  const ids = [];
  const seen = new Set();

  for (const delivery of Array.isArray(deliveries) ? deliveries : []) {
    const status = String(delivery?.status || "")
      .trim()
      .toLowerCase();

    if (!ACTIVE_DELIVERY_STATUSES.has(status)) continue;

    const id = String(delivery?.id || delivery?.delivery_id || "").trim();
    if (!id || seen.has(id)) continue;

    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export async function fetchDriverActiveDeliveries(token, options = {}) {
  const tokenKey = normalizeToken(token);
  const ttlMs = resolveTtl(options.ttlMs);
  const includeStaleOnError = options.includeStaleOnError !== false;
  const forceRefresh = options.forceRefresh === true;

  if (!tokenKey) {
    return {
      ok: false,
      deliveries: [],
      fromCache: false,
      fetchedAt: 0,
      error: new Error("Missing driver token"),
    };
  }

  const cachedEntry = getCacheEntry(tokenKey);
  if (!forceRefresh && isCacheFresh(cachedEntry, ttlMs)) {
    return {
      ok: true,
      deliveries: cachedEntry.deliveries,
      fromCache: true,
      fetchedAt: cachedEntry.fetchedAt,
    };
  }

  const inFlight = inFlightByToken.get(tokenKey);
  if (inFlight) {
    return inFlight;
  }

  let requestPromise;
  requestPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
        headers: {
          Authorization: `Bearer ${tokenKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active deliveries (${response.status})`);
      }

      const payload = await response.json().catch(() => ({}));
      const deliveries = normalizeDeliveries(payload);
      const nextCache = setCacheEntry(tokenKey, deliveries);

      return {
        ok: true,
        deliveries,
        fromCache: false,
        fetchedAt: nextCache.fetchedAt,
      };
    } catch (error) {
      if (includeStaleOnError && cachedEntry) {
        return {
          ok: false,
          deliveries: cachedEntry.deliveries,
          fromCache: true,
          stale: true,
          fetchedAt: cachedEntry.fetchedAt,
          error,
        };
      }

      return {
        ok: false,
        deliveries: [],
        fromCache: false,
        fetchedAt: 0,
        error,
      };
    } finally {
      if (inFlightByToken.get(tokenKey) === requestPromise) {
        inFlightByToken.delete(tokenKey);
      }
    }
  })();

  inFlightByToken.set(tokenKey, requestPromise);
  return requestPromise;
}

export async function fetchDriverActiveDeliveryIds(token, options = {}) {
  const result = await fetchDriverActiveDeliveries(token, options);
  return {
    ...result,
    ids: extractActiveDeliveryIds(result.deliveries),
  };
}

export function clearDriverActiveDeliveriesCache(token) {
  const tokenKey = normalizeToken(token);
  if (tokenKey) {
    cacheByToken.delete(tokenKey);
    inFlightByToken.delete(tokenKey);
    return;
  }

  cacheByToken.clear();
  inFlightByToken.clear();
}
