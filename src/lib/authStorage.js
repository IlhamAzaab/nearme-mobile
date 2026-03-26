import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";
const USER_ID_KEY = "userId";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";
const PROFILE_COMPLETED_KEY = "profileCompleted";

export async function getAccessToken() {
  try {
    const secureToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (secureToken) return secureToken;
  } catch {
    // Ignore secure store read failures and fallback to AsyncStorage.
  }

  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function setAccessToken(token) {
  if (!token) return;

  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, String(token));
  } catch {
    // Fallback to AsyncStorage if secure store is unavailable.
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, String(token));
    return;
  }

  // Remove any older token copy from AsyncStorage to reduce exposure.
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function clearAccessToken() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
  ]);
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
    await AsyncStorage.multiSet(writes);
  }

  // Remove legacy refresh token if it exists from older app builds.
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function clearAuthSession() {
  await clearAccessToken();
  await AsyncStorage.multiRemove([
    REFRESH_TOKEN_KEY,
    ROLE_KEY,
    USER_ID_KEY,
    USER_NAME_KEY,
    USER_EMAIL_KEY,
    PROFILE_COMPLETED_KEY,
  ]);
}
