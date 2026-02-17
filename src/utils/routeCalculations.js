/**
 * Route Calculations Utility
 * Functions for calculating route metrics
 */

import { calculateDistance } from './locationUtils';

/**
 * Calculate total route distance from an array of waypoints
 * @param {Array} waypoints - Array of { latitude, longitude }
 * @returns {number} Total distance in kilometers
 */
export const calculateTotalRouteDistance = (waypoints) => {
  if (!waypoints || waypoints.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistance(
      waypoints[i].latitude,
      waypoints[i].longitude,
      waypoints[i + 1].latitude,
      waypoints[i + 1].longitude
    );
  }
  return total;
};

/**
 * Calculate estimated delivery time based on distance
 * @param {number} distanceKm
 * @param {Object} options - { avgSpeed, pickupTime, bufferTime }
 * @returns {number} Total time in minutes
 */
export const calculateDeliveryTime = (distanceKm, options = {}) => {
  const { avgSpeed = 30, pickupTime = 10, bufferTime = 5 } = options;
  const travelTime = (distanceKm / avgSpeed) * 60;
  return Math.ceil(travelTime + pickupTime + bufferTime);
};

/**
 * Calculate delivery fee based on distance
 * @param {number} distanceKm
 * @param {Object} pricing - { baseFee, perKmFee, freeDeliveryThreshold }
 * @returns {number} Delivery fee
 */
export const calculateDeliveryFee = (distanceKm, pricing = {}) => {
  const { baseFee = 30, perKmFee = 10, freeDeliveryThreshold = 0 } = pricing;

  if (distanceKm <= freeDeliveryThreshold) return 0;
  return baseFee + distanceKm * perKmFee;
};

/**
 * Decode an OSRM-encoded polyline into coordinates
 * @param {string} encoded - Encoded polyline string
 * @returns {Array} Array of { latitude, longitude }
 */
export const decodePolyline = (encoded) => {
  if (!encoded) return [];

  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

/**
 * Get the bearing between two points
 * @param {Object} start - { latitude, longitude }
 * @param {Object} end - { latitude, longitude }
 * @returns {number} Bearing in degrees
 */
export const getBearing = (start, end) => {
  const startLat = (start.latitude * Math.PI) / 180;
  const startLng = (start.longitude * Math.PI) / 180;
  const endLat = (end.latitude * Math.PI) / 180;
  const endLng = (end.longitude * Math.PI) / 180;

  const dLng = endLng - startLng;

  const x = Math.sin(dLng) * Math.cos(endLat);
  const y =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

export default {
  calculateTotalRouteDistance,
  calculateDeliveryTime,
  calculateDeliveryFee,
  decodePolyline,
  getBearing,
};
