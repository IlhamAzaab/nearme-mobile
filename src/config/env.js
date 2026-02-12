// Environment Configuration
const ENV = {
  development: {
    API_URL: 'http://localhost:3000/api',
    ENABLE_LOGGING: true,
  },
  staging: {
    API_URL: 'https://staging-api.nearme.com/api',
    ENABLE_LOGGING: true,
  },
  production: {
    API_URL: 'https://api.nearme.com/api',
    ENABLE_LOGGING: false,
  },
};

const getEnvVars = () => {
  // Default to development
  const environment = process.env.NODE_ENV || 'development';
  return ENV[environment] || ENV.development;
};

const config = getEnvVars();

export const API_URL = config.API_URL;
export const ENABLE_LOGGING = config.ENABLE_LOGGING;

export default config;
