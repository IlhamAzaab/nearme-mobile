import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { API_BASE_URL } from "../constants/api";
import { getAccessToken } from "../lib/authStorage";
import {
  DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
  getCurrentDriverScopedCacheKey,
} from "../utils/driverRequestCache";

let TaskManager = null;
try {
  TaskManager = require("expo-task-manager");
} catch {
  TaskManager = null;
}

export const DRIVER_BACKGROUND_LOCATION_TASK =
  "driver-live-location-background-task";

const BACKGROUND_SYNC_MIN_INTERVAL_MS = 15000;
const LAST_SYNC_AT_KEY = "@driver_bg_last_sync_at";
const AVAILABLE_CACHE_KEY = DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY;
const ACTIVE_DELIVERY_CACHE_KEY = "@driver_bg_active_delivery_ids";
const LOCATION_UPLOAD_QUEUE_KEY = "@driver_location_upload_queue";
const ACTIVE_DELIVERY_CACHE_MAX_AGE_MS = 90000;
const MAX_QUEUED_LOCATION_UPDATES = 60;

// Track consecutive failures to avoid premature stop
let consecutiveEmptyFetches = 0;
const MAX_EMPTY_FETCHES_BEFORE_STOP = 3;

function getTaskManagerApi() {
  if (!TaskManager) return null;

  if (
    typeof TaskManager.isTaskDefined !== "function" ||
    typeof TaskManager.defineTask !== "function"
  ) {
    return null;
  }

  return TaskManager;
}

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

  if (!isValidCoordinatePair(latitude, longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    heading: Number.isFinite(heading) ? heading : null,
    speed: Number.isFinite(speed) ? speed : null,
    timestamp: Date.now(),
  };
}

