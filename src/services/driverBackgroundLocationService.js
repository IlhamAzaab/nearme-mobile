import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { API_BASE_URL } from "../constants/api";
import { getAccessToken } from "../lib/authStorage";

export const DRIVER_BACKGROUND_LOCATION_TASK =
  "driver-live-location-background-task";

const BACKGROUND_SYNC_MIN_INTERVAL_MS = 5000;
const LAST_SYNC_AT_KEY = "@driver_bg_last_sync_at";
const AVAILABLE_CACHE_KEY = "available_deliveries_cache";

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

  if (!isValidCoordinatePair(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}

async function patchAvailableCache(location) {
  try {
    const raw = await AsyncStorage.getItem(AVAILABLE_CACHE_KEY);
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

    await AsyncStorage.setItem(AVAILABLE_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore cache update errors in background task.
  }
}

async function shouldSyncNow() {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_AT_KEY);
    const lastAt = Number(raw || 0);
    const now = Date.now();
    if (
      Number.isFinite(lastAt) &&
      now - lastAt < BACKGROUND_SYNC_MIN_INTERVAL_MS
    ) {
      return false;
    }
    await AsyncStorage.setItem(LAST_SYNC_AT_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

async function getActiveDeliveryIds(token) {
  const response = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return [];

  const payload = await response.json().catch(() => ({}));
  const deliveries = Array.isArray(payload?.deliveries)
    ? payload.deliveries
    : [];

  return deliveries
    .filter((item) =>
      ["accepted", "picked_up", "on_the_way", "at_customer"].includes(
        String(item?.status || "").toLowerCase(),
      ),
    )
    .map((item) => item?.id || item?.delivery_id)
    .filter(Boolean);
}

async function syncLocationToBackend(location) {
  const token = await getAccessToken();
  if (!token) return;

  const activeDeliveryIds = await getActiveDeliveryIds(token);
  if (!activeDeliveryIds.length) return;

  await Promise.all(
    activeDeliveryIds.map((deliveryId) =>
      fetch(`${API_BASE_URL}/driver/deliveries/${deliveryId}/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      }).catch(() => null),
    ),
  );
}

if (!TaskManager.isTaskDefined(DRIVER_BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(
    DRIVER_BACKGROUND_LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        return;
      }

      const locations = Array.isArray(data?.locations) ? data.locations : [];
      if (!locations.length) return;

      const latest = locations[locations.length - 1];
      const normalized = normalizeLocation(latest?.coords);
      if (!normalized) return;

      const shouldSync = await shouldSyncNow();
      if (!shouldSync) return;

      await patchAvailableCache(normalized);
      await syncLocationToBackend(normalized);
    },
  );
}

export async function startDriverBackgroundLocationTracking() {
  const foregroundPermission =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundPermission.status !== "granted") {
    return { ok: false, reason: "foreground_permission_denied" };
  }

  const backgroundPermission =
    await Location.requestBackgroundPermissionsAsync();

  if (backgroundPermission.status !== "granted") {
    return { ok: false, reason: "background_permission_denied" };
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
  );

  if (alreadyStarted) {
    return { ok: true, reason: "already_started" };
  }

  await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,
    deferredUpdatesInterval: 3000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Meezo Driver Tracking",
      notificationBody: "Live location is active for deliveries",
      notificationColor: "#06C168",
    },
  });

  return { ok: true, reason: "started" };
}

export async function stopDriverBackgroundLocationTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
  );

  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  }
}
