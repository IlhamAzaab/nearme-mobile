import { API_BASE_URL } from "../constants/api";
import { API_URL } from "../config/env";
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  persistAuthSession,
} from "./authStorage";

const NETWORK_MESSAGES = [
  "Network request failed",
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "timeout",
  "aborted",
];

const AUTH_BYPASS_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/verify-token",
  "/auth/verify-otp",
  "/auth/refresh-token",
  "/auth/check-email-verified",
];

let initialized = false;
let authFailureHandler = null;
let refreshPromise = null;

function normalizeUrl(url) {
  if (!url) return "";
  return String(url).replace(/\/+$/, "");
}

function getBackendBaseUrls() {
  return [normalizeUrl(API_BASE_URL), normalizeUrl(API_URL)].filter(Boolean);
}

function isBackendRequest(url) {
  const normalizedUrl = String(url || "");
  return getBackendBaseUrls().some((base) =>
    normalizedUrl.toLowerCase().startsWith(base.toLowerCase()),
  );
}

function isAuthBypass(url) {
  return AUTH_BYPASS_PATHS.some((p) => String(url || "").includes(p));
}

function toRequest(input, init = {}) {
  const isRequest = typeof Request !== "undefined" && input instanceof Request;
  if (isRequest) {
    return {
      url: input.url,
      init: {
        method: init.method || input.method || "GET",
        headers: init.headers || input.headers,
        body: init.body,
      },
    };
  }

  return {
    url: String(input),
    init,
  };
}

function isNetworkError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return NETWORK_MESSAGES.some((m) => msg.includes(m.toLowerCase()));
}

function setPlatformHeader(headers) {
  if (!headers.has("x-client-platform")) {
    headers.set("x-client-platform", "react-native");
  }
}

async function refreshAccessToken(nativeFetch) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      const headers = new Headers({ "Content-Type": "application/json" });
      setPlatformHeader(headers);

      const response = await nativeFetch(
        `${normalizeUrl(API_BASE_URL)}/auth/refresh-token`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        },
      );

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      const data = await response.json();
      await persistAuthSession(data);
      return { ok: true, status: response.status };
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function onAuthFailure() {
  await clearAuthSession();
  if (typeof authFailureHandler === "function") {
    await authFailureHandler({ reason: "refresh_failed" });
  }
}

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

export function initializeApiAuthFetch() {
  if (initialized || typeof global.fetch !== "function") return;

  const nativeFetch = global.fetch.bind(global);

  global.fetch = async (input, init = {}) => {
    const { url, init: requestInit } = toRequest(input, init);

    if (!isBackendRequest(url)) {
      return nativeFetch(input, init);
    }

    const bypassAuth = isAuthBypass(url);
    const headers = new Headers(requestInit.headers || {});
    setPlatformHeader(headers);

    if (!bypassAuth) {
      const token = await getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const firstInit = {
      ...requestInit,
      headers,
    };

    let response;
    try {
      response = await nativeFetch(url, firstInit);
    } catch (error) {
      // Keep user logged in during temporary network outages.
      throw error;
    }

    if (bypassAuth || response.status !== 401) {
      return response;
    }

    try {
      const refreshResult = await refreshAccessToken(nativeFetch);
      if (!refreshResult.ok) {
        if (refreshResult.status === 401 || refreshResult.status === 403) {
          await onAuthFailure();
        }
        return response;
      }
    } catch (error) {
      if (isNetworkError(error)) {
        return response;
      }
      await onAuthFailure();
      return response;
    }

    const retryHeaders = new Headers(requestInit.headers || {});
    setPlatformHeader(retryHeaders);
    const latestToken = await getAccessToken();
    if (latestToken) {
      retryHeaders.set("Authorization", `Bearer ${latestToken}`);
    }

    return nativeFetch(url, {
      ...requestInit,
      headers: retryHeaders,
    });
  };

  initialized = true;
}
