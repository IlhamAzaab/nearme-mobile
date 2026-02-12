/**
 * useOSRMRoute Hook
 * 
 * Custom hook for fetching OSRM routes - Same logic as website
 * 100% FREE - No API key required
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getOSRMRoute, getMultiStopRoute } from "../services/mapService";

/**
 * Hook for fetching single route (point A to point B)
 */
export function useOSRMRoute(startLocation, endLocation) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const fetchRoute = useCallback(async () => {
    if (!startLocation || !endLocation) {
      setRouteCoords([]);
      setRouteInfo(null);
      return;
    }

    const startLat = parseFloat(startLocation.latitude);
    const startLng = parseFloat(startLocation.longitude);
    const endLat = parseFloat(endLocation.latitude);
    const endLng = parseFloat(endLocation.longitude);

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      const result = await getOSRMRoute(startLat, startLng, endLat, endLng);

      if (abortRef.current) return;

      if (result.success) {
        setRouteCoords(result.coordinates);
        setRouteInfo({
          distance_km: result.distance_km,
          duration_min: result.duration_min,
        });
      } else {
        setError(result.error);
        setRouteCoords([]);
        setRouteInfo(null);
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [
    startLocation?.latitude,
    startLocation?.longitude,
    endLocation?.latitude,
    endLocation?.longitude,
  ]);

  useEffect(() => {
    fetchRoute();
    return () => {
      abortRef.current = true;
    };
  }, [fetchRoute]);

  return {
    routeCoords,
    routeInfo,
    loading,
    error,
    refetch: fetchRoute,
  };
}

/**
 * Hook for fetching multi-stop route (Driver → Restaurants → Customers)
 */
export function useMultiStopRoute(waypoints) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [legs, setLegs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const fetchRoute = useCallback(async () => {
    if (!waypoints || waypoints.length < 2) {
      setRouteCoords([]);
      setRouteInfo(null);
      setLegs([]);
      return;
    }

    // Validate all waypoints
    const validWaypoints = waypoints.filter((wp) => {
      const lat = parseFloat(wp.latitude);
      const lng = parseFloat(wp.longitude);
      return !isNaN(lat) && !isNaN(lng);
    });

    if (validWaypoints.length < 2) {
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current = false;

    try {
      const result = await getMultiStopRoute(validWaypoints);

      if (abortRef.current) return;

      if (result.success) {
        setRouteCoords(result.coordinates);
        setRouteInfo({
          distance_km: result.distance_km,
          duration_min: result.duration_min,
        });
        setLegs(result.legs || []);
      } else {
        setError(result.error);
        setRouteCoords([]);
        setRouteInfo(null);
        setLegs([]);
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(err.message);
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
      }
    }
  }, [JSON.stringify(waypoints)]);

  useEffect(() => {
    fetchRoute();
    return () => {
      abortRef.current = true;
    };
  }, [fetchRoute]);

  return {
    routeCoords,
    routeInfo,
    legs,
    loading,
    error,
    refetch: fetchRoute,
  };
}

export default useOSRMRoute;
