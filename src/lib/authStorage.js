import AsyncStorage from "@react-native-async-storage/async-storage";

let secureStoreModule = null;
let secureStoreAvailabilityChecked = false;
let authStorageShimInstalled = false;
let secureStoreInitErrorMessage = null;

const rawAsyncStorage = {
  getItem: AsyncStorage.getItem.bind(AsyncStorage),
  setItem: AsyncStorage.setItem.bind(AsyncStorage),
  removeItem: AsyncStorage.removeItem.bind(AsyncStorage),
  multiGet: AsyncStorage.multiGet.bind(AsyncStorage),
  multiSet: AsyncStorage.multiSet.bind(AsyncStorage),
  multiRemove: AsyncStorage.multiRemove.bind(AsyncStorage),
};

function getSecureStore() {
  if (secureStoreAvailabilityChecked) {
    return secureStoreModule;
  }

  secureStoreAvailabilityChecked = true;

  try {
    // Lazy-load to avoid crashing app startup when dev client APK
    // was built without expo-secure-store native module.
    const candidate = require("expo-secure-store");
    if (
      candidate &&
      typeof candidate.getItemAsync === "function" &&
      typeof candidate.setItemAsync === "function" &&
      typeof candidate.deleteItemAsync === "function"
    ) {
      secureStoreModule = candidate;
    }
  } catch (error) {
    secureStoreModule = null;
    secureStoreInitErrorMessage =
      error && typeof error.message === "string"
        ? error.message
        : "expo-secure-store module not available in this native build";
  }

  return secureStoreModule;
}

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";
const USER_ID_KEY = "userId";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";
const PROFILE_COMPLETED_KEY = "profileCompleted";
const SESSION_META_KEY = "authSessionMeta";

function getSecureStoreOptions(secureStore) {
  if (!secureStore) return {};

  const options = {
    keychainService: "nearme.auth.session",
  };

  if (secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY) {
    options.keychainAccessible =
      secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;
  }

  return options;
}

function parseJwtExpiry(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded));
    if (!payload?.exp) return null;
    return Number(payload.exp) * 1000;
  } catch {
    return null;
  }
}

async function migrateLegacyAccessTokenFromAsyncStorage() {
  const secureStore = getSecureStore();
  if (!secureStore) return null;

  const legacyToken = await rawAsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (!legacyToken) return null;

  try {
    await secureStore.setItemAsync(
      ACCESS_TOKEN_KEY,
      String(legacyToken),
      getSecureStoreOptions(secureStore),
    );
    await rawAsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    return String(legacyToken);
  } catch {
    return String(legacyToken);
  }
}

