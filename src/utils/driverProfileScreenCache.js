import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentDriverScopedCacheKey } from "./driverRequestCache";

const CACHE_PREFIX = "driver_account_profile";

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeKey(key) {
  return `${CACHE_PREFIX}:${String(key || "default").trim()}`;
}

export async function getDriverProfileScreenCache(key) {
  const scopedKey = await getCurrentDriverScopedCacheKey(normalizeKey(key));
  const raw = await AsyncStorage.getItem(scopedKey);
  const parsed = safeParse(raw);
  return parsed?.data ?? null;
}

export async function setDriverProfileScreenCache(key, data) {
  const scopedKey = await getCurrentDriverScopedCacheKey(normalizeKey(key));
  await AsyncStorage.setItem(
    scopedKey,
    JSON.stringify({
      data,
      cachedAt: Date.now(),
    }),
  );
}
