// Environment Configuration
const RENDER_API_URL = "https://meezo-backend-d3gw.onrender.com";
const DEV_API_URL = process.env.EXPO_PUBLIC_API_URL || RENDER_API_URL;

const ENV = {
  development: {
    // Use explicit env override when provided; otherwise default to Render backend.
    API_URL: DEV_API_URL,
    ENABLE_LOGGING: true,
  },
  staging: {
    API_URL: RENDER_API_URL,
    ENABLE_LOGGING: true,
  },
  production: {
    API_URL: RENDER_API_URL,
    ENABLE_LOGGING: false,
  },
};

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function getExpoExtra() {
  return Constants?.expoConfig?.extra || {};
}

const getEnvVars = () => {
  const environment = process.env.NODE_ENV || "development";
  const defaults = ENV[environment] || ENV.development;
  const extra = getExpoExtra();

  const apiUrl =
    process.env.API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    extra.API_URL ||
    defaults.API_URL;

  const enableLogging = parseBoolean(
    process.env.ENABLE_LOGGING ?? extra.ENABLE_LOGGING,
    defaults.ENABLE_LOGGING,
  );

  return {
    API_URL: normalizeUrl(apiUrl),
    ENABLE_LOGGING: enableLogging,
  };
};

const config = getEnvVars();

export const API_URL = config.API_URL;
export const ENABLE_LOGGING = config.ENABLE_LOGGING;

export default config;
