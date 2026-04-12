/**
 * Available Deliveries Screen (React Native)
 *
 * Converted from web version with same logic and styling:
 * - Full-screen map for each delivery with Carto tiles (FREE)
 * - Route polylines (driver → restaurant → customer)
 * - Curved dashed lines for stacked deliveries
 * - Accept/Decline functionality
 * - Stacked delivery bonuses & tips
 * - Real-time updates via WebSocket
 * - Location tracking every 3 seconds
 * - Movement threshold refresh (50m)
 * - Caching for instant load
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FreeMapView from "../../components/maps/FreeMapView";
import { DriverMapSheetLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { API_BASE_URL } from "../../constants/api";
import { useSocket } from "../../context/SocketContext";
import { approximateDistanceMeters } from "../../utils/osrmClient";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = "available_deliveries_cache";
const CACHE_EXPIRY = 60000; // 1 minute cache
const DATA_REFRESH_THRESHOLD = 200; // Only fetch API data when driver moves 200m+
const LIVE_TRACKING_INTERVAL = 3000; // 3 seconds - smooth driver marker updates
const LOCATION_MAX_ACCURACY_METERS = 250;
const LOCATION_MAX_RETRIES = 3;
const LOCATION_RETRY_DELAY_MS = 1200;

// Default driver location (Kinniya, Sri Lanka)
const DEFAULT_DRIVER_LOCATION = {
  latitude: 8.5017,
  longitude: 81.186,
};

// Carto Voyager tiles (FREE - no API key needed)
const CARTO_TILE_URL =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

// Keep first-visit loading UX strict: full skeleton only on first screen visit.
let hasVisitedAvailableDeliveriesScreen = false;

// ============================================================================
// CACHE HELPERS
// ============================================================================

const loadCachedData = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
  } catch (e) {
    console.warn("Cache load error:", e);
  }
  return null;
};

const saveCacheData = async (data) => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch (e) {
    console.warn("Cache save error:", e);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const isValidLocation = (location) => {
  if (!location) return false;
  const { latitude, longitude } = location;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;

  // Guard against null-island style fallback coordinates.
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return false;
  return true;
};

const toValidLocation = (lat, lng) => {
  const parsed = {
    latitude: Number.parseFloat(lat),
    longitude: Number.parseFloat(lng),
  };
  return isValidLocation(parsed) ? parsed : null;
};

const hasValidDeliveryCoordinates = (delivery) => {
  const restaurantPoint = toValidLocation(
    delivery?.restaurant?.latitude,
    delivery?.restaurant?.longitude,
  );
  const customerPoint = toValidLocation(
    delivery?.customer?.latitude,
    delivery?.customer?.longitude,
  );

  return Boolean(restaurantPoint && customerPoint);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AvailableDeliveriesScreen({ navigation }) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const rawTabBarHeight = useBottomTabBarHeight();
  const tabBarHeight = useMemo(
    () => Math.max(rawTabBarHeight || 0, 76 + insets.bottom),
    [rawTabBarHeight, insets.bottom],
  );
  const queryClient = useQueryClient();
  const { on, off, isConnected } = useSocket();
  const isFocusedRef = useRef(true);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const viewportHeight = useMemo(
    () => Math.max(320, Math.round(listViewportHeight || SCREEN_HEIGHT)),
    [listViewportHeight],
  );
  const mapViewportHeight = useMemo(
    () => Math.round(viewportHeight * 0.46),
    [viewportHeight],
  );

  const [userId, setUserId] = useState("default");
  const deliveriesQueryKey = useMemo(
    () => ["driver", "available-deliveries", userId],
    [userId],
  );

  // Keep ref in sync (so callbacks see latest value without re-creating)
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Initialize with cached data for instant display
  const [deliveries, setDeliveries] = useState([]);
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(
    () => !hasVisitedAvailableDeliveriesScreen,
  );
  const [hasCompletedFirstFetch, setHasCompletedFirstFetch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeliveriesSyncing, setIsDeliveriesSyncing] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [isLocationResolved, setIsLocationResolved] = useState(false);
  const [locationStatusMessage, setLocationStatusMessage] = useState(
    "Loading available deliveries...",
  );
  const [inDeliveringMode, setInDeliveringMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState({
    total_stops: 0,
    active_deliveries: 0,
  });
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [showNewDeliveryBanner, setShowNewDeliveryBanner] = useState(false);
  const [isLoadingAfterAccept, setIsLoadingAfterAccept] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const deliveryMetaRef = useRef(new Map());
  const arrivalSeqRef = useRef(0);
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    if (!viewableItems?.length) return;
    const next = viewableItems[0]?.index;
    if (typeof next === "number") {
      setCurrentVisibleIndex(next);
    }
  });

  // Refs
  const flatListRef = useRef(null);
  const abortControllerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const fetchPendingDeliveriesRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const fetchInFlightRef = useRef(false);

  const syncDeliveryMeta = useCallback((incomingDeliveries) => {
    const meta = deliveryMetaRef.current;
    const idsInList = new Set();

    incomingDeliveries.forEach((delivery) => {
      const id = delivery.delivery_id;
      idsInList.add(id);
      if (!meta.has(id)) {
        meta.set(id, {
          priorityTs: ++arrivalSeqRef.current,
        });
      }
    });

    for (const id of meta.keys()) {
      if (!idsInList.has(id)) {
        meta.delete(id);
      }
    }
  }, []);

  const applyPrioritizedSort = useCallback(
    (incomingDeliveries) => {
      syncDeliveryMeta(incomingDeliveries);
      return incomingDeliveries;
    },
    [syncDeliveryMeta],
  );

  // Animation for toast
  const toastAnim = useRef(new Animated.Value(0)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initScreen();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!isFocused || !isLocationResolved || !hasCompletedFirstFetch) return;
    fetchDeliveriesWithCurrentLocation(true, "screen_focus");
  }, [
    isFocused,
    isLocationResolved,
    hasCompletedFirstFetch,
    fetchDeliveriesWithCurrentLocation,
  ]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const storedUserId = (await AsyncStorage.getItem("userId")) || "default";
      if (mounted) {
        setUserId(storedUserId);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const cachedQueryData = queryClient.getQueryData(deliveriesQueryKey);
    if (!cachedQueryData) return;

    const cachedDeliveries = cachedQueryData.deliveries || [];
    setDeliveries(applyPrioritizedSort(cachedDeliveries));
    setCurrentRoute(
      cachedQueryData.currentRoute || { total_stops: 0, active_deliveries: 0 },
    );

    if (isValidLocation(cachedQueryData.driverLocation)) {
      setDriverLocation(cachedQueryData.driverLocation);
    }
  }, [deliveriesQueryKey, queryClient, applyPrioritizedSort]);

  const initScreen = async () => {
    setLocationStatusMessage("Loading available deliveries...");

    if (hasVisitedAvailableDeliveriesScreen) {
      setInitialLoading(false);
    }

    let hydratedFromCache = false;

    const querySnapshot = queryClient.getQueryData(deliveriesQueryKey);
    if (querySnapshot?.deliveries?.length) {
      const cachedDeliveries = (querySnapshot.deliveries || []).filter(
        hasValidDeliveryCoordinates,
      );
      setDeliveries(applyPrioritizedSort(cachedDeliveries));
      setCurrentRoute(
        querySnapshot.currentRoute || { total_stops: 0, active_deliveries: 0 },
      );
      setHasCompletedFirstFetch(true);
      setInitialLoading(false);
      hasVisitedAvailableDeliveriesScreen = true;
      hydratedFromCache = true;
    }

    if (!hydratedFromCache) {
      const storageSnapshot = await loadCachedData();
      if (storageSnapshot?.deliveries?.length) {
        const cachedDeliveries = (storageSnapshot.deliveries || []).filter(
          hasValidDeliveryCoordinates,
        );
        setDeliveries(applyPrioritizedSort(cachedDeliveries));
        setCurrentRoute(
          storageSnapshot.currentRoute || {
            total_stops: 0,
            active_deliveries: 0,
          },
        );
        if (isValidLocation(storageSnapshot.driverLocation)) {
          setDriverLocation(storageSnapshot.driverLocation);
          lastFetchLocationRef.current = storageSnapshot.driverLocation;
        }
        setHasCompletedFirstFetch(true);
        setInitialLoading(false);
        hasVisitedAvailableDeliveriesScreen = true;
        hydratedFromCache = true;
      }
    }

    const location = await getLocation();
    if (!isValidLocation(location)) {
      if (!hydratedFromCache) {
        setFetchError(
          "Unable to confirm your current location. Turn on GPS and try again.",
        );
        // Avoid infinite skeleton when location cannot be resolved on first load.
        setHasCompletedFirstFetch(true);
        setInitialLoading(false);
        hasVisitedAvailableDeliveriesScreen = true;
      }
      // Still try to start watcher so the app can recover as soon as GPS is available.
      startLocationTracking();
      return;
    }

    setDriverLocation(location);
    setIsLocationResolved(true);
    lastFetchLocationRef.current = location;

    // Check if driver is in delivering mode
    await checkDeliveringMode(location);

    if (!hydratedFromCache) {
      await fetchPendingDeliveriesWithLocation(location, true, "screen_init");
    }

    // Start location tracking every 3 seconds
    startLocationTracking();
  };

  useEffect(() => {
    if (!hasCompletedFirstFetch || initialLoading || deliveries.length === 0) {
      listFadeAnim.setValue(0);
      return;
    }

    Animated.timing(listFadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [deliveries.length, hasCompletedFirstFetch, initialLoading, listFadeAnim]);

  const cleanup = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // ============================================================================
  // LOCATION TRACKING
  // ============================================================================

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[LOCATION] Permission denied");
        setLocationStatusMessage("Location permission is required");
        return null;
      }

      for (let attempt = 1; attempt <= LOCATION_MAX_RETRIES; attempt += 1) {
        setLocationStatusMessage(
          `Confirming your current location (${attempt}/${LOCATION_MAX_RETRIES})...`,
        );

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 0,
          mayShowUserSettingsDialog: true,
        });

        const candidate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const accuracy = Number(position.coords.accuracy || Infinity);
        const hasGoodAccuracy = accuracy <= LOCATION_MAX_ACCURACY_METERS;

        if (isValidLocation(candidate) && hasGoodAccuracy) {
          setLocationStatusMessage("Location confirmed");
          return candidate;
        }

        if (attempt < LOCATION_MAX_RETRIES) {
          await sleep(LOCATION_RETRY_DELAY_MS);
        }
      }

      // Last fallback: recent last-known location if it is reasonably accurate.
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 10000,
        requiredAccuracy: LOCATION_MAX_ACCURACY_METERS,
      });

      if (lastKnown) {
        const fallbackLocation = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        if (isValidLocation(fallbackLocation)) {
          setLocationStatusMessage("Using recently confirmed location");
          return fallbackLocation;
        }
      }

      setLocationStatusMessage("Unable to confirm location");
      return null;
    } catch (err) {
      console.error("[LOCATION] Error:", err);
      setLocationStatusMessage("Unable to confirm location");
      return null;
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Watch position: fires every 3s for smooth live tracking
      // distanceInterval: 0 so marker updates continuously
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LIVE_TRACKING_INTERVAL, // 3 seconds
          distanceInterval: 0, // Always fire for smooth marker updates
        },
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          if (!isValidLocation(location)) return;

          // Always update driver marker on map (smooth live tracking every 3s)
          setDriverLocation(location);
          setIsLocationResolved(true);

          // Only fetch API data when moved 200m+ from last fetch
          if (lastFetchLocationRef.current) {
            const distanceMoved = approximateDistanceMeters(
              lastFetchLocationRef.current,
              location,
            );

            if (distanceMoved >= DATA_REFRESH_THRESHOLD) {
              // Only trigger API refresh when this tab is focused
              if (!isFocusedRef.current) return;
              console.log(
                `[LOCATION] 🚗 Driver moved ${distanceMoved.toFixed(0)}m (threshold: ${DATA_REFRESH_THRESHOLD}m) - Triggering refresh`,
              );
              lastFetchLocationRef.current = location;
              if (fetchPendingDeliveriesRef.current) {
                fetchPendingDeliveriesRef.current(
                  location,
                  true,
                  "movement_200m",
                );
              }
            }
          }
        },
      );
    } catch (err) {
      console.error("[LOCATION] Watch error:", err);
      // Fallback to interval-based updates
      locationIntervalRef.current = setInterval(async () => {
        const location = await getLocation();
        if (!isValidLocation(location)) return;
        setDriverLocation(location);
        setIsLocationResolved(true);
      }, LIVE_TRACKING_INTERVAL);
    }
  };

  const fetchDeliveriesWithCurrentLocation = useCallback(
    async (isBackgroundRefresh = false, triggerReason = "manual") => {
      const location = await getLocation();
      if (!isValidLocation(location)) {
        setFetchError(
          "Unable to confirm your location. Please enable GPS and retry.",
        );
        if (!hasCompletedFirstFetch) {
          setHasCompletedFirstFetch(true);
          setInitialLoading(false);
        }
        return;
      }
      setDriverLocation(location);
      setIsLocationResolved(true);
      lastFetchLocationRef.current = location;
      await fetchPendingDeliveriesWithLocation(
        location,
        isBackgroundRefresh,
        triggerReason,
      );
    },
    [hasCompletedFirstFetch],
  );

  // ============================================================================
  // CHECK DELIVERING MODE
  // ============================================================================

  const checkDeliveringMode = async (verifiedLocation) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const currentLoc =
        verifiedLocation && isValidLocation(verifiedLocation)
          ? verifiedLocation
          : driverLocation;

      if (!isValidLocation(currentLoc)) {
        return;
      }

      const res = await rateLimitedFetch(
        `${API_BASE_URL}/driver/deliveries/pickups?driver_latitude=${currentLoc.latitude}&driver_longitude=${currentLoc.longitude}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        if (!data.pickups || data.pickups.length === 0) {
          const activeRes = await rateLimitedFetch(
            `${API_BASE_URL}/driver/deliveries/active`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            const hasDeliveringOrders = activeData.deliveries?.some((d) =>
              ["picked_up", "on_the_way", "at_customer"].includes(d.status),
            );
            if (hasDeliveringOrders) {
              setInDeliveringMode(true);
              const preferredDelivery =
                activeData.deliveries?.find((d) =>
                  ["picked_up", "on_the_way", "at_customer"].includes(d.status),
                ) || activeData.deliveries?.[0];
              setTimeout(
                () =>
                  navigation.navigate("DriverMap", {
                    deliveryId: preferredDelivery?.delivery_id,
                  }),
                100,
              );
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to check delivering mode:", e);
    }
  };

  // ============================================================================
  // FETCH DELIVERIES
  // ============================================================================

  const fetchPendingDeliveriesWithLocation = async (
    location,
    showLoading = true,
    triggerReason = "manual",
  ) => {
    if (!isValidLocation(location)) {
      setFetchError("Cannot fetch deliveries without a valid driver location.");
      setInitialLoading(false);
      return;
    }

    if (fetchInFlightRef.current) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    fetchInFlightRef.current = true;

    try {
      setIsDeliveriesSyncing(true);

      if (!hasCompletedFirstFetch && showLoading) {
        if (!hasVisitedAvailableDeliveriesScreen) {
          setInitialLoading(true);
        }
      } else if (!showLoading) {
        setIsRefreshing(true);
      }

      const token = await AsyncStorage.getItem("token");
      const currentLoc = location;

      const url = `${API_BASE_URL}/driver/deliveries/available/v2?driver_latitude=${currentLoc.latitude}&driver_longitude=${currentLoc.longitude}&trigger_reason=${encodeURIComponent(triggerReason)}`;

      console.log(`[FETCH] Trigger: ${triggerReason}`);
      console.log("[FETCH] Requesting available deliveries from:", url);

      const res = await rateLimitedFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal,
      });

      console.log("[FETCH] Response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("[FETCH] Response data:", {
        total_available: data.total_available,
        deliveries_count: data.available_deliveries?.length || 0,
        current_route: data.current_route,
      });

      const deliveriesArray = data.available_deliveries || [];
      const validDeliveries = deliveriesArray.filter(
        hasValidDeliveryCoordinates,
      );
      const skippedInvalidCount =
        deliveriesArray.length - validDeliveries.length;

      if (skippedInvalidCount > 0) {
        console.warn(
          `[FETCH] Skipped ${skippedInvalidCount} deliveries with invalid restaurant/customer coordinates`,
        );
      }

      setDeclinedIds((prev) => {
        const availableIds = new Set(validDeliveries.map((d) => d.delivery_id));
        return new Set([...prev].filter((id) => availableIds.has(id)));
      });
      setDeliveries(applyPrioritizedSort(validDeliveries));

      const newCurrentRoute = data.current_route || {
        total_stops: 0,
        active_deliveries: 0,
      };
      setCurrentRoute(newCurrentRoute);

      const newDriverLocation = isValidLocation(currentLoc)
        ? currentLoc
        : toValidLocation(
            data?.driver_location?.latitude,
            data?.driver_location?.longitude,
          );
      setDriverLocation(newDriverLocation);
      setIsLocationResolved(true);

      // Save to cache
      await saveCacheData({
        deliveries: validDeliveries,
        currentRoute: newCurrentRoute,
        driverLocation: newDriverLocation,
      });

      queryClient.setQueryData(deliveriesQueryKey, {
        deliveries: validDeliveries,
        currentRoute: newCurrentRoute,
        driverLocation: newDriverLocation,
      });

      setFetchError(null);
      setHasCompletedFirstFetch(true);
      hasVisitedAvailableDeliveriesScreen = true;
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("❌ [FRONTEND] Failed to fetch deliveries:", e);

      const errorMessage = e.message.includes("NetworkError")
        ? "No internet connection. Retrying..."
        : e.message.includes("HTTP 500")
          ? "Server error. Please try again."
          : e.message.includes("HTTP 401")
            ? "Authentication failed. Please log in again."
            : e.message || "Failed to fetch deliveries";

      setFetchError(errorMessage);
      if (!hasCompletedFirstFetch) {
        setHasCompletedFirstFetch(true);
        hasVisitedAvailableDeliveriesScreen = true;
      }
    } finally {
      setIsDeliveriesSyncing(false);
      setInitialLoading(false);
      setIsRefreshing(false);
      fetchInFlightRef.current = false;
    }
  };

  // Store fetch function in ref
  fetchPendingDeliveriesRef.current = fetchPendingDeliveriesWithLocation;

  useEffect(() => {
    setIsSocketConnected(Boolean(isConnected));
  }, [isConnected]);

  useEffect(() => {
    if (!on || !off) return;

    const handleNewDelivery = () => {
      if (!isFocusedRef.current) return;
      setShowNewDeliveryBanner(true);
      fetchDeliveriesWithCurrentLocation(true, "socket_new_delivery");
    };

    const handleTipUpdated = () => {
      if (!isFocusedRef.current) return;
      fetchDeliveriesWithCurrentLocation(true, "socket_tip_update");
    };

    const handleDeliveryTaken = (payload) => {
      const takenId = payload?.delivery_id;
      if (!takenId) return;

      setDeliveries((prev) => prev.filter((d) => d.delivery_id !== takenId));

      setDeclinedIds((prev) => {
        if (!prev.has(takenId)) return prev;
        const next = new Set(prev);
        next.delete(takenId);
        return next;
      });
    };

    on("delivery:new", handleNewDelivery);
    on("delivery:tip_updated", handleTipUpdated);
    on("delivery:taken", handleDeliveryTaken);

    return () => {
      off("delivery:new", handleNewDelivery);
      off("delivery:tip_updated", handleTipUpdated);
      off("delivery:taken", handleDeliveryTaken);
    };
  }, [
    on,
    off,
    queryClient,
    deliveriesQueryKey,
    currentRoute,
    driverLocation,
    fetchDeliveriesWithCurrentLocation,
  ]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleAcceptDelivery = async (deliveryId, deliverySnapshot = null) => {
    if (isDeliveriesSyncing || isLoadingAfterAccept) {
      showToast("Updating requests...", "error");
      return;
    }

    setAccepting(deliveryId);
    try {
      const token = await AsyncStorage.getItem("token");
      const delivery =
        deliverySnapshot ||
        deliveries.find((d) => d.delivery_id === deliveryId);

      const body = {
        driver_latitude: driverLocation?.latitude,
        driver_longitude: driverLocation?.longitude,
        earnings_data: delivery
          ? {
              delivery_sequence: currentRoute.active_deliveries + 1,
              base_amount:
                delivery.route_impact?.base_amount ||
                delivery.pricing?.total_trip_earnings ||
                0,
              extra_earnings: delivery.route_impact?.extra_earnings || 0,
              bonus_amount: delivery.route_impact?.bonus_amount || 0,
              tip_amount: parseFloat(delivery.pricing?.tip_amount || 0),
              r0_distance_km: delivery.route_impact?.r0_distance_km || null,
              r1_distance_km:
                delivery.route_impact?.r1_distance_km ||
                delivery.total_delivery_distance_km ||
                0,
              extra_distance_km: delivery.route_impact?.extra_distance_km || 0,
              total_distance_km: delivery.total_delivery_distance_km || 0,
            }
          : null,
      };

      const res = await fetch(
        `${API_BASE_URL}/driver/deliveries/${deliveryId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json();

      if (res.ok) {
        setIsLoadingAfterAccept(true);
        showToast("✅ Delivery accepted!");
        await fetchDeliveriesWithCurrentLocation(true, "delivery_accepted");
        navigation.navigate("DriverMap", { deliveryId });
      } else {
        if (data?.driver_status === "suspended") {
          Alert.alert(
            "Account Suspended",
            data.message ||
              "Deposit the collected money to the Meezo platform before accepting new deliveries.",
          );
        }
        showToast(data.message || "Failed to accept delivery", "error");
      }
    } catch (e) {
      console.error("Accept error:", e);
      showToast("Failed to accept delivery", "error");
    } finally {
      setAccepting(null);
      setIsLoadingAfterAccept(false);
    }
  };

  const handleDecline = (deliveryId, cardIndex) => {
    setDeclinedIds((prev) => new Set([...prev, deliveryId]));

    // Keep flow continuous: move declined card to bottom and focus adjacent card.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!flatListRef.current || typeof cardIndex !== "number") return;
        const nextIndex = Math.max(0, cardIndex);
        flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
      });
    });
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  };

  const onRefresh = useCallback(() => {
    fetchDeliveriesWithCurrentLocation(true, "pull_to_refresh");
  }, []);

  const getTipAmount = useCallback((delivery) => {
    return Number.parseFloat(delivery?.pricing?.tip_amount || 0);
  }, []);

  const getCreatedAtTimestamp = useCallback((delivery) => {
    const candidates = [
      delivery?.created_at,
      delivery?.delivery_created_at,
      delivery?.orders?.created_at,
      delivery?.orders?.[0]?.created_at,
    ];

    for (const raw of candidates) {
      if (!raw) continue;
      const ts = new Date(raw).getTime();
      if (Number.isFinite(ts)) return ts;
    }

    return Number.MAX_SAFE_INTEGER;
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Sort deliveries: non-declined first, then tip-provided first, then oldest first.
  const sortedDeliveries = useMemo(() => {
    const meta = deliveryMetaRef.current;
    const deduped = [];
    const seen = new Set();
    for (const delivery of deliveries) {
      if (!delivery?.delivery_id || seen.has(delivery.delivery_id)) continue;
      seen.add(delivery.delivery_id);
      deduped.push(delivery);
    }

    const originalIndex = new Map(
      deduped.map((delivery, index) => [delivery.delivery_id, index]),
    );

    return [...deduped].sort((a, b) => {
      const aDeclined = declinedIds.has(a.delivery_id);
      const bDeclined = declinedIds.has(b.delivery_id);
      if (aDeclined !== bDeclined) return aDeclined ? 1 : -1;

      const aTip = getTipAmount(a);
      const bTip = getTipAmount(b);
      const aHasTip = aTip > 0;
      const bHasTip = bTip > 0;
      if (aHasTip !== bHasTip) return aHasTip ? -1 : 1;

      const aCreatedAt = getCreatedAtTimestamp(a);
      const bCreatedAt = getCreatedAtTimestamp(b);
      if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;

      const priorityA = Number(meta.get(a.delivery_id)?.priorityTs || 0);
      const priorityB = Number(meta.get(b.delivery_id)?.priorityTs || 0);
      if (priorityA !== priorityB) return priorityB - priorityA;

      return (
        (originalIndex.get(a.delivery_id) || 0) -
        (originalIndex.get(b.delivery_id) || 0)
      );
    });
  }, [deliveries, declinedIds, getCreatedAtTimestamp, getTipAmount]);

  const displayOrderById = useMemo(() => {
    const orderMap = new Map();
    sortedDeliveries.forEach((delivery, index) => {
      orderMap.set(delivery.delivery_id, index);
    });
    return orderMap;
  }, [sortedDeliveries]);

  const renderDeliveryCard = ({ item, index }) => {
    const isDeclined = declinedIds.has(item.delivery_id);
    const nonDeclinedBefore = sortedDeliveries
      .slice(0, index)
      .filter((d) => !declinedIds.has(d.delivery_id)).length;
    const isFirstNonDeclined = !isDeclined && nonDeclinedBefore === 0;

    return (
      <DeliveryCard
        delivery={item}
        driverLocation={driverLocation}
        viewportHeight={viewportHeight}
        mapViewportHeight={mapViewportHeight}
        tabBarHeight={tabBarHeight}
        accepting={accepting === item.delivery_id}
        isSyncing={isDeliveriesSyncing || isLoadingAfterAccept}
        onAccept={handleAcceptDelivery}
        onDecline={handleDecline}
        hasActiveDeliveries={currentRoute.active_deliveries > 0}
        isFirstDelivery={isFirstNonDeclined}
        isDeclined={isDeclined}
        cardIndex={displayOrderById.get(item.delivery_id) ?? index}
        currentIndex={(displayOrderById.get(item.delivery_id) ?? index) + 1}
        totalAvailable={sortedDeliveries.length || deliveries.length}
        isMapActive={Math.abs(index - currentVisibleIndex) <= 1}
        onBack={() => navigation.goBack()}
      />
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Toast Notification */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            toast.type === "error" ? styles.toastError : styles.toastSuccess,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* New Delivery Banner */}
      {showNewDeliveryBanner && (
        <Animated.View style={styles.newDeliveryBanner}>
          <View style={styles.bannerIcon}>
            <Text style={styles.bannerIconText}>🔔</Text>
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>🚨 New Delivery Available!</Text>
            <Text style={styles.bannerSubtitle}>Tap to view details</Text>
          </View>
          <Pressable
            style={styles.bannerClose}
            onPress={() => setShowNewDeliveryBanner(false)}
          >
            <Text style={styles.bannerCloseText}>✕</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Error Banner */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {fetchError}</Text>
          <Pressable
            onPress={() =>
              fetchDeliveriesWithCurrentLocation(false, "banner_refresh")
            }
          >
            <Text style={styles.errorRetry}>Retry</Text>
          </Pressable>
        </View>
      )}

      <DriverScreenSection
        screenKey="AvailableDeliveries"
        sectionIndex={0}
        style={{ flex: 1 }}
      >
        {/* Content */}
        {inDeliveringMode ? (
          <View style={styles.deliveringContainer}>
            <Text style={styles.deliveringEmoji}></Text>
            <Text style={styles.deliveringTitle}>Currently Delivering</Text>
            <Text style={styles.deliveringSubtitle}>
              Complete current deliveries first
            </Text>
            <Pressable
              style={styles.goToActiveBtn}
              onPress={() => navigation.navigate("Active")}
            >
              <Text style={styles.goToActiveBtnText}>
                Go to Active Deliveries
              </Text>
            </Pressable>
          </View>
        ) : !hasVisitedAvailableDeliveriesScreen &&
          initialLoading &&
          !hasCompletedFirstFetch ? (
          <DriverMapSheetLoadingSkeleton />
        ) : deliveries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No Deliveries Near You</Text>
            <Text style={styles.emptySubtitle}>
              {currentRoute.active_deliveries >= 5
                ? "You've reached the maximum of 5 deliveries. Complete some deliveries first."
                : "No delivery requests available in your area right now. We'll notify you when new orders come in!"}
            </Text>
            <View style={styles.emptyButtons}>
              <Pressable
                style={styles.refreshBtn}
                onPress={() => {
                  fetchDeliveriesWithCurrentLocation(false, "retry_button");
                }}
              >
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
              {currentRoute.active_deliveries > 0 && (
                <Pressable
                  style={styles.viewActiveBtn}
                  onPress={() => navigation.navigate("Active")}
                >
                  <Text style={styles.viewActiveBtnText}>
                    View Active ({currentRoute.active_deliveries})
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <Animated.View
            style={{
              flex: 1,
              opacity: listFadeAnim,
              transform: [
                {
                  translateY: listFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }}
            onLayout={(event) => {
              const measuredHeight = Math.round(
                event?.nativeEvent?.layout?.height || 0,
              );
              if (measuredHeight > 0 && measuredHeight !== listViewportHeight) {
                setListViewportHeight(measuredHeight);
              }
            }}
          >
            <FlatList
              ref={flatListRef}
              data={sortedDeliveries}
              renderItem={renderDeliveryCard}
              scrollEnabled={true}
              keyExtractor={(item) => item.delivery_id.toString()}
              showsVerticalScrollIndicator={false}
              pagingEnabled={true}
              snapToInterval={viewportHeight}
              snapToAlignment="start"
              disableIntervalMomentum={true}
              decelerationRate="fast"
              bounces={false}
              directionalLockEnabled
              scrollEventThrottle={32}
              onMomentumScrollEnd={(event) => {
                const y = event?.nativeEvent?.contentOffset?.y || 0;
                const targetIndex = Math.round(y / viewportHeight);
                const targetOffset = targetIndex * viewportHeight;
                if (Math.abs(y - targetOffset) > 1) {
                  flatListRef.current?.scrollToOffset({
                    offset: targetOffset,
                    animated: false,
                  });
                }
              }}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={2}
              removeClippedSubviews={Platform.OS === "android"}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
              viewabilityConfig={viewabilityConfigRef.current}
              getItemLayout={(_, index) => ({
                length: viewportHeight,
                offset: viewportHeight * index,
                index,
              })}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor="#13ec37"
                  colors={["#13ec37"]}
                />
              }
              contentContainerStyle={{ paddingBottom: 0 }}
            />
          </Animated.View>
        )}
      </DriverScreenSection>
    </View>
  );
}

