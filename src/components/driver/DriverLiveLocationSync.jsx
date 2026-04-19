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

const LIVE_TRACKING_INTERVAL_MS = 3000;
const BACKEND_SYNC_INTERVAL_MS = 5000;
const ACTIVE_DELIVERY_REFRESH_MS = 20000;

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

function normalizeLocation(coords) {
  if (!coords) return null;

  const latitude = Number(coords.latitude);
  const longitude = Number(coords.longitude);
  const heading = Number(coords.heading);
  const speed = Number(coords.speed);

  if (!isValidCoordinatePair(latitude, longitude)) return null;

  return {
    latitude,
    longitude,
    heading: Number.isFinite(heading) ? heading : 0,
    speed: Number.isFinite(speed) ? speed : null,
  };
}

async function patchAvailableDeliveryCacheLocation(location) {
  try {
    const raw = await AsyncStorage.getItem("available_deliveries_cache");
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

    await AsyncStorage.setItem(
      "available_deliveries_cache",
      JSON.stringify(next),
    );
  } catch {
    // Ignore cache write failures.
  }
}

export default function DriverLiveLocationSync() {
  const queryClient = useQueryClient();
  const locationWatchRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastBackendSyncAtRef = useRef(0);
  const lastActiveDeliveryFetchAtRef = useRef(0);
  const activeDeliveryIdsRef = useRef([]);
  const latestLocationRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const backgroundTrackingEnabledRef = useRef(false);

  const updateCaches = useCallback(
    async (location) => {
      queryClient.setQueriesData(
        { queryKey: ["driver", "available-deliveries"] },
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

      queryClient.setQueriesData(
        { queryKey: ["driver", "active-deliveries"] },
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
      await updateCaches(location);
      await syncLocationToBackend();
    },
    [syncLocationToBackend, updateCaches],
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
      accuracy: Location.Accuracy.High,
    }).catch(() => null);

    if (initial?.coords) {
      await handleLocationUpdate(initial.coords);
    }

    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LIVE_TRACKING_INTERVAL_MS,
        distanceInterval: 0,
      },
      (position) => {
        handleLocationUpdate(position?.coords).catch(() => {});
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
    startTracking();
    syncTrackingLifecycle().catch(() => {});

    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previous.match(/inactive|background/) && nextAppState === "active") {
        startTracking().catch(() => {});
        syncTrackingLifecycle().catch(() => {});
      }

      if (nextAppState.match(/inactive|background/)) {
        stopTracking();
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

      if (activeDeliveryIdsRef.current.length === 0) {
        setBackgroundTrackingEnabled(false).catch(() => {});
      }
    };
  }, [
    setBackgroundTrackingEnabled,
    startTracking,
    stopTracking,
    syncTrackingLifecycle,
  ]);

  return null;
}
