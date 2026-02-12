/**
 * Map Service - FREE OpenStreetMap + OSRM Routing
 * 
 * Same logic as website - 100% FREE:
 * - OpenStreetMap tiles (no API key)
 * - OSRM routing (no API key)
 * - Haversine distance calculation
 */

// ============================================================================
// OSRM ROUTE FETCHING (Same as Website)
// ============================================================================

/**
 * Get route from OSRM (FREE routing service)
 * Returns: { coordinates, distance_km, duration_min, success }
 */
export async function getOSRMRoute(startLat, startLng, endLat, endLng) {
  try {
    // OSRM uses [lng, lat] format
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== "Ok" || !data.routes?.length) {
      return { success: false, error: "No route found" };
    }
    
    const route = data.routes[0];
    
    // Convert OSRM coordinates [lng, lat] to React Native format { latitude, longitude }
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    
    return {
      success: true,
      coordinates,
      distance_km: route.distance / 1000,
      duration_min: Math.ceil(route.duration / 60),
      raw: route,
    };
  } catch (error) {
    console.warn("OSRM Route Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get multi-stop route (Driver → Restaurant → Customer)
 * Returns optimized route with all waypoints
 */
export async function getMultiStopRoute(waypoints) {
  try {
    if (waypoints.length < 2) {
      return { success: false, error: "Need at least 2 waypoints" };
    }
    
    // Build OSRM waypoints string: lng,lat;lng,lat;lng,lat
    const waypointsStr = waypoints
      .map(wp => `${wp.longitude},${wp.latitude}`)
      .join(";");
    
    const url = `https://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code !== "Ok" || !data.routes?.length) {
      return { success: false, error: "No route found" };
    }
    
    const route = data.routes[0];
    
    // Convert coordinates
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    
    // Get leg distances and durations
    const legs = route.legs.map((leg, index) => ({
      index,
      distance_km: leg.distance / 1000,
      duration_min: Math.ceil(leg.duration / 60),
    }));
    
    return {
      success: true,
      coordinates,
      distance_km: route.distance / 1000,
      duration_min: Math.ceil(route.duration / 60),
      legs,
      raw: route,
    };
  } catch (error) {
    console.warn("OSRM Multi-Stop Route Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// HAVERSINE DISTANCE (Straight line - for sorting/filtering)
// ============================================================================

/**
 * Calculate straight-line distance between two points (in km)
 * Used for quick distance sorting before OSRM call
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// ============================================================================
// COORDINATE HELPERS
// ============================================================================

/**
 * Parse coordinates to ensure they're numbers
 */
export function parseCoordinate(value) {
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinate(lat, lng) {
  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);
  
  return (
    latitude !== null && 
    longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

/**
 * Get center point of multiple coordinates
 */
export function getCenterPoint(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return { latitude: 7.8731, longitude: 80.7718 }; // Sri Lanka center
  }
  
  const sum = coordinates.reduce(
    (acc, coord) => ({
      lat: acc.lat + (coord.latitude || 0),
      lng: acc.lng + (coord.longitude || 0),
    }),
    { lat: 0, lng: 0 }
  );
  
  return {
    latitude: sum.lat / coordinates.length,
    longitude: sum.lng / coordinates.length,
  };
}

/**
 * Calculate delta for map region to fit all coordinates
 */
export function getRegionForCoordinates(coordinates, padding = 1.5) {
  if (!coordinates || coordinates.length === 0) {
    return {
      latitude: 7.8731,
      longitude: 80.7718,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  coordinates.forEach(coord => {
    if (coord.latitude < minLat) minLat = coord.latitude;
    if (coord.latitude > maxLat) maxLat = coord.latitude;
    if (coord.longitude < minLng) minLng = coord.longitude;
    if (coord.longitude > maxLng) maxLng = coord.longitude;
  });
  
  const center = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  };
  
  return {
    ...center,
    latitudeDelta: Math.max((maxLat - minLat) * padding, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * padding, 0.01),
  };
}

// ============================================================================
// OPENSTREETMAP TILE CONFIG
// ============================================================================

/**
 * OpenStreetMap tile URL template
 * FREE - No API key required
 */
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Carto Voyager tiles (backup - also FREE)
 * Better for production use
 */
export const CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

/**
 * Default tile config
 */
export const DEFAULT_TILE_CONFIG = {
  urlTemplate: CARTO_TILE_URL, // Using Carto as it's more reliable
  maximumZ: 19,
  flipY: false,
  tileSize: 256,
  zIndex: -1,
};

// ============================================================================
// DELIVERY FEE CALCULATION (Same as Website)
// ============================================================================

/**
 * Calculate delivery fee based on distance
 * Same logic as website
 */
export function calculateDeliveryFee(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return null;
  
  if (distanceKm <= 1) return 50;
  if (distanceKm <= 2) return 80;
  if (distanceKm <= 2.5) return 87;
  
  // After 2.5km: Rs.2.30 per 100m
  const extraMeters = (distanceKm - 2.5) * 1000;
  const extra100mUnits = Math.ceil(extraMeters / 100);
  
  return 87 + extra100mUnits * 2.3;
}

/**
 * Format price
 */
export function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num)) return "Rs. 0.00";
  return `Rs. ${num.toFixed(2)}`;
}

// ============================================================================
// ROUTE OPTIMIZATION (Nearest First)
// ============================================================================

/**
 * Sort locations by nearest first from current position
 * Uses Haversine for quick sorting
 */
export function sortByNearest(currentLocation, locations, getCoords) {
  if (!currentLocation || !locations?.length) return locations;
  
  return [...locations].sort((a, b) => {
    const coordsA = getCoords(a);
    const coordsB = getCoords(b);
    
    if (!coordsA || !coordsB) return 0;
    
    const distA = haversineDistance(
      currentLocation.latitude, 
      currentLocation.longitude,
      coordsA.latitude, 
      coordsA.longitude
    );
    
    const distB = haversineDistance(
      currentLocation.latitude, 
      currentLocation.longitude,
      coordsB.latitude, 
      coordsB.longitude
    );
    
    return distA - distB;
  });
}

export default {
  getOSRMRoute,
  getMultiStopRoute,
  haversineDistance,
  parseCoordinate,
  isValidCoordinate,
  getCenterPoint,
  getRegionForCoordinates,
  calculateDeliveryFee,
  formatPrice,
  sortByNearest,
  OSM_TILE_URL,
  CARTO_TILE_URL,
  DEFAULT_TILE_CONFIG,
};