// ============================================================================
// DELIVERY CARD COMPONENT
// ============================================================================

function DeliveryCard({
  delivery,
  driverLocation,
  viewportHeight,
  mapViewportHeight,
  tabBarHeight = 0,
  accepting,
  isSyncing = false,
  onAccept,
  onDecline,
  onBack,
  hasActiveDeliveries,
  isFirstDelivery = false,
  isDeclined = false,
  cardIndex = 0,
  currentIndex = 1,
  totalAvailable = 1,
  isMapActive = true,
}) {
  const {
    delivery_id,
    order_number,
    restaurant,
    customer,
    pricing,
    estimated_time_minutes,
    route_impact = {},
    can_accept = true,
    reason,
    driver_to_restaurant_route,
    restaurant_to_customer_route,
    order_items = [],
    total_delivery_distance_km = 0,
  } = delivery;

  // Extract route impact fields
  const {
    extra_distance_km = 0,
    extra_time_minutes = 0,
    base_amount = 0,
    extra_earnings = 0,
    bonus_amount = 0,
    total_trip_earnings = 0,
    r0_distance_km = 0,
    r1_distance_km = 0,
  } = route_impact || {};

  const mapRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const cardHeight = Math.round(viewportHeight || SCREEN_HEIGHT);
  const mapHeight = mapViewportHeight || Math.round(cardHeight * 0.41);
  const overlayHeight = Math.max(370, cardHeight - mapHeight);
  const contentBottomInset = Math.max(18, Math.round(tabBarHeight + 10));
  const totalItems = order_items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  // Earnings calculation
  const driverEarnings =
    pricing?.total_trip_earnings || total_trip_earnings || 0;
  const tipAmount = parseFloat(pricing?.tip_amount || 0);
  const isStackedDelivery = hasActiveDeliveries;
  const showRoutes = !hasActiveDeliveries;

  // Decode polyline helper
  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    const poly = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  // Prepare route paths
  const driverToRestaurantPath = driver_to_restaurant_route?.encoded_polyline
    ? decodePolyline(driver_to_restaurant_route.encoded_polyline)
    : driver_to_restaurant_route?.coordinates?.map((coord) => ({
        latitude: coord[1],
        longitude: coord[0],
      })) || [];

  const restaurantToCustomerPath =
    restaurant_to_customer_route?.encoded_polyline
      ? decodePolyline(restaurant_to_customer_route.encoded_polyline)
      : restaurant_to_customer_route?.coordinates?.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        })) || [];

  const hasPolylineData =
    driverToRestaurantPath.length > 0 || restaurantToCustomerPath.length > 0;

  const pickupAddress =
    restaurant?.address ||
    delivery?.pickup_address ||
    delivery?.restaurant_address ||
    restaurant?.city ||
    "No pickup address";

  const dropoffAddress =
    customer?.address ||
    delivery?.dropoff_address ||
    delivery?.delivery_address ||
    delivery?.customer_address ||
    customer?.city ||
    "No drop-off address";

  // Generate curved path for stacked deliveries (fallback)
  const generateCurvedPath = useCallback((start, end, numPoints = 50) => {
    if (!start || !end) return [];

    const points = [];
    const midLat = (start.latitude + end.latitude) / 2;
    const midLng = (start.longitude + end.longitude) / 2;

    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curveIntensity = distance * 0.25;
    const perpX = (-dy / distance) * curveIntensity;
    const perpY = (dx / distance) * curveIntensity;

    const controlPoint = {
      latitude: midLat + perpY,
      longitude: midLng + perpX,
    };

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const oneMinusT = 1 - t;

      const lat =
        oneMinusT * oneMinusT * start.latitude +
        2 * oneMinusT * t * controlPoint.latitude +
        t * t * end.latitude;
      const lng =
        oneMinusT * oneMinusT * start.longitude +
        2 * oneMinusT * t * controlPoint.longitude +
        t * t * end.longitude;

      points.push({ latitude: lat, longitude: lng });
    }

    return points;
  }, []);

  // Curved paths for stacked deliveries
  const driverToRestaurantCurved = useMemo(() => {
    if (!driverLocation || !restaurant) return [];
    return generateCurvedPath(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      },
      {
        latitude: parseFloat(restaurant.latitude),
        longitude: parseFloat(restaurant.longitude),
      },
    );
  }, [driverLocation, restaurant, generateCurvedPath]);

  const restaurantToCustomerCurved = useMemo(() => {
    if (!restaurant || !customer) return [];
    return generateCurvedPath(
      {
        latitude: parseFloat(restaurant.latitude),
        longitude: parseFloat(restaurant.longitude),
      },
      {
        latitude: parseFloat(customer.latitude),
        longitude: parseFloat(customer.longitude),
      },
    );
  }, [restaurant, customer, generateCurvedPath]);

  const fitCoordinates = useMemo(() => {
    const points = [];

    if (driverLocation) {
      points.push({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      });
    }

    if (restaurant?.latitude && restaurant?.longitude) {
      points.push({
        latitude: parseFloat(restaurant.latitude),
        longitude: parseFloat(restaurant.longitude),
      });
    }

    if (customer?.latitude && customer?.longitude) {
      points.push({
        latitude: parseFloat(customer.latitude),
        longitude: parseFloat(customer.longitude),
      });
    }

    driverToRestaurantPath.forEach((p) => points.push(p));
    restaurantToCustomerPath.forEach((p) => points.push(p));
    driverToRestaurantCurved.forEach((p) => points.push(p));
    restaurantToCustomerCurved.forEach((p) => points.push(p));

    return points;
  }, [
    driverLocation,
    restaurant,
    customer,
    driverToRestaurantPath,
    restaurantToCustomerPath,
    driverToRestaurantCurved,
    restaurantToCustomerCurved,
  ]);

  // Fit once per card so map can be freely dragged after initial load.
  useEffect(() => {
    if (
      !mapRef.current ||
      hasInitialFitRef.current ||
      fitCoordinates.length < 2
    ) {
      return;
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoordinates, {
        edgePadding: {
          top: 40,
          right: 40,
          bottom: Math.round(overlayHeight + 24),
          left: 40,
        },
        animated: true,
      });
      hasInitialFitRef.current = true;
    }, 250);

    return () => clearTimeout(timer);
  }, [fitCoordinates, delivery_id, overlayHeight]);

  useEffect(() => {
    hasInitialFitRef.current = false;
  }, [delivery_id]);

  return (
    <View
      style={[
        styles.card,
        { height: cardHeight, maxHeight: cardHeight },
        isDeclined && styles.cardDeclined,
        !can_accept && styles.cardDisabled,
      ]}
    >
      <View style={styles.mapFullScreen}>
        {isMapActive && restaurant && customer ? (
          <FreeMapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: parseFloat(restaurant.latitude),
              longitude: parseFloat(restaurant.longitude),
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            markers={[
              ...(driverLocation
                ? [
                    {
                      id: "driver",
                      coordinate: {
                        latitude: driverLocation.latitude,
                        longitude: driverLocation.longitude,
                      },
                      type: "driver",
                      emoji: "➤",
                    },
                  ]
                : []),
              {
                id: "restaurant",
                coordinate: {
                  latitude: parseFloat(restaurant.latitude),
                  longitude: parseFloat(restaurant.longitude),
                },
                type: "restaurant",
                emoji: "⌂",
              },
              {
                id: "customer",
                coordinate: {
                  latitude: parseFloat(customer.latitude),
                  longitude: parseFloat(customer.longitude),
                },
                type: "customer",
                emoji: "⌖",
              },
            ]}
            polylines={[
              ...(showRoutes &&
              hasPolylineData &&
              driverToRestaurantPath.length > 1
                ? [
                    {
                      id: "driverToRestaurant",
                      coordinates: driverToRestaurantPath,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 4,
                      dashArray: isStackedDelivery ? "10 8" : "",
                    },
                  ]
                : []),
              ...(showRoutes &&
              hasPolylineData &&
              restaurantToCustomerPath.length > 1
                ? [
                    {
                      id: "restaurantToCustomer",
                      coordinates: restaurantToCustomerPath,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 3,
                      dashArray: isStackedDelivery ? "10 8" : "",
                    },
                  ]
                : []),
              ...(showRoutes &&
              !hasPolylineData &&
              driverToRestaurantCurved.length > 0
                ? [
                    {
                      id: "driverToRestaurantCurved",
                      coordinates: driverToRestaurantCurved,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 4,
                      dashArray: isStackedDelivery ? "10 8" : "",
                    },
                  ]
                : []),
              ...(showRoutes &&
              !hasPolylineData &&
              restaurantToCustomerCurved.length > 0
                ? [
                    {
                      id: "restaurantToCustomerCurved",
                      coordinates: restaurantToCustomerCurved,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 3,
                      dashArray: isStackedDelivery ? "10 8" : "",
                    },
                  ]
                : []),
              ...(isStackedDelivery && driverToRestaurantCurved.length > 0
                ? [
                    {
                      id: "stackedDriverToRestaurant",
                      coordinates: driverToRestaurantCurved,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 4,
                      dashArray: "10 8",
                    },
                  ]
                : []),
              ...(isStackedDelivery && restaurantToCustomerCurved.length > 0
                ? [
                    {
                      id: "stackedRestaurantToCustomer",
                      coordinates: restaurantToCustomerCurved,
                      strokeColor: "#1a1a1a",
                      strokeWidth: 4,
                      dashArray: "10 8",
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <View style={styles.mapLoading}>
            <Text style={styles.mapLoadingText}>Map preview</Text>
          </View>
        )}
      </View>

      {onBack && (
        <Pressable style={styles.floatingBackBtn} onPress={onBack}>
          <Text style={styles.floatingBackBtnText}>←</Text>
        </Pressable>
      )}

      {onDecline && !isDeclined && (
        <Pressable
          style={styles.floatingDeclineBtn}
          onPress={() => onDecline(delivery_id, cardIndex)}
        >
          <Text style={styles.declineBtnIcon}>✕</Text>
          <Text style={styles.declineBtnText}>Decline</Text>
        </Pressable>
      )}

      <View
        style={[
          styles.cardContentOverlay,
          {
            height: overlayHeight,
            paddingBottom: contentBottomInset,
          },
        ]}
      >
        {/* Cannot Accept Warning */}
        {!can_accept && reason && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ {reason}</Text>
          </View>
        )}

        {/* Earnings Section (Website Parity) */}
        <View style={styles.earningsHero}>
          <Text style={styles.earningsAmount}>
            {`Rs. ${(isStackedDelivery
              ? extra_earnings + bonus_amount + tipAmount
              : total_trip_earnings + tipAmount || driverEarnings
            ).toFixed(2)}`}
          </Text>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
        </View>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownPill}>
            <Text style={styles.breakdownPillText}>
              Delivery: Rs.
              {(isStackedDelivery
                ? extra_earnings || 0
                : total_trip_earnings || driverEarnings || 0
              ).toFixed(0)}
            </Text>
          </View>
          {tipAmount > 0 && (
            <View style={[styles.breakdownPill, styles.breakdownPillDark]}>
              <Text style={styles.breakdownPillTextOnDark}>
                Tip: Rs.{tipAmount.toFixed(0)}
              </Text>
            </View>
          )}
          {Number(bonus_amount) > 0 && (
            <View style={[styles.breakdownPill, styles.breakdownPillBonus]}>
              <Text style={styles.breakdownPillTextOnDark}>
                Bonus: Rs.{Number(bonus_amount).toFixed(0)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statsRowCompact}>
          <View style={styles.statItemCompact}>
            <Ionicons name="map-outline" size={16} color="#6B7280" />
            <Text style={styles.statValueCompact}>
              {isStackedDelivery ? "+" : ""}
              {Number(
                isStackedDelivery
                  ? extra_distance_km
                  : total_delivery_distance_km || r1_distance_km || 0,
              ).toFixed(1)}{" "}
              km
            </Text>
          </View>
          <View style={styles.statItemCompact}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.statValueCompact}>
              {isStackedDelivery ? "+" : ""}
              {Number(
                isStackedDelivery
                  ? extra_time_minutes
                  : estimated_time_minutes || 0,
              ).toFixed(0)}{" "}
              mins
            </Text>
          </View>
        </View>

        {/* Timeline (Website Parity) */}
        <View style={styles.timeline}>
          {/* Pickup */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconWrap}>
              <View style={styles.timelineIcon}>
                <Ionicons name="business-outline" size={20} color="#13ec37" />
              </View>
              <View style={styles.timelineLine} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>
                Pickup:{" "}
                <Text style={styles.timelineName}>{restaurant?.name}</Text>
              </Text>
              <Text style={styles.timelineAddress} numberOfLines={1}>
                {pickupAddress}
              </Text>
            </View>
          </View>

          {/* Drop-off */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconWrap}>
              <View style={styles.timelineIcon}>
                <Ionicons name="location-outline" size={20} color="#13ec37" />
              </View>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>
                Drop-off:{" "}
                <Text style={styles.timelineName}>
                  {customer?.name || "Customer"}
                </Text>
              </Text>
              <Text style={styles.timelineAddress} numberOfLines={1}>
                {dropoffAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Accept/Live Row (Website Parity) */}
        <View style={styles.acceptRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>Live</Text>
          </View>
          <Pressable
            style={[
              styles.acceptBtn,
              !can_accept && styles.acceptBtnDisabled,
              (accepting || isSyncing) && styles.acceptBtnLoading,
            ]}
            onPress={() => onAccept(delivery_id, delivery)}
            disabled={accepting || isSyncing || !can_accept}
          >
            {accepting ? (
              <>
                <ActivityIndicator size="small" color="#111812" />
                <Text style={styles.acceptBtnText}>Accepting...</Text>
              </>
            ) : isSyncing ? (
              <>
                <ActivityIndicator size="small" color="#111812" />
                <Text style={styles.acceptBtnText}>Updating...</Text>
              </>
            ) : !can_accept ? (
              <Text style={styles.acceptBtnTextDisabled}>Cannot Accept</Text>
            ) : (
              <>
                <Text style={styles.acceptBtnText}>
                  {isStackedDelivery
                    ? "Accept Stacked Delivery"
                    : "Accept Delivery"}
                </Text>
                <Text style={styles.acceptBtnArrow}>→</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// SKELETON CARD COMPONENT
// ============================================================================

function SkeletonCard({ withHeartbeat = false }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (withHeartbeat) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [withHeartbeat]);

  return (
    <Animated.View
      style={[
        styles.skeletonCard,
        withHeartbeat && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Map Skeleton */}
      <View style={styles.skeletonMap}>
        <View style={styles.shimmerOverlay} />
        <View style={styles.skeletonMapBtn} />
      </View>

      {/* Content Skeleton */}
      <View style={styles.skeletonContent}>
        {/* Earnings Row */}
        <View style={styles.skeletonEarningsRow}>
          <View style={styles.skeletonEarningsLeft}>
            <View style={[styles.skeletonLine, { width: 100, height: 28 }]} />
            <View
              style={[
                styles.skeletonLine,
                { width: 130, height: 14, marginTop: 6 },
              ]}
            />
          </View>
          <View style={styles.skeletonEarningsRight}>
            <View style={[styles.skeletonBadge, { width: 80, height: 28 }]} />
            <View
              style={[
                styles.skeletonBadge,
                { width: 80, height: 28, marginTop: 6 },
              ]}
            />
          </View>
        </View>

        {/* Route Header */}
        <View
          style={[
            styles.skeletonLine,
            { width: 110, height: 16, marginBottom: 16 },
          ]}
        />

        {/* Timeline */}
        <View style={styles.skeletonTimeline}>
          {/* Pickup */}
          <View style={styles.skeletonTimelineItem}>
            <View style={styles.skeletonTimelineIcon} />
            <View style={styles.skeletonTimelineContent}>
              <View style={[styles.skeletonLine, { width: 60, height: 12 }]} />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 160, height: 16, marginTop: 4 },
                ]}
              />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 200, height: 14, marginTop: 4 },
                ]}
              />
            </View>
          </View>

          {/* Dropoff */}
          <View style={styles.skeletonTimelineItem}>
            <View style={styles.skeletonTimelineIcon} />
            <View style={styles.skeletonTimelineContent}>
              <View style={[styles.skeletonLine, { width: 60, height: 12 }]} />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 130, height: 16, marginTop: 4 },
                ]}
              />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 180, height: 14, marginTop: 4 },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Button */}
        <View style={styles.skeletonButton} />
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  // Toast
  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    zIndex: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#13ec37",
  },
  toastError: {
    backgroundColor: "#EF4444",
  },
  toastText: {
    color: "#111812",
    fontWeight: "600",
    fontSize: 14,
  },

  // New Delivery Banner
  newDeliveryBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: "#06C168",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconText: {
    fontSize: 20,
  },
  bannerContent: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  bannerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  bannerClose: {
    padding: 8,
  },
  bannerCloseText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
  },

  // Socket Indicator
  socketIndicator: {
    position: "absolute",
    bottom: 100,
    right: 16,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  socketConnected: {
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#9EEBBE",
  },
  socketDisconnected: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  socketDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  socketDotConnected: {
    backgroundColor: "#06C168",
  },
  socketDotDisconnected: {
    backgroundColor: "#EF4444",
  },
  socketText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Error Banner
  errorBanner: {
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    flex: 1,
  },
  errorRetry: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 13,
  },

  // Delivering Mode
  deliveringContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deliveringEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  deliveringTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  deliveringSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  goToActiveBtn: {
    backgroundColor: "#13ec37",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  goToActiveBtnText: {
    color: "#111812",
    fontWeight: "600",
    fontSize: 15,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14,
    marginTop: 8,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButtons: {
    flexDirection: "row",
    gap: 12,
  },
  refreshBtn: {
    backgroundColor: "#13ec37",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshBtnText: {
    color: "#111812",
    fontWeight: "600",
    fontSize: 14,
  },
  viewActiveBtn: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#13ec37",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  viewActiveBtnText: {
    color: "#13ec37",
    fontWeight: "600",
    fontSize: 14,
  },

  // Bottom Navigation
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  bottomNavContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  navItemActive: {},
  navIconWrap: {
    position: "relative",
  },
  navIcon: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  navLabelActive: {
    color: "#13ec37",
    fontWeight: "700",
  },
  navBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // ============================================================================
  // DELIVERY CARD STYLES
  // ============================================================================

  card: {
    backgroundColor: "#fff",
    marginBottom: 0,
    height: SCREEN_HEIGHT,
    overflow: "hidden",
  },
  cardDeclined: {
    opacity: 0.6,
  },
  cardDisabled: {
    borderWidth: 2,
    borderColor: "#FECACA",
    opacity: 0.75,
  },

  // Declined Banner
  declinedBanner: {
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  declinedBannerIcon: {
    fontSize: 14,
  },
  declinedBannerText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
    flex: 1,
  },
  declinedBannerHint: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  // Map Container
  mapContainer: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  mapFullScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  mapLoadingText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },

  // Decline Button
  declineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  floatingBackBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  floatingBackBtnText: {
    fontSize: 22,
    color: "#111827",
    fontWeight: "700",
  },
  floatingDeclineBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  declineBtnIcon: {
    fontSize: 14,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  // Markers
  markerDriver: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerRestaurant: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerCustomer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerEmoji: {
    fontSize: 28,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Card Content
  cardContentOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    maxHeight: SCREEN_HEIGHT * 0.65,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
  },

  // Warning Box
  warningBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "600",
  },

  // Earnings Hero
  earningsHero: {
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  breakdownPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  breakdownPillBonus: {
    backgroundColor: "#13ec37",
  },
  breakdownPillDark: {
    backgroundColor: "#111827",
  },
  breakdownPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
  },
  breakdownPillTextOnDark: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  statsRowCompact: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  statItemCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statValueCompact: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#13ec37",
    textAlign: "center",
  },
  earningsLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 1,
  },

  // Timeline
  timeline: {
    marginBottom: 10,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineIconWrap: {
    alignItems: "center",
  },
  timelineIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    backgroundColor: "rgba(19, 236, 55, 0.3)",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#13ec37",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    textTransform: "none",
  },
  timelineAddress: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 20,
  },

  // Badges Row
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },

  acceptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
    zIndex: 2,
  },
  // Accept Button
  acceptBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#13ec37",
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  acceptBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  acceptBtnLoading: {
    backgroundColor: "rgba(19, 236, 55, 0.7)",
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111812",
  },
  acceptBtnTextDisabled: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  acceptBtnArrow: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111812",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#13ec37",
  },
  livePillText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "700",
  },

  // ============================================================================
  // SKELETON STYLES
  // ============================================================================

  skeletonCard: {
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
    minHeight: SCREEN_HEIGHT,
  },
  skeletonMap: {
    height: SCREEN_HEIGHT * 0.4,
    minHeight: 220,
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  skeletonMapBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  skeletonContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 20,
  },
  skeletonEarningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  skeletonEarningsLeft: {},
  skeletonEarningsRight: {
    alignItems: "flex-end",
  },
  skeletonLine: {
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
  },
  skeletonBadge: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
  },
  skeletonTimeline: {
    marginBottom: 16,
  },
  skeletonTimelineItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  skeletonTimelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(19, 236, 55, 0.2)",
  },
  skeletonTimelineContent: {
    flex: 1,
  },
  skeletonButton: {
    height: 56,
    backgroundColor: "#9EEBBE",
    borderRadius: 28,
  },
});
