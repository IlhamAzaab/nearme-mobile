/**
 * OSRM Service
 * Handles all OSRM (Open Source Routing Machine) API calls
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org';

/**
 * Get route between two points
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @param {Object} options - { profile, overview, geometries, steps }
 * @returns {Object} Route data
 */
export const getRoute = async (origin, destination, options = {}) => {
  const {
    profile = 'driving',
    overview = 'full',
    geometries = 'geojson',
    steps = false,
  } = options;

  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coords}?overview=${overview}&geometries=${geometries}&steps=${steps}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'No route found');
  }

  const route = data.routes[0];
  return {
    distance: route.distance, // meters
    duration: route.duration, // seconds
    geometry: route.geometry,
    legs: route.legs,
  };
};

/**
 * Get route through multiple waypoints
 * @param {Array} waypoints - Array of { latitude, longitude }
 * @param {Object} options
 * @returns {Object} Route data with legs
 */
export const getMultiStopRoute = async (waypoints, options = {}) => {
  const {
    profile = 'driving',
    overview = 'full',
    geometries = 'geojson',
    steps = true,
  } = options;

  if (waypoints.length < 2) throw new Error('At least 2 waypoints required');

  const coords = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(';');

  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coords}?overview=${overview}&geometries=${geometries}&steps=${steps}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'No route found');
  }

  const route = data.routes[0];
  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry,
    legs: route.legs?.map((leg, i) => ({
      index: i,
      distance: leg.distance,
      duration: leg.duration,
      steps: leg.steps,
    })),
  };
};

/**
 * Get distance matrix between multiple points
 * @param {Array} sources - Array of { latitude, longitude }
 * @param {Array} destinations - Array of { latitude, longitude }
 * @returns {Object} { distances, durations }
 */
export const getDistanceMatrix = async (sources, destinations) => {
  const allPoints = [...sources, ...destinations];
  const coords = allPoints.map((p) => `${p.longitude},${p.latitude}`).join(';');

  const sourceIndices = sources.map((_, i) => i).join(';');
  const destIndices = destinations.map((_, i) => i + sources.length).join(';');

  const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}?sources=${sourceIndices}&destinations=${destIndices}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok') {
    throw new Error(data.message || 'Distance matrix failed');
  }

  return {
    durations: data.durations, // seconds
    distances: data.distances, // meters (if available)
  };
};

/**
 * Get nearest road point to a coordinate
 * @param {Object} point - { latitude, longitude }
 * @returns {Object} Snapped coordinate
 */
export const getNearestRoad = async (point) => {
  const url = `${OSRM_BASE_URL}/nearest/v1/driving/${point.longitude},${point.latitude}?number=1`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.code !== 'Ok' || !data.waypoints?.length) {
    throw new Error('No nearby road found');
  }

  const wp = data.waypoints[0];
  return {
    latitude: wp.location[1],
    longitude: wp.location[0],
    name: wp.name,
    distance: wp.distance,
  };
};

export default {
  getRoute,
  getMultiStopRoute,
  getDistanceMatrix,
  getNearestRoad,
};
