import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateDistance } from '../utils/locationUtils';
import { optimizeRouteOrder } from '../utils/routeOptimization';

/**
 * Hook for calculating multi-stop delivery routes
 * @param {Object} options - { driverLocation, pickups, dropoffs }
 * @returns {Object} { route, optimizedStops, totalDistance, totalTime, loading, error, recalculate }
 */
const useMultiDeliveryRoute = (options = {}) => {
  const { driverLocation, pickups = [], dropoffs = [] } = options;

  const [route, setRoute] = useState(null);
  const [optimizedStops, setOptimizedStops] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateRoute = useCallback(async () => {
    if (!driverLocation || (pickups.length === 0 && dropoffs.length === 0)) return;

    try {
      setLoading(true);
      setError(null);

      // Optimize stop order
      const allStops = [...pickups.map(p => ({ ...p, type: 'pickup' })), ...dropoffs.map(d => ({ ...d, type: 'dropoff' }))];
      const ordered = optimizeRouteOrder(driverLocation, allStops);
      setOptimizedStops(ordered);

      // Build OSRM route with all waypoints
      const coords = [driverLocation, ...ordered]
        .map((s) => `${s.longitude},${s.latitude}`)
        .join(';');

      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        setRoute(routeData.geometry);
        setTotalDistance(Math.round((routeData.distance / 1000) * 10) / 10);
        setTotalTime(Math.ceil(routeData.duration / 60));
      }
    } catch (err) {
      setError(err.message);
      console.warn('[useMultiDeliveryRoute] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [driverLocation, pickups, dropoffs]);

  const recalculate = useCallback(() => {
    calculateRoute();
  }, [calculateRoute]);

  useEffect(() => {
    calculateRoute();
  }, [calculateRoute]);

  return {
    route,
    optimizedStops,
    totalDistance,
    totalTime,
    loading,
    error,
    recalculate,
  };
};

export default useMultiDeliveryRoute;
