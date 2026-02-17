import { useState, useCallback } from 'react';

/**
 * Hook for getting OSRM turn-by-turn directions
 * @returns {Object} { directions, route, distance, duration, loading, error, getDirections, clearDirections }
 */
const useOSRMDirections = () => {
  const [directions, setDirections] = useState([]);
  const [route, setRoute] = useState(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getDirections = useCallback(async (origin, destination) => {
    if (!origin || !destination) return;

    try {
      setLoading(true);
      setError(null);

      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        setRoute(routeData.geometry);
        setDistance(Math.round((routeData.distance / 1000) * 10) / 10);
        setDuration(Math.ceil(routeData.duration / 60));

        // Extract turn-by-turn steps
        const steps = routeData.legs?.[0]?.steps?.map((step) => ({
          instruction: step.maneuver?.instruction || '',
          distance: step.distance,
          duration: step.duration,
          name: step.name || '',
          maneuver: step.maneuver,
        })) || [];

        setDirections(steps);
      } else {
        setError('No route found');
      }
    } catch (err) {
      setError(err.message);
      console.warn('[useOSRMDirections] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearDirections = useCallback(() => {
    setDirections([]);
    setRoute(null);
    setDistance(0);
    setDuration(0);
    setError(null);
  }, []);

  return {
    directions,
    route,
    distance,
    duration,
    loading,
    error,
    getDirections,
    clearDirections,
  };
};

export default useOSRMDirections;
