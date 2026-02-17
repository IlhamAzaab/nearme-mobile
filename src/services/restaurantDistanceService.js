/**
 * Restaurant Distance Service
 * Calculates distances between user and nearby restaurants
 */

import { calculateDistance } from '../utils/locationUtils';
import { getRoute } from './osrmService';

/**
 * Sort restaurants by distance from user
 * @param {Array} restaurants - Array of restaurant objects with latitude/longitude
 * @param {Object} userLocation - { latitude, longitude }
 * @returns {Array} Sorted restaurants with distance field added
 */
export const sortByDistance = (restaurants, userLocation) => {
  if (!userLocation || !restaurants?.length) return restaurants || [];

  return restaurants
    .map((restaurant) => ({
      ...restaurant,
      distance: calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        restaurant.latitude,
        restaurant.longitude
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Filter restaurants within a radius
 * @param {Array} restaurants
 * @param {Object} userLocation - { latitude, longitude }
 * @param {number} radiusKm - Radius in kilometers (default 15)
 * @returns {Array} Filtered restaurants
 */
export const filterByRadius = (restaurants, userLocation, radiusKm = 15) => {
  if (!userLocation || !restaurants?.length) return [];

  return restaurants.filter((restaurant) => {
    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      restaurant.latitude,
      restaurant.longitude
    );
    return dist <= radiusKm;
  });
};

/**
 * Get driving distance and ETA to a restaurant via OSRM
 * @param {Object} userLocation - { latitude, longitude }
 * @param {Object} restaurantLocation - { latitude, longitude }
 * @returns {Object} { distanceKm, durationMins }
 */
export const getDrivingDistance = async (userLocation, restaurantLocation) => {
  try {
    const route = await getRoute(userLocation, restaurantLocation, {
      overview: 'false',
      steps: false,
    });

    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMins: Math.ceil(route.duration / 60),
    };
  } catch (error) {
    // Fallback to straight-line distance
    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      restaurantLocation.latitude,
      restaurantLocation.longitude
    );
    return {
      distanceKm: Math.round(dist * 10) / 10,
      durationMins: Math.ceil((dist / 30) * 60), // Estimate at 30km/h
    };
  }
};

/**
 * Get distances for multiple restaurants in batch
 * @param {Object} userLocation
 * @param {Array} restaurants
 * @returns {Array} Restaurants with drivingDistance and drivingETA added
 */
export const batchGetDistances = async (userLocation, restaurants) => {
  const results = await Promise.allSettled(
    restaurants.map(async (restaurant) => {
      const { distanceKm, durationMins } = await getDrivingDistance(
        userLocation,
        { latitude: restaurant.latitude, longitude: restaurant.longitude }
      );
      return { ...restaurant, drivingDistance: distanceKm, drivingETA: durationMins };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return restaurants[index]; // Return original if failed
  });
};

/**
 * Format distance for display
 * @param {number} distanceKm
 * @returns {string}
 */
export const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

export default {
  sortByDistance,
  filterByRadius,
  getDrivingDistance,
  batchGetDistances,
  formatDistance,
};
