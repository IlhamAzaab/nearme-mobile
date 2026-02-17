import { useState, useEffect, useCallback } from 'react';
import { optimizeRouteOrder } from '../utils/routeOptimization';

/**
 * Hook for OSRM-based multi-delivery route calculation
 * @param {Object} options - { driverLocation, stops, profile }
 * @returns {Object} { route, optimizedStops, legs, totalDistance, totalDuration, loading, error, recalculate }
 */
const useOSRMMultiDeliveryRoute = (options = {}) => {
  const { driverLocation, stops = [], profile = 'driving' } = options;

  const [route, setRoute] = useState(null);
  const [optimizedStops, setOptimizedStops] = useState([]);
  const [legs, setLegs] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateRoute = useCallback(async () => {
    if (!driverLocation || stops.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Optimize order
      const ordered = optimizeRouteOrder(driverLocation, stops);
      setOptimizedStops(ordered);

      // Build waypoints string
      const allPoints = [driverLocation, ...ordered];
      const coordsStr = allPoints
        .map((p) => `${p.longitude},${p.latitude}`)
        .join(';');

      const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        setRoute(routeData.geometry);
        setTotalDistance(Math.round((routeData.distance / 1000) * 10) / 10);
        setTotalDuration(Math.ceil(routeData.duration / 60));

        // Extract leg info
        const legData = routeData.legs?.map((leg, index) => ({
          index,
          from: index === 0 ? 'Driver Location' : ordered[index - 1]?.name || `Stop ${index}`,
          to: ordered[index]?.name || `Stop ${index + 1}`,
          distance: Math.round((leg.distance / 1000) * 10) / 10,
          duration: Math.ceil(leg.duration / 60),
        })) || [];

        setLegs(legData);
      } else {
        setError('No route found');
      }
    } catch (err) {
      setError(err.message);
      console.warn('[useOSRMMultiDeliveryRoute] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [driverLocation, stops, profile]);

  const recalculate = useCallback(() => {
    calculateRoute();
  }, [calculateRoute]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  return {
    route,
    optimizedStops,
    legs,
    totalDistance,
    totalDuration,
    loading,
    error,
    recalculate,
  };
};

export default useOSRMMultiDeliveryRoute;
