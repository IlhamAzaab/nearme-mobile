import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import {
  cacheDriverActiveDeliveryIds,
  flushQueuedDriverLocationUpdates,
  startDriverBackgroundLocationTracking,
  stopDriverBackgroundLocationTracking,
} from "../../services/driverBackgroundLocationService";
import {
  DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
  getCurrentDriverScopedCacheKey,
} from "../../utils/driverRequestCache";
import { useSocket } from "../../context/SocketContext";

const LIVE_TRACKING_INTERVAL_MS = 3000;
const BACKEND_SYNC_INTERVAL_MS = 5000;
const ACTIVE_DELIVERY_REFRESH_MS = 20000;
const LIVE_LOCATION_MAX_ACCURACY_METERS = 150;
const LIVE_LOCATION_SAMPLE_MAX_AGE_MS = 12000;

function isValidCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function normalizeLocation(sample) {
  const coords = sample?.coords || sample;
  if (!coords) return null;

  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  const heading = Number(coords.heading);
  const speed = Number(coords.speed);
  const accuracy = Number(coords.accuracy || Infinity);
  const sampleTimestamp = Number(sample?.timestamp || Date.now());
  const sampleAgeMs = Math.max(0, Date.now() - sampleTimestamp);

  if (!isValidCoordinatePair(latitude, longitude)) return null;
  if (!Number.isFinite(accuracy) || accuracy > LIVE_LOCATION_MAX_ACCURACY_METERS) {
    return null;
  }
  if (!Number.isFinite(sampleAgeMs) || sampleAgeMs > LIVE_LOCATION_SAMPLE_MAX_AGE_MS) {
    return null;
  }

  return {
    latitude,
    longitude,
    heading: Number.isFinite(heading) ? heading : 0,
    speed: Number.isFinite(speed) ? speed : null,
    accuracy,
  };
}

async function patchAvailableDeliveryCacheLocation(location) {
  try {
    const scopedKey = await getCurrentDriverScopedCacheKey(
      DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
    );
    const raw =
      (await AsyncStorage.getItem(scopedKey)) ||
      (await AsyncStorage.getItem(DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY));
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const next = {
      ...parsed,
      data: {
        ...(parsed.data || {}),
        driverLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      },
      timestamp: Date.now(),
    };

    const nextRaw = JSON.stringify(next);
    await AsyncStorage.multiSet([
      [scopedKey, nextRaw],
      [DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY, nextRaw],
    ]);
  } catch {
    // Ignore cache write failures.
  }
}

