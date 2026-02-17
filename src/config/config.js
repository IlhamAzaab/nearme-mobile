// App-wide configuration
import { API_URL, ENABLE_LOGGING } from './env';

const config = {
  API_URL,
  ENABLE_LOGGING,
  APP_NAME: 'NearMe',
  VERSION: '1.0.0',

  // Timeouts
  REQUEST_TIMEOUT: 15000,
  LOCATION_TIMEOUT: 10000,

  // Map defaults
  DEFAULT_LATITUDE: 0,
  DEFAULT_LONGITUDE: 0,
  DEFAULT_ZOOM: 14,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,

  // Socket / Realtime
  SOCKET_RECONNECT_INTERVAL: 5000,
  SOCKET_MAX_RETRIES: 10,

  // Delivery
  DELIVERY_RADIUS_KM: 15,
  ETA_REFRESH_INTERVAL: 30000,

  // Notifications
  NOTIFICATION_POLL_INTERVAL: 60000,
};

export default config;
