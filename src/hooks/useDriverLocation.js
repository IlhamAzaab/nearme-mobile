import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Hook for tracking driver's live location
 * @param {Object} options - { enabled, interval, distanceFilter }
 * @returns {Object} { location, error, isTracking, startTracking, stopTracking }
 */
const useDriverLocation = (options = {}) => {
  const { enabled = false, interval = 5000, distanceFilter = 10 } = options;

  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchRef = useRef(null);

  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }

      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation.coords);

      // Start watching
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: interval,
          distanceInterval: distanceFilter,
        },
        (newLocation) => {
          setLocation(newLocation.coords);
        }
      );

      setIsTracking(true);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.warn('[useDriverLocation] Error starting tracking:', err.message);
    }
  }, [interval, distanceFilter]);

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      startTracking();
    }
    return () => stopTracking();
  }, [enabled, startTracking, stopTracking]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && enabled && !isTracking) {
        startTracking();
      }
    });

    return () => subscription?.remove();
  }, [enabled, isTracking, startTracking]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
};

export default useDriverLocation;
