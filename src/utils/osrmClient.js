const OSRM_BASE_URLS = [
  "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-foot",
];

const DISTANCE_CACHE_TTL_MS = 30 * 1000;
const distanceCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toPointKey = (point) =>
  `${Number(point?.longitude).toFixed(6)},${Number(point?.latitude).toFixed(6)}`;

const getCachedDistance = (cacheKey) => {
  const cached = distanceCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > DISTANCE_CACHE_TTL_MS) {
    distanceCache.delete(cacheKey);
    return null;
  }
  return cached.value;
};

const setCachedDistance = (cacheKey, value) => {
  distanceCache.set(cacheKey, {
    value,
    timestamp: Date.now(),
  });
};

const fetchJsonWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const approximateDistanceMeters = (from, to) => {
  if (!from || !to) return Infinity;

  const fromLat = Number(from.latitude);
  const fromLng = Number(from.longitude);
  const toLat = Number(to.latitude);
  const toLng = Number(to.longitude);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return Infinity;
  }

  const latMeters = 111320;
  const avgLatRad = ((fromLat + toLat) / 2) * (Math.PI / 180);
  const lngMeters = 111320 * Math.cos(avgLatRad);
  const dLat = (toLat - fromLat) * latMeters;
  const dLng = (toLng - fromLng) * lngMeters;
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

export const fetchOSRMRoute = async ({
  from,
  to,
  profile = "foot",
  timeoutMs = 10000,
  retries = 2,
  retryDelayMs = 700,
  overview = "full",
  geometries = "geojson",
}) => {
  if (!from || !to) return null;

  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    for (const baseUrl of OSRM_BASE_URLS) {
      const url = `${baseUrl}/route/v1/${profile}/${coordinates}?overview=${overview}&geometries=${geometries}&steps=false`;
      const data = await fetchJsonWithTimeout(url, timeoutMs);

      if (data?.code === "Ok" && data?.routes?.[0]) {
        return data.routes[0];
      }
    }

    if (attempt < retries) {
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  return null;
};

export const fetchOSRMDistanceMeters = async ({
  from,
  to,
  profile = "foot",
  timeoutMs = 8000,
  retries = 1,
}) => {
  const cacheKey = `${profile}:${toPointKey(from)}:${toPointKey(to)}`;
  const cached = getCachedDistance(cacheKey);
  if (Number.isFinite(cached)) {
    return cached;
  }

  const route = await fetchOSRMRoute({
    from,
    to,
    profile,
    timeoutMs,
    retries,
    overview: "false",
    geometries: "geojson",
  });

  if (!route || !Number.isFinite(route.distance)) {
    return null;
  }

  setCachedDistance(cacheKey, route.distance);
  return route.distance;
};
