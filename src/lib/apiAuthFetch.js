import { API_BASE_URL } from "../constants/api";
import { API_URL } from "../config/env";
import {
  clearAuthSession,
  getAccessToken,
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
  "/auth/verify-email",
  "/auth/verify-token",
  "/auth/verify-otp",
  "/auth/resend-verification-email",
  "/auth/check-email-verified",
];

let initialized = false;
let authFailureHandler = null;

const EXPLICIT_AUTH_FAILURE_CODES = new Set([
  "auth_token_invalid",
  "auth_token_expired",
  "invalid_token",
  "token_invalid",
  "token_expired",
]);

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

function setPlatformHeader(headers) {
  if (!headers.has("x-client-platform")) {
    headers.set("x-client-platform", "react-native");
  }
}

function isExplicitAuthFailureMessage(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("invalid or expired token") ||
    normalized.includes("jwt expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("token expired")
  );
}

async function shouldForceLogoutFor401(response) {
  try {
    const body = await response.clone().json().catch(() => null);
    const code = String(body?.code || "").trim().toLowerCase();
    const message = String(body?.message || "");
    return (
      (code && EXPLICIT_AUTH_FAILURE_CODES.has(code)) ||
      isExplicitAuthFailureMessage(message)
    );
  } catch {
    return false;
  }
}

async function onAuthFailure() {
  await clearAuthSession();
  if (typeof authFailureHandler === "function") {
    await authFailureHandler({ reason: "invalid_or_expired_token" });
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

    const shouldLogout = await shouldForceLogoutFor401(response);
    if (!shouldLogout) {
      return response;
    }

    await onAuthFailure();
    return response;
  };

  initialized = true;
}