export async function getAccessToken() {
  const secureStore = getSecureStore();

  try {
    const secureToken = secureStore
      ? await secureStore.getItemAsync(ACCESS_TOKEN_KEY)
      : null;
    if (secureToken) return secureToken;
  } catch {
    // Ignore secure store read failures and fallback to AsyncStorage.
  }

  const migratedToken = await migrateLegacyAccessTokenFromAsyncStorage();
  if (migratedToken) return migratedToken;

  return rawAsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function setAccessToken(token) {
  if (!token) return;

  const secureStore = getSecureStore();

  try {
    if (secureStore) {
      await secureStore.setItemAsync(
        ACCESS_TOKEN_KEY,
        String(token),
        getSecureStoreOptions(secureStore),
      );
    } else {
      throw new Error("Secure store unavailable");
    }
  } catch {
    // Fallback to AsyncStorage if secure store is unavailable.
    await rawAsyncStorage.setItem(ACCESS_TOKEN_KEY, String(token));
    return;
  }

  // Remove any older token copy from AsyncStorage to reduce exposure.
  await rawAsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function clearAccessToken() {
  const secureStore = getSecureStore();
  const tasks = [rawAsyncStorage.removeItem(ACCESS_TOKEN_KEY)];

  if (secureStore) {
    tasks.push(secureStore.deleteItemAsync(ACCESS_TOKEN_KEY));
  }

  await Promise.allSettled(tasks);
}

async function setSessionMeta(session = {}) {
  const token = session?.token ? String(session.token) : "";
  const now = Date.now();
  const expiresAt = parseJwtExpiry(token);

  const meta = {
    issuedAt: now,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    role: session?.role ? String(session.role) : null,
    userId: session?.userId != null ? String(session.userId) : null,
  };

  await rawAsyncStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
}

export async function persistAuthSession(session = {}, options = {}) {
  const writes = [];

  if (session.token) {
    await setAccessToken(session.token);
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
    await rawAsyncStorage.multiSet(writes);
  }

  await setSessionMeta(session);

  // Remove legacy refresh token if it exists from older app builds.
  await rawAsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function clearAuthSession() {
  await clearAccessToken();
  await rawAsyncStorage.multiRemove([
    REFRESH_TOKEN_KEY,
    ROLE_KEY,
    USER_ID_KEY,
    USER_NAME_KEY,
    USER_EMAIL_KEY,
    PROFILE_COMPLETED_KEY,
    SESSION_META_KEY,
  ]);
}

export function initializeAuthStorage() {
  if (authStorageShimInstalled) return;
  authStorageShimInstalled = true;

  AsyncStorage.getItem = async (key, ...rest) => {
    if (key === ACCESS_TOKEN_KEY) {
      return getAccessToken();
    }

    if (key === REFRESH_TOKEN_KEY) {
      return null;
    }

    return rawAsyncStorage.getItem(key, ...rest);
  };

  AsyncStorage.setItem = async (key, value, ...rest) => {
    if (key === ACCESS_TOKEN_KEY) {
      await setAccessToken(value);
      return null;
    }

    if (key === REFRESH_TOKEN_KEY) {
      await rawAsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      return null;
    }

    return rawAsyncStorage.setItem(key, value, ...rest);
  };

  AsyncStorage.removeItem = async (key, ...rest) => {
    if (key === ACCESS_TOKEN_KEY) {
      await clearAccessToken();
      return null;
    }

    if (key === REFRESH_TOKEN_KEY) {
      const secureStore = getSecureStore();
      await rawAsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      if (secureStore) {
        await secureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
      }
      return null;
    }

    return rawAsyncStorage.removeItem(key, ...rest);
  };

  AsyncStorage.multiSet = async (keyValuePairs = [], ...rest) => {
    const passthroughPairs = [];

    for (const pair of keyValuePairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [key, value] = pair;

      if (key === ACCESS_TOKEN_KEY) {
        await setAccessToken(value);
        continue;
      }

      if (key === REFRESH_TOKEN_KEY) {
        await rawAsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        continue;
      }

      passthroughPairs.push([key, value]);
    }

    if (passthroughPairs.length === 0) {
      return null;
    }

    return rawAsyncStorage.multiSet(passthroughPairs, ...rest);
  };

  AsyncStorage.multiGet = async (keys = [], ...rest) => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return [];
    }

    const resultMap = new Map();
    const passthroughKeys = [];

    for (const key of keys) {
      if (key === ACCESS_TOKEN_KEY) {
        resultMap.set(key, await getAccessToken());
      } else if (key === REFRESH_TOKEN_KEY) {
        resultMap.set(key, null);
      } else {
        passthroughKeys.push(key);
      }
    }

    if (passthroughKeys.length > 0) {
      const pairs = await rawAsyncStorage.multiGet(passthroughKeys, ...rest);
      for (const [key, value] of pairs) {
        resultMap.set(key, value);
      }
    }

    return keys.map((key) => [key, resultMap.get(key) ?? null]);
  };

  AsyncStorage.multiRemove = async (keys = [], ...rest) => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return null;
    }

    const passthroughKeys = [];
    let shouldClearToken = false;

    for (const key of keys) {
      if (key === ACCESS_TOKEN_KEY) {
        shouldClearToken = true;
        continue;
      }

      if (key === REFRESH_TOKEN_KEY) {
        continue;
      }

      passthroughKeys.push(key);
    }

    if (shouldClearToken) {
      await clearAccessToken();
    }

    if (passthroughKeys.length === 0) {
      return null;
    }

    return rawAsyncStorage.multiRemove(passthroughKeys, ...rest);
  };
}

export function getAuthStorageDiagnostics() {
  const secureStore = getSecureStore();

  return {
    secureStoreAvailable: Boolean(secureStore),
    secureStoreAvailabilityChecked,
    authStorageShimInstalled,
    secureStoreInitErrorMessage,
  };
}
