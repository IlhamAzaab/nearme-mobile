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

const getEnvVars = () => {
  // Default to development
  const environment = process.env.NODE_ENV || "development";
  return ENV[environment] || ENV.development;
};

const config = getEnvVars();

export const API_URL = config.API_URL;
export const ENABLE_LOGGING = config.ENABLE_LOGGING;

export default config;
