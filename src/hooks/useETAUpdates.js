import { useState, useEffect, useRef, useCallback } from 'react';
import { formatETA } from '../utils/etaFormatter';

/**
 * Hook for real-time ETA updates
 * @param {Object} options - { orderId, origin, destination, refreshInterval }
 * @returns {Object} { eta, etaText, distance, loading, error, refresh }
 */
const useETAUpdates = (options = {}) => {
  const { orderId, origin, destination, refreshInterval = 30000 } = options;

  const [eta, setEta] = useState(null); // minutes
  const [etaText, setEtaText] = useState('Calculating...');
  const [distance, setDistance] = useState(null); // km
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchETA = useCallback(async () => {
    if (!origin || !destination) return;

    try {
      setLoading(true);
      setError(null);

      // Use OSRM for route estimation
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const durationMins = route.duration / 60;
        const distanceKm = route.distance / 1000;

        setEta(Math.ceil(durationMins));
        setEtaText(formatETA(durationMins));
        setDistance(Math.round(distanceKm * 10) / 10);
      }
    } catch (err) {
      setError(err.message);
      console.warn('[useETAUpdates] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  const refresh = useCallback(() => {
    fetchETA();
  }, [fetchETA]);

  useEffect(() => {
    fetchETA();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchETA, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchETA, refreshInterval]);

  return { eta, etaText, distance, loading, error, refresh };
};

export default useETAUpdates;
