import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const ROLE_KEY = "role";
const USER_ID_KEY = "userId";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";
const PROFILE_COMPLETED_KEY = "profileCompleted";

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function persistAuthSession(session = {}, options = {}) {
  const writes = [];

  if (session.token) writes.push([ACCESS_TOKEN_KEY, String(session.token)]);
  if (session.refreshToken) {
    writes.push([REFRESH_TOKEN_KEY, String(session.refreshToken)]);
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
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    ROLE_KEY,
    USER_ID_KEY,
    USER_NAME_KEY,
    USER_EMAIL_KEY,
    PROFILE_COMPLETED_KEY,
  ]);
}
