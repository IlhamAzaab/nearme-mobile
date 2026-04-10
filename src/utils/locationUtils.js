/**
 * Location Utilities
 * Helper functions for geolocation calculations
 */

/**
 * Calculate distance between two coordinates using planar approximation
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const latMeters = 111320;
  const avgLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const lngMeters = 111320 * Math.cos(avgLatRad);
  const dLat = (lat2 - lat1) * latMeters;
  const dLng = (lon2 - lon1) * lngMeters;
  return Math.sqrt(dLat * dLat + dLng * dLng) / 1000;
};

/**
 * Format coordinates for display
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export const formatCoordinates = (lat, lng) => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

/**
 * Check if a coordinate is within a radius of another coordinate
 * @param {Object} center - { latitude, longitude }
 * @param {Object} point - { latitude, longitude }
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean}
 */
export const isWithinRadius = (center, point, radiusKm) => {
  const distance = calculateDistance(
    center.latitude,
    center.longitude,
    point.latitude,
    point.longitude,
  );
  return distance <= radiusKm;
};

/**
 * Get the center point of multiple coordinates
 * @param {Array} coordinates - Array of { latitude, longitude }
 * @returns {Object} { latitude, longitude }
 */
export const getCenterPoint = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return null;

  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: sum.latitude / coordinates.length,
    longitude: sum.longitude / coordinates.length,
  };
};

/**
 * Calculate bounding region for map display
 * @param {Array} coordinates - Array of { latitude, longitude }
 * @param {number} padding - Padding factor (default 1.5)
 * @returns {Object} Region object for MapView
 */
export const getBoundingRegion = (coordinates, padding = 1.5) => {
  if (!coordinates || coordinates.length === 0) return null;

  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * padding || 0.01,
    longitudeDelta: (maxLng - minLng) * padding || 0.01,
  };
};

export default {
  calculateDistance,
  formatCoordinates,
  isWithinRadius,
  getCenterPoint,
  getBoundingRegion,
};