function normalizeDeliveryIds(deliveryIds) {
  if (!Array.isArray(deliveryIds)) return [];

  const seen = new Set();
  const normalized = [];

  for (const rawId of deliveryIds) {
    const id = String(rawId || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

async function readActiveDeliveryCache() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_DELIVERY_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      ids: normalizeDeliveryIds(parsed.ids || []),
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    return null;
  }
}

async function writeActiveDeliveryCache(deliveryIds) {
  const normalizedIds = normalizeDeliveryIds(deliveryIds);

  try {
    await AsyncStorage.setItem(
      ACTIVE_DELIVERY_CACHE_KEY,
      JSON.stringify({
        ids: normalizedIds,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache writes.
  }

  return normalizedIds;
}

export async function cacheDriverActiveDeliveryIds(deliveryIds) {
  return writeActiveDeliveryCache(deliveryIds);
}

export async function getCachedDriverActiveDeliveryIds() {
  const cached = await readActiveDeliveryCache();
  if (!cached) return [];
  return cached.ids;
}

async function readQueuedLocationUpdates() {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueuedLocationUpdates(queue) {
  try {
    await AsyncStorage.setItem(
      LOCATION_UPLOAD_QUEUE_KEY,
      JSON.stringify(Array.isArray(queue) ? queue : []),
    );
  } catch {
    // Ignore queue write errors.
  }
}

async function enqueueLocationUpdate(location) {
  try {
    const queue = await readQueuedLocationUpdates();
    queue.push({
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading ?? null,
      speed: location.speed ?? null,
      timestamp: location.timestamp || Date.now(),
    });

    if (queue.length > MAX_QUEUED_LOCATION_UPDATES) {
      queue.splice(0, queue.length - MAX_QUEUED_LOCATION_UPDATES);
    }

    await writeQueuedLocationUpdates(queue);
  } catch {
    // Ignore enqueue failures.
  }
}

async function patchAvailableCache(location) {
  try {
    const scopedCacheKey =
      await getCurrentDriverScopedCacheKey(AVAILABLE_CACHE_KEY);
    const raw =
      (await AsyncStorage.getItem(scopedCacheKey)) ||
      (await AsyncStorage.getItem(AVAILABLE_CACHE_KEY));
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
      [scopedCacheKey, nextRaw],
      [AVAILABLE_CACHE_KEY, nextRaw],
    ]);
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
  const cached = await readActiveDeliveryCache();
  const now = Date.now();

  if (
    cached?.ids?.length &&
    Number.isFinite(cached.updatedAt) &&
    now - cached.updatedAt <= ACTIVE_DELIVERY_CACHE_MAX_AGE_MS
  ) {
    return cached.ids;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // API failed — don't return empty, use stale cache if available
      return cached?.ids || [];
    }

    const payload = await response.json().catch(() => ({}));
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

    return writeActiveDeliveryCache(activeIds);
  } catch {
    // Network error — use stale cache to keep tracking alive
    return cached?.ids || [];
  }
}

async function uploadLocationToDeliveries({ token, deliveryIds, location }) {
  if (!token || !deliveryIds.length || !location) return false;

  const results = await Promise.all(
    deliveryIds.map((deliveryId) =>
      fetch(`${API_BASE_URL}/driver/deliveries/${deliveryId}/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? null,
          speed: location.speed ?? null,
          timestamp: location.timestamp || Date.now(),
        }),
      })
        .then((response) => response.ok)
        .catch(() => false),
    ),
  );

  return results.some(Boolean);
}

export async function flushQueuedDriverLocationUpdates() {
  const token = await getAccessToken();
  if (!token) return;

  const deliveryIds = await getActiveDeliveryIds(token);
  if (!deliveryIds.length) return;

  const queue = await readQueuedLocationUpdates();
  if (!queue.length) return;

  const pending = [...queue];
  const failed = [];

  for (const sample of pending) {
    const ok = await uploadLocationToDeliveries({
      token,
      deliveryIds,
      location: sample,
    });
    if (!ok) {
      failed.push(sample);
    }
  }

  await writeQueuedLocationUpdates(failed);
}

async function syncLocationToBackend(location) {
  const token = await getAccessToken();
  if (!token) {
    await enqueueLocationUpdate(location);
    return;
  }

  const activeDeliveryIds = await getActiveDeliveryIds(token);
  if (!activeDeliveryIds.length) {
    // Don't stop immediately — might be a temporary API failure.
    // Only stop after multiple consecutive empty fetches.
    consecutiveEmptyFetches += 1;
    if (consecutiveEmptyFetches >= MAX_EMPTY_FETCHES_BEFORE_STOP) {
      consecutiveEmptyFetches = 0;
      await stopDriverBackgroundLocationTracking().catch(() => {});
    } else {
      // Queue the location in case we get IDs next time
      await enqueueLocationUpdate(location);
    }
    return;
  }

  // Reset consecutive empty counter on success
  consecutiveEmptyFetches = 0;

  const uploaded = await uploadLocationToDeliveries({
    token,
    deliveryIds: activeDeliveryIds,
    location,
  });

  if (!uploaded) {
    await enqueueLocationUpdate(location);
    return;
  }

  await flushQueuedDriverLocationUpdates();
}

const taskManagerApi = getTaskManagerApi();

if (
  taskManagerApi &&
  !taskManagerApi.isTaskDefined(DRIVER_BACKGROUND_LOCATION_TASK)
) {
  taskManagerApi.defineTask(
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
  if (!getTaskManagerApi()) {
    return { ok: false, reason: "task_manager_unavailable" };
  }

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

  // Reset consecutive empty counter when starting fresh
  consecutiveEmptyFetches = 0;

  await Location.startLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 15000,
    deferredUpdatesInterval: 10000,
    distanceInterval: 10,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android: use motorized vehicle activity type for best GPS behavior
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: "Meezo Driver Tracking",
      notificationBody: "Live location is active during deliveries",
      notificationColor: "#06C168",
      // Keep the foreground service alive even when user swipes the app away
      killServiceOnDestroy: false,
    },
  });

  return { ok: true, reason: "started" };
}

export async function stopDriverBackgroundLocationTracking() {
  if (!getTaskManagerApi()) {
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_BACKGROUND_LOCATION_TASK,
  );

  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_BACKGROUND_LOCATION_TASK);
  }

  // Reset counter
  consecutiveEmptyFetches = 0;

  await Promise.allSettled([
    AsyncStorage.removeItem(LAST_SYNC_AT_KEY),
    AsyncStorage.removeItem(ACTIVE_DELIVERY_CACHE_KEY),
    AsyncStorage.removeItem(LOCATION_UPLOAD_QUEUE_KEY),
  ]);
}