export default function DriverLiveLocationSync() {
  const queryClient = useQueryClient();
  const { emit, isConnected } = useSocket();
  const locationWatchRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastBackendSyncAtRef = useRef(0);
  const lastActiveDeliveryFetchAtRef = useRef(0);
  const activeDeliveryIdsRef = useRef([]);
  const latestLocationRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const backgroundTrackingEnabledRef = useRef(false);
  const userIdRef = useRef("default");
  // Track if we've done initial background setup
  const initialBackgroundSetupDoneRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const storedUserId = (await AsyncStorage.getItem("userId")) || "default";
      if (mounted) {
        userIdRef.current = storedUserId;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const updateCaches = useCallback(
    async (location) => {
      const currentUserId = userIdRef.current || "default";
      queryClient.setQueryData(
        ["driver", "available-deliveries", currentUserId],
        (prev) => {
          if (!prev || typeof prev !== "object") return prev;
          return {
            ...prev,
            driverLocation: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          };
        },
      );

      queryClient.setQueryData(
        ["driver", "active-deliveries", currentUserId],
        (prev) => {
          if (!prev || typeof prev !== "object") return prev;
          return {
            ...prev,
            driverLocation: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          };
        },
      );

      await patchAvailableDeliveryCacheLocation(location);
    },
    [queryClient],
  );

  const refreshActiveDeliveryIds = useCallback(async (token) => {
    const res = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      activeDeliveryIdsRef.current = [];
      await cacheDriverActiveDeliveryIds([]);
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const deliveries = Array.isArray(payload?.deliveries)
      ? payload.deliveries
      : [];

    const activeIds = deliveries
      .filter((item) =>
        ["accepted", "picked_up", "on_the_way", "at_customer"].includes(
          String(item?.status || "").toLowerCase(),
        ),
      )
      .map((item) => item?.id || item?.delivery_id)
      .filter(Boolean);

    activeDeliveryIdsRef.current = activeIds;
    lastActiveDeliveryFetchAtRef.current = Date.now();
    await cacheDriverActiveDeliveryIds(activeIds);
  }, []);

  const setBackgroundTrackingEnabled = useCallback(async (enabled) => {
    if (enabled && !backgroundTrackingEnabledRef.current) {
      const result = await startDriverBackgroundLocationTracking();
      backgroundTrackingEnabledRef.current = Boolean(result?.ok);
      return;
    }

    if (!enabled && backgroundTrackingEnabledRef.current) {
      await stopDriverBackgroundLocationTracking();
      backgroundTrackingEnabledRef.current = false;
    }
  }, []);

  const syncTrackingLifecycle = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      activeDeliveryIdsRef.current = [];
      await cacheDriverActiveDeliveryIds([]);
      await setBackgroundTrackingEnabled(false);
      return;
    }

    await refreshActiveDeliveryIds(token);
    const hasActiveDeliveries = activeDeliveryIdsRef.current.length > 0;
    await setBackgroundTrackingEnabled(hasActiveDeliveries);

    if (hasActiveDeliveries) {
      await flushQueuedDriverLocationUpdates();
    }

    initialBackgroundSetupDoneRef.current = true;
  }, [refreshActiveDeliveryIds, setBackgroundTrackingEnabled]);

  const syncLocationToBackend = useCallback(async () => {
    const now = Date.now();
    if (syncInFlightRef.current) return;
    if (now - lastBackendSyncAtRef.current < BACKEND_SYNC_INTERVAL_MS) return;

    const location = latestLocationRef.current;
    if (!location) return;

    syncInFlightRef.current = true;

    try {
      const token = await getAccessToken();
      if (!token) return;

      const shouldRefreshActiveIds =
        activeDeliveryIdsRef.current.length === 0 ||
        now - lastActiveDeliveryFetchAtRef.current >=
          ACTIVE_DELIVERY_REFRESH_MS;

      if (shouldRefreshActiveIds) {
        await refreshActiveDeliveryIds(token);
        await setBackgroundTrackingEnabled(
          activeDeliveryIdsRef.current.length > 0,
        );
      }

      if (activeDeliveryIdsRef.current.length === 0) {
        lastBackendSyncAtRef.current = now;
        return;
      }

      await Promise.all(
        activeDeliveryIdsRef.current.map((deliveryId) =>
          fetch(`${API_BASE_URL}/driver/deliveries/${deliveryId}/location`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading,
              speed: location.speed,
              timestamp: Date.now(),
            }),
          }).catch(() => null),
        ),
      );

      lastBackendSyncAtRef.current = now;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [refreshActiveDeliveryIds, setBackgroundTrackingEnabled]);

  const handleLocationUpdate = useCallback(
    async (coords) => {
      const location = normalizeLocation(coords);
      if (!location) return;

      latestLocationRef.current = location;

      if (isConnected) {
        emit("driver:location", {
          lat: location.latitude,
          lng: location.longitude,
          heading: location.heading,
          speed: location.speed,
          accuracy: location.accuracy,
          timestamp: Date.now(),
        });
      }

      await updateCaches(location);
      await syncLocationToBackend();
    },
    [emit, isConnected, syncLocationToBackend, updateCaches],
  );

  const startTracking = useCallback(async () => {
    if (locationWatchRef.current) {
      return;
    }

    if (AppState.currentState !== "active") {
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return;

    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    }).catch(() => null);

    if (initial?.coords) {
      await handleLocationUpdate(initial);
    }

    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: LIVE_TRACKING_INTERVAL_MS,
        distanceInterval: 0,
      },
      (position) => {
        handleLocationUpdate(position).catch(() => {});
      },
    );
  }, [handleLocationUpdate]);

  const stopTracking = useCallback(() => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Start background lifecycle FIRST, then start foreground watch.
    // This ensures background tracking is enabled before the app can go to background.
    syncTrackingLifecycle()
      .then(() => {
        startTracking().catch(() => {});
      })
      .catch(() => {
        // Even if lifecycle sync fails, start foreground tracking anyway
        startTracking().catch(() => {});
      });

    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previous.match(/inactive|background/) && nextAppState === "active") {
        // App returned to foreground:
        // 1. Restart foreground watch
        // 2. Re-sync lifecycle (checks for new deliveries, flushes queue)
        startTracking().catch(() => {});
        syncTrackingLifecycle().catch(() => {});
      }

      if (nextAppState.match(/inactive|background/)) {
        // App going to background:
        // 1. Stop foreground watch (saves battery, background task handles GPS)
        stopTracking();
        // 2. Ensure background tracking is started if not already done
        //    This handles the race condition where syncTrackingLifecycle hasn't finished yet
        if (!initialBackgroundSetupDoneRef.current) {
          syncTrackingLifecycle().catch(() => {});
        }
      }
    });

    const networkSub = NetInfo.addEventListener((state) => {
      if (state?.isConnected) {
        flushQueuedDriverLocationUpdates().catch(() => {});
      }
    });

    const lifecycleInterval = setInterval(() => {
      syncTrackingLifecycle().catch(() => {});
    }, ACTIVE_DELIVERY_REFRESH_MS);

    return () => {
      stopTracking();
      appStateSub?.remove();
      networkSub?.();
      clearInterval(lifecycleInterval);

      // Don't stop background tracking on unmount — it should keep running
      // for active deliveries even when navigating between screens.
      // Background tracking will auto-stop when no active deliveries remain.
    };
  }, [
    setBackgroundTrackingEnabled,
    startTracking,
    stopTracking,
    syncTrackingLifecycle,
  ]);

  return null;
}
