import AsyncStorage from "@react-native-async-storage/async-storage";

export const DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY =
  "available_deliveries_cache";

export function buildDriverScopedCacheKey(baseKey, userId) {
  const normalizedBase = String(baseKey || "").trim();
  const normalizedUserId = String(userId || "default").trim() || "default";
  return `${normalizedBase}:${normalizedUserId}`;
}

export async function getCurrentUserIdForCache() {
  return (await AsyncStorage.getItem("userId")) || "default";
}

export async function getCurrentDriverScopedCacheKey(baseKey) {
  const userId = await getCurrentUserIdForCache();
  return buildDriverScopedCacheKey(baseKey, userId);
}

export async function clearDriverRequestCaches(userId) {
  const scopedKey = buildDriverScopedCacheKey(
    DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
    userId,
  );

  await AsyncStorage.multiRemove([
    DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
    scopedKey,
  ]);
}
