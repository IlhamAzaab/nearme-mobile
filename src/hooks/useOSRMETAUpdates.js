import { useState, useEffect, useRef, useCallback } from 'react';
import { formatETA } from '../utils/etaFormatter';

/**
 * Hook for OSRM-based real-time ETA updates (uses OSRM routing backend)
 * @param {Object} options - { origin, destination, refreshInterval, enabled }
 * @returns {Object} { eta, etaText, distance, routeCoordinates, loading, error, refresh }
 */
const useOSRMETAUpdates = (options = {}) => {
  const { origin, destination, refreshInterval = 30000, enabled = true } = options;

  const [eta, setEta] = useState(null);
  const [etaText, setEtaText] = useState('Calculating...');
  const [distance, setDistance] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchETAFromOSRM = useCallback(async () => {
    if (!origin || !destination || !enabled) return;

    try {
      setLoading(true);
      setError(null);

      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const durationMins = route.duration / 60;
        const distanceKm = route.distance / 1000;

        setEta(Math.ceil(durationMins));
        setEtaText(formatETA(durationMins));
        setDistance(Math.round(distanceKm * 10) / 10);

        // Extract route coordinates for map polyline
        if (route.geometry?.coordinates) {
          const coords = route.geometry.coordinates.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }));
          setRouteCoordinates(coords);
        }
      }
    } catch (err) {
      setError(err.message);
      console.warn('[useOSRMETAUpdates] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, enabled]);

  const refresh = useCallback(() => {
    fetchETAFromOSRM();
  }, [fetchETAFromOSRM]);

  useEffect(() => {
    fetchETAFromOSRM();

    if (refreshInterval > 0 && enabled) {
      intervalRef.current = setInterval(fetchETAFromOSRM, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchETAFromOSRM, refreshInterval, enabled]);

  return { eta, etaText, distance, routeCoordinates, loading, error, refresh };
};

export default useOSRMETAUpdates;
