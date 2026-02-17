/**
 * Route Optimization Utility
 * Optimizes delivery routes for multiple stops
 */

import { calculateDistance } from './locationUtils';

/**
 * Optimize route order using nearest-neighbor heuristic
 * @param {Object} origin - Starting point { latitude, longitude }
 * @param {Array} stops - Array of { latitude, longitude, id, ... }
 * @returns {Array} Optimized ordered array of stops
 */
export const optimizeRouteOrder = (origin, stops) => {
  if (!stops || stops.length <= 1) return stops;

  const remaining = [...stops];
  const optimized = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDist = Infinity;

    remaining.forEach((stop, index) => {
      const dist = calculateDistance(
        current.latitude,
        current.longitude,
        stop.latitude,
        stop.longitude
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = index;
      }
    });

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    current = nearest;
  }

  return optimized;
};

/**
 * Group deliveries by zone/cluster
 * @param {Array} deliveries - Array of delivery objects with coordinates
 * @param {number} radiusKm - Clustering radius in km
 * @returns {Array} Array of delivery groups
 */
export const clusterDeliveries = (deliveries, radiusKm = 3) => {
  if (!deliveries || deliveries.length === 0) return [];

  const clusters = [];
  const assigned = new Set();

  deliveries.forEach((delivery, i) => {
    if (assigned.has(i)) return;

    const cluster = [delivery];
    assigned.add(i);

    deliveries.forEach((other, j) => {
      if (assigned.has(j)) return;

      const dist = calculateDistance(
        delivery.latitude,
        delivery.longitude,
        other.latitude,
        other.longitude
      );

      if (dist <= radiusKm) {
        cluster.push(other);
        assigned.add(j);
      }
    });

    clusters.push(cluster);
  });

  return clusters;
};

/**
 * Calculate the optimal pickup order for multiple restaurants
 * @param {Object} driverLocation - { latitude, longitude }
 * @param {Array} pickups - Array of restaurant pickup locations
 * @param {Array} dropoffs - Array of delivery dropoff locations
 * @returns {Object} { pickupOrder, dropoffOrder, estimatedTime, totalDistance }
 */
export const calculateOptimalRoute = (driverLocation, pickups, dropoffs) => {
  // Optimize pickup order first
  const optimizedPickups = optimizeRouteOrder(driverLocation, pickups);

  // Then optimize dropoff order starting from last pickup
  const lastPickup = optimizedPickups[optimizedPickups.length - 1] || driverLocation;
  const optimizedDropoffs = optimizeRouteOrder(lastPickup, dropoffs);

  // Calculate total distance
  const allStops = [driverLocation, ...optimizedPickups, ...optimizedDropoffs];
  let totalDistance = 0;
  for (let i = 0; i < allStops.length - 1; i++) {
    totalDistance += calculateDistance(
      allStops[i].latitude,
      allStops[i].longitude,
      allStops[i + 1].latitude,
      allStops[i + 1].longitude
    );
  }

  // Estimate time at 30km/h average + 5min per stop
  const travelMinutes = (totalDistance / 30) * 60;
  const stopMinutes = (optimizedPickups.length + optimizedDropoffs.length) * 5;

  return {
    pickupOrder: optimizedPickups,
    dropoffOrder: optimizedDropoffs,
    totalDistance: Math.round(totalDistance * 100) / 100,
    estimatedTime: Math.ceil(travelMinutes + stopMinutes),
  };
};

export default {
  optimizeRouteOrder,
  clusterDeliveries,
  calculateOptimalRoute,
};
