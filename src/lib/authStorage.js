import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearDriverRequestCaches } from "../utils/driverRequestCache";

let SecureStore = null;
let secureStoreModuleLoadErrorMessage = null;
try {
  SecureStore = require("expo-secure-store");
} catch (error) {
  // Native module may be missing in stale dev-client builds.
  SecureStore = null;
  secureStoreModuleLoadErrorMessage =
    error?.message || "expo-secure-store module is unavailable";
}

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";
const USER_ID_KEY = "userId";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";
const PROFILE_COMPLETED_KEY = "profileCompleted";

let secureStoreAvailabilityChecked = false;
let authStorageShimInstalled = false;
let secureStoreInitErrorMessage = null;

function getSecureStoreApi() {
  if (!SecureStore) return null;

  if (
    typeof SecureStore.getItemAsync !== "function" ||
    typeof SecureStore.setItemAsync !== "function" ||
    typeof SecureStore.deleteItemAsync !== "function"
  ) {
    return null;
  }

  return SecureStore;
}

export function initializeAuthStorage() {
  secureStoreAvailabilityChecked = true;

  const secureStore = getSecureStoreApi();
  if (secureStore) {
    authStorageShimInstalled = false;
    secureStoreInitErrorMessage = null;
    return;
  }

  // Fallback mode: AsyncStorage-only token storage.
  authStorageShimInstalled = true;
  secureStoreInitErrorMessage =
    secureStoreModuleLoadErrorMessage ||
    "SecureStore API unavailable in current native build";
}

export function getAuthStorageDiagnostics() {
  const secureStore = getSecureStoreApi();

  return {
    secureStoreAvailable: !!secureStore,
    secureStoreAvailabilityChecked,
    authStorageShimInstalled,
    secureStoreInitErrorMessage,
  };
}

export async function getAccessToken() {
  const secureStore = getSecureStoreApi();

  try {
    const secureToken = secureStore
      ? await secureStore.getItemAsync(ACCESS_TOKEN_KEY)
      : null;
    if (secureToken) return secureToken;
  } catch {
    // Ignore secure store read failures and fallback to AsyncStorage.
  }

  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function setAccessToken(token) {
  if (!token) return;

  const secureStore = getSecureStoreApi();

  try {
    if (secureStore) {
      await secureStore.setItemAsync(ACCESS_TOKEN_KEY, String(token));
    } else {
      throw new Error("SecureStore unavailable");
    }
  } catch {
    // Fallback to AsyncStorage if secure store is unavailable.
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, String(token));
    return;
  }

  // Remove any older token copy from AsyncStorage to reduce exposure.
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function clearAccessToken() {
  const secureStore = getSecureStoreApi();

  await Promise.allSettled([
    secureStore
      ? secureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
      : Promise.resolve(),
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
  ]);
}

export async function persistAuthSession(session = {}, options = {}) {
  const writes = [];

  const resolvedAccessToken =
    session.token || session.access_token || session.accessToken;

  if (resolvedAccessToken) {
    await setAccessToken(resolvedAccessToken);
  }

  if (session.role) writes.push([ROLE_KEY, String(session.role)]);
  if (session.userId != null)
    writes.push([USER_ID_KEY, String(session.userId)]);
  if (session.userName) writes.push([USER_NAME_KEY, String(session.userName)]);
  if (options.userEmail)
    writes.push([USER_EMAIL_KEY, String(options.userEmail)]);

  const profileCompleted =
    options.profileCompleted != null
      ? options.profileCompleted
      : session.profileCompleted;

  if (profileCompleted != null) {
    writes.push([PROFILE_COMPLETED_KEY, profileCompleted ? "true" : "false"]);
  }

  if (writes.length) {
    await AsyncStorage.multiSet(writes);
  }

  // Remove legacy refresh token if it exists from older app builds.
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function clearAuthSession() {
  const currentUserId = await AsyncStorage.getItem(USER_ID_KEY);

  await clearAccessToken();

  // Clear all AsyncStorage data so a different login on the same device
  // cannot hydrate stale user-specific cache (any role).
  try {
    await AsyncStorage.clear();
  } catch {
    const keys = await AsyncStorage.getAllKeys();
    if (Array.isArray(keys) && keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
  }

  await clearDriverRequestCaches(currentUserId);
}
