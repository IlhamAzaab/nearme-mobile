// Environment Configuration
const ENV = {
  development: {
    // For Android emulator, use 10.0.2.2 to refer to host machine
    // For physical device or iOS simulator, replace with your machine's IP (e.g., 192.168.x.x)
    API_URL: 'http://192.168.37.44:5000',
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
