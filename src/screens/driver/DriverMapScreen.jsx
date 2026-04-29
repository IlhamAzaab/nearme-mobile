/**
 * Driver Map Screen - Professional React Native Implementation
 *
 * Two-tier location tracking:
 *   - Live display: Updates driver marker every 3 seconds (smooth visual)
 *   - Data refresh: Only calls API when driver moves 100m+
 *
 * Features:
 *   - Pickup and Delivery modes with auto-switch
 *   - OSRM driving route with distance/ETA
 *   - Bottom sheet with delivery details
 *   - Google Maps navigation
 *   - Correct API endpoints matching backend
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DriverMapSheetLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DeliveryProofUpload from "../../components/driver/DeliveryProofUpload";
import FreeMapView from "../../components/maps/FreeMapView";
import StatusTransitionOverlay from "../../components/driver/StatusTransitionOverlay";
import SwipeToDeliver from "../../components/driver/SwipeToDeliver";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import {
  approximateDistanceMeters,
  fetchOSRMRoute as fetchResilientOSRMRoute,
} from "../../utils/osrmClient";
import {
  isTransientFetchError,
  rateLimitedFetch,
} from "../../utils/rateLimitedFetch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const LIVE_TRACKING_INTERVAL = 3000; // 3s - smooth driver marker updates
const DATA_REFRESH_THRESHOLD = 200; // 200m - only fetch API data after this
const LIVE_LOCATION_MAX_ACCURACY_METERS = 120;
const LIVE_LOCATION_SAMPLE_MAX_AGE_MS = 12000;
const DEFAULT_LOCATION = { latitude: 8.5017, longitude: 81.186 };
const DRIVER_MAP_CACHE_KEY = "driver_map_cache";
const DRIVER_MAP_CACHE_TTL_MS = 120000;
const DRIVER_STATUS_FOCUS_SIGNAL_KEY = "driver_status_focus_signal";
const DRIVER_DELIVERY_ACTION_EVENT = "driver:delivery_notification_action";

const asArray = (value) => (Array.isArray(value) ? value : []);

const loadDriverMapCache = async (options = {}) => {
  const { allowStale = false } = options;
  try {
    const raw = await AsyncStorage.getItem(DRIVER_MAP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !parsed?.data) return null;
    if (
      !allowStale &&
      Date.now() - parsed.timestamp > DRIVER_MAP_CACHE_TTL_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const saveDriverMapCache = async (data) => {
  try {
    await AsyncStorage.setItem(
      DRIVER_MAP_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // no-op
  }
};

const pushStatusFocusSignal = async (status, deliveryId) => {
  try {
    await AsyncStorage.setItem(
      DRIVER_STATUS_FOCUS_SIGNAL_KEY,
      JSON.stringify({
        status,
        delivery_id: deliveryId,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // no-op
  }
};

// ============================================================================
// HELPERS
// ============================================================================

const fetchOSRMRoute = async (fromLat, fromLng, toLat, toLng) => {
  const route = await fetchResilientOSRMRoute({
    from: { latitude: fromLat, longitude: fromLng },
    to: { latitude: toLat, longitude: toLng },
    profile: "foot",
    timeoutMs: 10000,
    retries: 2,
    overview: "full",
  });

  if (route?.geometry?.coordinates?.length) {
    return {
      success: true,
      coordinates: route.geometry.coordinates.map(function (c) {
        return { latitude: c[1], longitude: c[0] };
      }),
      distance_km: (route.distance / 1000).toFixed(1),
      duration_min: Math.ceil(route.duration / 60),
    };
  }

  return { success: false };
};

function MetricBadge({ type, value, unit }) {
  const isDistance = type === "distance";

  return (
    <View style={styles.metricBadge}>
      <Svg width={14} height={14} viewBox="0 0 24 24">
        {isDistance ? (
          <Path
            d="M12 2C8.13 2 5 5.13 5 9c0 4.8 5.36 11.06 6.02 11.8a1.3 1.3 0 0 0 1.96 0C13.64 20.06 19 13.8 19 9c0-3.87-3.13-7-7-7Zm0 9.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6Z"
            fill="#059669"
          />
        ) : (
          <Path
            d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 12 3.5Zm.75 4.25v4.1l3 1.8-.75 1.3-3.75-2.25V7.75Z"
            fill="#059669"
          />
        )}
      </Svg>
      <Text style={styles.metricBadgeText}>{`${value} ${unit}`}</Text>
    </View>
  );
}

function toSafeMapTarget(latitude, longitude) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    latitude: lat,
    longitude: lng,
  };
}

function normalizeDeliveryId(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeDeliveryStatus(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapActiveDeliveryToMapItem(delivery) {
  const status = normalizeDeliveryStatus(delivery?.status);
  const order = delivery?.order || {};
  const restaurant = order?.restaurant || {};
  const deliveryLocation = order?.delivery || order?.delivery_location || {};

  return {
    delivery_id: delivery?.id,
    order_id: delivery?.order_id,
    order_number: order?.order_number || "N/A",
    status: status || "accepted",
    restaurant: {
      name: restaurant?.name || "Restaurant",
      address: restaurant?.address || "",
      latitude: restaurant?.latitude || 0,
      longitude: restaurant?.longitude || 0,
    },
    customer: {
      name: order?.customer?.name || "Customer",
      phone: order?.customer?.phone || "",
      address: deliveryLocation?.address || "",
      latitude: deliveryLocation?.latitude || 0,
      longitude: deliveryLocation?.longitude || 0,
    },
    distance_km: ((delivery?.total_distance || 0) / 1000).toFixed(2),
    estimated_time_minutes: 0,
  };
}

function buildMapDataFromActiveDeliveries(
  activeDeliveries,
  preferredDeliveryId = null,
) {
  const source = asArray(activeDeliveries);
  const mapped = source.map(mapActiveDeliveryToMapItem);
  const pickups = mapped.filter(
    (item) => normalizeDeliveryStatus(item?.status) === "accepted",
  );
  const deliveries = mapped.filter((item) =>
    ["picked_up", "on_the_way", "at_customer"].includes(
      normalizeDeliveryStatus(item?.status),
    ),
  );

  const preferredId = normalizeDeliveryId(preferredDeliveryId);
  const allTargets = [...pickups, ...deliveries];
  const preferredTarget = preferredId
    ? allTargets.find(
        (item) => normalizeDeliveryId(item?.delivery_id) === preferredId,
      )
    : null;

  const currentTarget = preferredTarget || pickups[0] || deliveries[0] || null;
  const mode =
    pickups.length > 0
      ? "pickup"
      : deliveries.length > 0
        ? "deliver"
        : "pickup";

  return {
    pickups,
    deliveries,
    currentTarget,
    mode,
    hasData: pickups.length > 0 || deliveries.length > 0,
  };
}

function isFreshAccurateLiveSample(position) {
  const accuracy = Number(position?.coords?.accuracy || Infinity);
  const sampleTimestamp = Number(position?.timestamp || Date.now());
  const sampleAgeMs = Math.max(0, Date.now() - sampleTimestamp);

  if (
    !Number.isFinite(accuracy) ||
    accuracy > LIVE_LOCATION_MAX_ACCURACY_METERS
  ) {
    return false;
  }

  if (
    !Number.isFinite(sampleAgeMs) ||
    sampleAgeMs > LIVE_LOCATION_SAMPLE_MAX_AGE_MS
  ) {
    return false;
  }

  return true;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DriverMapScreen({ route, navigation }) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  const deliveryId = params.deliveryId;
  const initialMode = params.mode || "pickup";

  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const lastBackendUpdateRef = useRef(0);
  const isFetchingRef = useRef(false);
  const pendingFetchRequestRef = useRef(null);
  const routeFetchLocRef = useRef(null);
  const modeRef = useRef(initialMode);
  const pickupsRef = useRef([]);
  const deliveriesRef = useRef([]);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const sheetHeightAnim = useRef(
    new Animated.Value(SCREEN_HEIGHT * 0.4),
  ).current;
  const overlayCallbackRef = useRef(null);
  const statusActionInProgressRef = useRef(false);
  const sheetTouchStartY = useRef(null);
  const hasAutoFitRef = useRef(false);
  const currentTargetRef = useRef(null);

  const [mode, setMode] = useState(initialMode);
  const [pickups, setPickups] = useState([]);
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [targetForMap, setTargetForMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isMapRefreshing, setIsMapRefreshing] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayStatus, setOverlayStatus] = useState("processing");
  const [overlayActionType, setOverlayActionType] = useState("pickup");
  const [overlayErrorMsg, setOverlayErrorMsg] = useState("");

  const mapTabBarHeight = 70 + insets.bottom;
  const collapsedSheetHeight = SCREEN_HEIGHT * 0.4;
  const expandedSheetHeight = SCREEN_HEIGHT * 0.6;

  // ============================================================================
  // INIT / CLEANUP
  // ============================================================================

  useEffect(function () {
    hydrateFromCacheAndStart();
    return function () {
      if (watchIdRef.current) {
        watchIdRef.current.remove();
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    pickupsRef.current = asArray(pickups);
  }, [pickups]);

  useEffect(() => {
    deliveriesRef.current = asArray(deliveriesList);
  }, [deliveriesList]);

  useEffect(() => {
    currentTargetRef.current = currentTarget;
  }, [currentTarget]);

  const animateBackgroundRefresh = () => {
    if (loading) return;
    Animated.sequence([
      Animated.timing(contentFadeAnim, {
        toValue: 0.92,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hydrateFromCacheAndStart = async () => {
    let hydratedFromLocalData = false;
    const cached = await loadDriverMapCache({ allowStale: true });
    if (cached) {
      if (cached.driverLocation) {
        setDriverLocation(cached.driverLocation);
        lastFetchLocationRef.current = cached.driverLocation;
      }

      const cachedPickups = asArray(cached.pickups);
      const cachedDeliveries = asArray(cached.deliveries);

      setPickups(cachedPickups);
      setDeliveriesList(cachedDeliveries);

      if (cached.currentTarget) {
        setMode(cached.mode || "pickup");
        setCurrentTarget(cached.currentTarget);
      } else if (cachedPickups.length > 0) {
        setMode("pickup");
        setCurrentTarget(cachedPickups[0]);
      } else if (cachedDeliveries.length > 0) {
        setMode("deliver");
        setCurrentTarget(cachedDeliveries[0]);
      }

      setLoading(false);
      hydratedFromLocalData = true;
    }

    if (!hydratedFromLocalData) {
      const dashboardSnapshot = queryClient.getQueryData([
        "driver",
        "dashboard",
        "snapshot",
      ]);
      const seeded = buildMapDataFromActiveDeliveries(
        dashboardSnapshot?.activeDeliveries,
        deliveryId,
      );

      if (seeded.hasData) {
        setPickups(seeded.pickups);
        setDeliveriesList(seeded.deliveries);
        setMode(seeded.mode);
        setCurrentTarget(seeded.currentTarget);
        setLoading(false);
        hydratedFromLocalData = true;

        await saveDriverMapCache({
          driverLocation: null,
          pickups: seeded.pickups,
          deliveries: seeded.deliveries,
          mode: seeded.mode,
          currentTarget: seeded.currentTarget,
        });
      }
    }

    if (!hydratedFromLocalData && !deliveryId) {
      navigation.replace("DriverTabs", { screen: "Dashboard" });
      return;
    }

    startLocationTracking();
  };

  // ============================================================================
  // LOCATION TRACKING
  // Live display: marker updates every 3s (distanceInterval: 0)
  // Data refresh: API calls only when moved 200m+ from last fetch
  // ============================================================================

  const startLocationTracking = async () => {
    try {
      const permResult = await Location.requestForegroundPermissionsAsync();
      if (permResult.status !== "granted") {
        setDriverLocation(DEFAULT_LOCATION);
        lastFetchLocationRef.current = DEFAULT_LOCATION;
        await fetchPickupsAndDeliveries(DEFAULT_LOCATION);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const initLoc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setDriverLocation(initLoc);
      lastFetchLocationRef.current = initLoc;
      setIsTracking(true);
      await fetchPickupsAndDeliveries(initLoc);

      watchIdRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: LIVE_TRACKING_INTERVAL,
          distanceInterval: 0,
        },
        function (position) {
          if (!isFreshAccurateLiveSample(position)) return;

          let newLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Always update marker (smooth live tracking every 3s)
          setDriverLocation(newLoc);

          // Backend location update (throttled 5s)
          updateBackendLocation(newLoc);

          // Only fetch API data when moved 200m+ from last fetch
          let lastFetch = lastFetchLocationRef.current;
          if (lastFetch) {
            let moved = approximateDistanceMeters(lastFetch, newLoc);
            if (moved >= DATA_REFRESH_THRESHOLD) {
              console.log(
                "[LOCATION] Moved " +
                  moved.toFixed(0) +
                  "m (threshold: " +
                  DATA_REFRESH_THRESHOLD +
                  "m) - refreshing data",
              );
              lastFetchLocationRef.current = newLoc;
              fetchPickupsAndDeliveries(newLoc);
            }
          }
        },
      );
    } catch (err) {
      console.error("[LOCATION] Tracking error:", err);
      setDriverLocation(DEFAULT_LOCATION);
      lastFetchLocationRef.current = DEFAULT_LOCATION;
      await fetchPickupsAndDeliveries(DEFAULT_LOCATION);
    }
  };

  // ============================================================================
  // DATA FETCHING (Correct API endpoints)
  // ============================================================================

  const fetchPickupsAndDeliveries = async (location, options = {}) => {
    const { force = false, immediate = false } = options;
    if (!location) return;

    if (statusActionInProgressRef.current && !force) {
      return;
    }

    if (isFetchingRef.current) {
      if (force) {
        pendingFetchRequestRef.current = {
          location,
          immediate,
        };
      }
      return;
    }

    isFetchingRef.current = true;

    try {
      let token = await getAccessToken();
      if (!token) {
        return;
      }

      const rateLimitConfig = immediate
        ? {
            minGap: 0,
            deduplicate: false,
            retryOn429: false,
            timeoutMs: 12000,
            transientRetries: 0,
          }
        : {};

      // Fetch pickups
      let pickupsUrl =
        API_BASE_URL +
        "/driver/deliveries/pickups?driver_latitude=" +
        location.latitude +
        "&driver_longitude=" +
        location.longitude;
      let pickupsRes = await rateLimitedFetch(
        pickupsUrl,
        {
          headers: { Authorization: "Bearer " + token },
        },
        rateLimitConfig,
      );
      let pickupsData = { pickups: [] };
      if (pickupsRes.ok) {
        pickupsData = await pickupsRes.json();
      }

      // Fetch deliveries
      let deliveriesUrl =
        API_BASE_URL +
        "/driver/deliveries/deliveries-route?driver_latitude=" +
        location.latitude +
        "&driver_longitude=" +
        location.longitude;
      let deliveriesRes = await rateLimitedFetch(
        deliveriesUrl,
        {
          headers: { Authorization: "Bearer " + token },
        },
        rateLimitConfig,
      );
      let deliveriesData = { deliveries: [] };
      if (deliveriesRes.ok) {
        deliveriesData = await deliveriesRes.json();
      }

      let pList = pickupsData.pickups || [];
      let dList = deliveriesData.deliveries || [];

      // ── Fallback: hit /active when both lists are empty ──
      if (pList.length === 0 && dList.length === 0) {
        console.log(
          "[FETCH] Both endpoints empty, trying /driver/deliveries/active fallback...",
        );
        try {
          let fallbackRes = await rateLimitedFetch(
            API_BASE_URL + "/driver/deliveries/active",
            {
              headers: { Authorization: "Bearer " + token },
            },
            rateLimitConfig,
          );
          if (fallbackRes.ok) {
            let fallbackData = await fallbackRes.json();
            let activeList = fallbackData.deliveries || [];
            if (activeList.length > 0) {
              let accepted = activeList.filter(function (d) {
                return d.status === "accepted";
              });
              let inProgress = activeList.filter(function (d) {
                return d.status !== "accepted";
              });
              if (accepted.length > 0) {
                pList = accepted.map(function (d) {
                  return {
                    delivery_id: d.id,
                    order_id: d.order_id,
                    order_number:
                      d.order && d.order.order_number
                        ? d.order.order_number
                        : "N/A",
                    status: d.status,
                    restaurant: (d.order && d.order.restaurant) || {
                      name: "Restaurant",
                      address: "",
                      latitude: 0,
                      longitude: 0,
                    },
                    customer: {
                      name:
                        (d.order &&
                          d.order.customer &&
                          d.order.customer.name) ||
                        "Customer",
                      phone:
                        (d.order &&
                          d.order.customer &&
                          d.order.customer.phone) ||
                        "",
                      address:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.address) ||
                        "",
                      latitude:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.latitude) ||
                        0,
                      longitude:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.longitude) ||
                        0,
                    },
                    distance_km: ((d.total_distance || 0) / 1000).toFixed(2),
                    estimated_time_minutes: 0,
                  };
                });
              } else if (inProgress.length > 0) {
                dList = inProgress.map(function (d) {
                  return {
                    delivery_id: d.id,
                    order_id: d.order_id,
                    order_number:
                      d.order && d.order.order_number
                        ? d.order.order_number
                        : "N/A",
                    status: d.status,
                    restaurant: (d.order && d.order.restaurant) || {
                      name: "Restaurant",
                      address: "",
                      latitude: 0,
                      longitude: 0,
                    },
                    customer: {
                      name:
                        (d.order &&
                          d.order.customer &&
                          d.order.customer.name) ||
                        "Customer",
                      phone:
                        (d.order &&
                          d.order.customer &&
                          d.order.customer.phone) ||
                        "",
                      address:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.address) ||
                        "",
                      latitude:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.latitude) ||
                        0,
                      longitude:
                        (d.order &&
                          d.order.delivery &&
                          d.order.delivery.longitude) ||
                        0,
                    },
                    distance_km: ((d.total_distance || 0) / 1000).toFixed(2),
                    estimated_time_minutes: 0,
                  };
                });
              }
            }
          }
        } catch (fbErr) {
          console.error("[FETCH] Fallback error:", fbErr);
        }
      }

      const hadVisibleTarget = Boolean(currentTargetRef.current);
      const previousTargetId = normalizeDeliveryId(
        currentTargetRef.current?.delivery_id,
      );

      setPickups(pList);
      setDeliveriesList(dList);

      let nextMode = modeRef.current;
      let nextTarget = null;

      // Auto-select mode and target
      if (pList.length > 0) {
        setMode("pickup");
        let pTarget =
          pList.find(
            (item) =>
              normalizeDeliveryId(item?.delivery_id) === previousTargetId,
          ) || pList[0];
        setCurrentTarget(pTarget);
        nextMode = "pickup";
        nextTarget = pTarget;
      } else if (dList.length > 0) {
        setMode("deliver");
        let dTarget =
          dList.find(
            (item) =>
              normalizeDeliveryId(item?.delivery_id) === previousTargetId,
          ) || dList[0];
        setCurrentTarget(dTarget);
        nextMode = "deliver";
        nextTarget = dTarget;
      } else {
        setCurrentTarget(null);
        nextTarget = null;
      }

      await saveDriverMapCache({
        driverLocation: location,
        pickups: pList,
        deliveries: dList,
        mode: nextMode,
        currentTarget: nextTarget,
      });

      if (hadVisibleTarget) {
        animateBackgroundRefresh();
      }
    } catch (err) {
      if (isTransientFetchError(err)) {
        const staleSnapshot = await loadDriverMapCache({ allowStale: true });
        const cachedPickups = Array.isArray(staleSnapshot?.pickups)
          ? staleSnapshot.pickups
          : [];
        const cachedDeliveries = Array.isArray(staleSnapshot?.deliveries)
          ? staleSnapshot.deliveries
          : [];

        if (cachedPickups.length > 0 || cachedDeliveries.length > 0) {
          setPickups(cachedPickups);
          setDeliveriesList(cachedDeliveries);

          if (staleSnapshot?.currentTarget) {
            setMode(staleSnapshot.mode || "pickup");
            setCurrentTarget(staleSnapshot.currentTarget);
          } else if (cachedPickups.length > 0) {
            setMode("pickup");
            setCurrentTarget(cachedPickups[0]);
          } else {
            setMode("deliver");
            setCurrentTarget(cachedDeliveries[0]);
          }
        }

        if (staleSnapshot?.driverLocation) {
          setDriverLocation((prev) => prev || staleSnapshot.driverLocation);
          lastFetchLocationRef.current =
            lastFetchLocationRef.current || staleSnapshot.driverLocation;
        }

        console.warn(
          "[FETCH] Transient network issue, continuing with cached map data:",
          err?.message || err,
        );
      } else {
        console.error("[FETCH] Data error:", err);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);

      const queuedRequest = pendingFetchRequestRef.current;
      if (queuedRequest?.location) {
        pendingFetchRequestRef.current = null;
        fetchPickupsAndDeliveries(queuedRequest.location, {
          immediate: Boolean(queuedRequest.immediate),
        });
      }
    }
  };

  const applyOptimisticWorkflow = async ({
    action,
    target,
    promotedDelivery = null,
  }) => {
    const targetId = normalizeDeliveryId(target?.delivery_id);
    const promotedTargetId = normalizeDeliveryId(promotedDelivery?.id);
    if (!targetId) return;

    let nextPickups = [...(pickupsRef.current || [])];
    let nextDeliveries = [...(deliveriesRef.current || [])];

    if (action === "picked_up") {
      nextPickups = nextPickups.filter(
        (delivery) => normalizeDeliveryId(delivery?.delivery_id) !== targetId,
      );

      const existingIndex = nextDeliveries.findIndex(
        (delivery) => normalizeDeliveryId(delivery?.delivery_id) === targetId,
      );

      const postPickupStatus =
        promotedTargetId === targetId
          ? promotedDelivery?.status || "on_the_way"
          : "on_the_way";

      if (existingIndex >= 0) {
        nextDeliveries[existingIndex] = {
          ...nextDeliveries[existingIndex],
          status: postPickupStatus,
        };
      } else {
        nextDeliveries = [
          {
            ...target,
            status: postPickupStatus,
          },
          ...nextDeliveries,
        ];
      }
    }

    if (action === "delivered") {
      nextPickups = nextPickups.filter(
        (delivery) => normalizeDeliveryId(delivery?.delivery_id) !== targetId,
      );
      nextDeliveries = nextDeliveries.filter(
        (delivery) => normalizeDeliveryId(delivery?.delivery_id) !== targetId,
      );
    }

    const promotedId = normalizeDeliveryId(promotedDelivery?.id);
    if (promotedId) {
      let promotedApplied = false;

      nextDeliveries = nextDeliveries.map((delivery) => {
        if (normalizeDeliveryId(delivery?.delivery_id) !== promotedId) {
          return delivery;
        }

        promotedApplied = true;
        return {
          ...delivery,
          status: promotedDelivery?.status || delivery?.status || "on_the_way",
        };
      });

      if (!promotedApplied) {
        const promotedFromPickups = nextPickups.find(
          (delivery) =>
            normalizeDeliveryId(delivery?.delivery_id) === promotedId,
        );

        if (promotedFromPickups) {
          nextPickups = nextPickups.filter(
            (delivery) =>
              normalizeDeliveryId(delivery?.delivery_id) !== promotedId,
          );
          nextDeliveries = [
            {
              ...promotedFromPickups,
              status: promotedDelivery?.status || "on_the_way",
            },
            ...nextDeliveries,
          ];
        }
      }
    }

    let nextMode = modeRef.current;
    let nextTarget = null;

    if (nextPickups.length > 0) {
      nextMode = "pickup";
      nextTarget = nextPickups[0];
    } else if (nextDeliveries.length > 0) {
      nextMode = "deliver";
      nextTarget = promotedId
        ? nextDeliveries.find(
            (delivery) =>
              normalizeDeliveryId(delivery?.delivery_id) === promotedId,
          ) || nextDeliveries[0]
        : nextDeliveries[0];
    } else {
      nextTarget = null;
    }

    setPickups(nextPickups);
    setDeliveriesList(nextDeliveries);
    setMode(nextMode);
    setCurrentTarget(nextTarget);

    const snapshotLocation =
      driverLocation || lastFetchLocationRef.current || DEFAULT_LOCATION;

    await saveDriverMapCache({
      driverLocation: snapshotLocation,
      pickups: nextPickups,
      deliveries: nextDeliveries,
      mode: nextMode,
      currentTarget: nextTarget,
    });
  };

  const waitForServerStatusConfirmation = async ({
    targetId,
    expectedStatus,
    maxWaitMs = null,
    pollIntervalMs = 2000,
  }) => {
    const startedAt = Date.now();

    while (true) {
      if (
        Number.isFinite(maxWaitMs) &&
        Date.now() - startedAt > Number(maxWaitMs)
      ) {
        return false;
      }

      try {
        const token = await getAccessToken();
        if (!token) {
          await delay(pollIntervalMs);
          continue;
        }

        const verifyRes = await fetch(
          `${API_BASE_URL}/driver/deliveries/${targetId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
          },
        );

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json().catch(() => ({}));
          const serverStatus = normalizeDeliveryStatus(
            verifyData?.delivery?.status || verifyData?.status || "",
          );

          if (serverStatus === expectedStatus) {
            return true;
          }
        }
      } catch {
        // keep waiting until timeout
      }

      await delay(pollIntervalMs);
    }

    return false;
  };

  // ============================================================================
  // ROUTE + TARGET LOCATION
  // ============================================================================

  // Update target location for map when currentTarget or mode changes
  useEffect(
    function () {
      if (!currentTarget) {
        setTargetForMap(null);
        return;
      }
      if (mode === "pickup" && currentTarget.restaurant) {
        setTargetForMap(
          toSafeMapTarget(
            currentTarget.restaurant.latitude,
            currentTarget.restaurant.longitude,
          ),
        );
      } else if (mode === "deliver" && currentTarget.customer) {
        setTargetForMap(
          toSafeMapTarget(
            currentTarget.customer.latitude,
            currentTarget.customer.longitude,
          ),
        );
      } else {
        setTargetForMap(null);
      }
    },
    [currentTarget, mode],
  );

  // Fetch route when target changes
  useEffect(
    function () {
      if (driverLocation && targetForMap) {
        doFetchRoute(driverLocation, targetForMap);
        routeFetchLocRef.current = driverLocation;
      } else {
        setRouteCoords([]);
        setRouteInfo(null);
      }
    },
    [targetForMap],
  );

  // Refetch route when driver moves 100m+ (not every 3s)
  useEffect(
    function () {
      if (!driverLocation || !targetForMap) return;
      let prev = routeFetchLocRef.current;
      if (!prev) {
        routeFetchLocRef.current = driverLocation;
        return;
      }
      let moved = approximateDistanceMeters(prev, driverLocation);
      if (moved >= DATA_REFRESH_THRESHOLD) {
        routeFetchLocRef.current = driverLocation;
        doFetchRoute(driverLocation, targetForMap);
      }
    },
    [driverLocation],
  );

  const doFetchRoute = async (from, to) => {
    let result = await fetchOSRMRoute(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude,
    );
    if (result.success) {
      setRouteCoords(result.coordinates);
      setRouteInfo({
        distance_km: result.distance_km,
        duration_min: result.duration_min,
      });
    } else {
      // Fallback
      let backendCoords =
        currentTarget &&
        currentTarget.route_geometry &&
        currentTarget.route_geometry.coordinates
          ? currentTarget.route_geometry.coordinates.map(function (c) {
              return { latitude: c[1], longitude: c[0] };
            })
          : [];
      if (backendCoords.length > 1) {
        setRouteCoords(backendCoords);
      } else {
        setRouteCoords([]);
      }
      setRouteInfo(null);
    }
  };

  // ============================================================================
  // BACKEND LOCATION UPDATE (throttled to 5s)
  // ============================================================================

  const updateBackendLocation = async (loc) => {
    let now = Date.now();
    if (now - lastBackendUpdateRef.current < 5000) return;
    lastBackendUpdateRef.current = now;
    try {
      let token = await getAccessToken();
      const locationDeliveryId = currentTarget?.delivery_id || deliveryId;
      if (!token || !locationDeliveryId) return;
      await fetch(
        API_BASE_URL + "/driver/deliveries/" + locationDeliveryId + "/location",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            latitude: loc.latitude,
            longitude: loc.longitude,
          }),
        },
      );
    } catch (e) {
      // silent
    }
  };

  // ============================================================================
  // ACTIONS (Correct endpoints: /driver/deliveries/:id/status)
  // ============================================================================

  const patchDeliveryStatus = async (targetId, status) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Authentication session is unavailable");
    }

    const res = await fetch(
      API_BASE_URL + "/driver/deliveries/" + targetId + "/status",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          latitude: driverLocation ? driverLocation.latitude : null,
          longitude: driverLocation ? driverLocation.longitude : null,
        }),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || "Failed to update delivery status");
    }

    return data;
  };

  const refreshMapAfterStatusAction = async () => {
    const refreshLocation =
      driverLocation || lastFetchLocationRef.current || DEFAULT_LOCATION;
    await fetchPickupsAndDeliveries(refreshLocation, {
      force: true,
      immediate: true,
    });
  };

  const finishStatusAction = () => {
    setUpdating(false);
    statusActionInProgressRef.current = false;
  };

  const handlePickedUp = async () => {
    if (!currentTarget || updating || isMapRefreshing) return;

    const actionTarget = currentTarget;
    const targetId = normalizeDeliveryId(actionTarget?.delivery_id);
    if (!targetId) return;

    setUpdating(true);
    statusActionInProgressRef.current = true;
    overlayCallbackRef.current = null;
    setOverlayActionType("pickup");
    setOverlayErrorMsg("");
    setOverlayStatus("processing");
    setOverlayVisible(true);

    try {
      // IMPORTANT:
      // Mobile should send ONLY picked_up. The backend already auto-promotes
      // the next picked_up delivery to on_the_way when no accepted pickups remain.
      // Do not send a second manual on_the_way PATCH from the app, because it can
      // race with the backend auto-promotion and cause Server error / stale UI.
      const data = await patchDeliveryStatus(targetId, "picked_up");
      
      // DEFENSIVE CHECK: Verify backend actually updated the database
      if (!data?.delivery || !["picked_up", "on_the_way"].includes(data.delivery.status)) {
        throw new Error(
          `Backend validation failed: delivery status is ${data?.delivery?.status || "unknown"}, expected picked_up or on_the_way. Database may not have been updated.`
        );
      }
      
      const promotedDelivery = data?.promotedDelivery || null;

      await applyOptimisticWorkflow({
        action: "picked_up",
        target: actionTarget,
        promotedDelivery,
      });
      pushStatusFocusSignal(
        promotedDelivery?.status || "picked_up",
        promotedDelivery?.id || targetId,
      ).catch(() => {});

      setOverlayStatus("success");
      overlayCallbackRef.current = async () => {
        await refreshMapAfterStatusAction();
        finishStatusAction();
      };
    } catch (e) {
      console.warn("Pickup status update failed", e?.message || e);
      setOverlayErrorMsg(e?.message || "Pickup status update failed");
      setOverlayStatus("error");
      overlayCallbackRef.current = async () => {
        await refreshMapAfterStatusAction();
        finishStatusAction();
      };
    }
  };

  const handleDelivered = async () => {
    if (!currentTarget || updating || isMapRefreshing) return;

    const actionTarget = currentTarget;
    const targetId = normalizeDeliveryId(actionTarget?.delivery_id);
    if (!targetId) return;

    setUpdating(true);
    statusActionInProgressRef.current = true;
    overlayCallbackRef.current = null;
    setOverlayActionType("deliver");
    setOverlayErrorMsg("");
    setOverlayStatus("processing");
    setOverlayVisible(true);

    try {
      const data = await patchDeliveryStatus(targetId, "delivered");
      
      // DEFENSIVE CHECK: Verify backend actually updated the database
      if (!data?.delivery || data.delivery.status !== "delivered") {
        throw new Error(
          `Backend validation failed: delivery status is ${data?.delivery?.status || "unknown"}, expected delivered. Database may not have been updated.`
        );
      }
      
      const promotedDelivery = data?.promotedDelivery || null;

      await applyOptimisticWorkflow({
        action: "delivered",
        target: actionTarget,
        promotedDelivery,
      });
      pushStatusFocusSignal(
        promotedDelivery?.status || "delivered",
        promotedDelivery?.id || targetId,
      ).catch(() => {});
      DeviceEventEmitter.emit(DRIVER_DELIVERY_ACTION_EVENT, {
        deliveryId: targetId,
        action: "delivered",
        source: "driver_map",
        location: driverLocation
          ? {
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }
          : null,
        triggeredAt: Date.now(),
      });

      setOverlayStatus("success");
      overlayCallbackRef.current = async () => {
        await refreshMapAfterStatusAction();
        finishStatusAction();
      };
    } catch (e) {
      console.warn("Delivery status update failed", e?.message || e);
      setOverlayErrorMsg(e?.message || "Delivery status update failed");
      setOverlayStatus("error");
      overlayCallbackRef.current = async () => {
        await refreshMapAfterStatusAction();
        finishStatusAction();
      };
    }
  };

  const handleStartDelivery = () => {
    if (deliveriesList.length > 0) {
      setMode("deliver");
      setCurrentTarget(deliveriesList[0]);
    }
  };

  // ============================================================================
  // MAP + SHEET
  // ============================================================================

  const handleRecenter = () => {
    setUserInteracted(false);
    hasAutoFitRef.current = false;
  };

  const handleMapRefresh = async () => {
    if (isMapRefreshing) return;
    setIsMapRefreshing(true);

    try {
      const refreshLocation =
        driverLocation || lastFetchLocationRef.current || DEFAULT_LOCATION;
      await fetchPickupsAndDeliveries(refreshLocation, {
        force: true,
        immediate: true,
      });
    } finally {
      setIsMapRefreshing(false);
    }
  };

  const handleSheetTouchStart = (e) => {
    sheetTouchStartY.current = e?.nativeEvent?.pageY ?? null;
  };

  const handleSheetTouchEnd = (e) => {
    const startY = sheetTouchStartY.current;
    const endY = e?.nativeEvent?.pageY;
    sheetTouchStartY.current = null;
    if (startY == null || endY == null) return;

    const deltaY = endY - startY;
    if (deltaY < -40) {
      setSheetExpanded(true);
    } else if (deltaY > 40) {
      setSheetExpanded(false);
    }
  };

  useEffect(
    function () {
      Animated.timing(sheetHeightAnim, {
        toValue: sheetExpanded ? expandedSheetHeight : collapsedSheetHeight,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [sheetExpanded, sheetHeightAnim, collapsedSheetHeight, expandedSheetHeight],
  );

  // Auto-fit map once per target (or when explicitly recentered)
  useEffect(
    function () {
      if (
        !userInteracted &&
        driverLocation &&
        targetForMap &&
        !hasAutoFitRef.current
      ) {
        const sheetHeight = sheetExpanded
          ? expandedSheetHeight
          : collapsedSheetHeight;
        const fitPoints =
          routeCoords.length > 1 ? routeCoords : [driverLocation, targetForMap];

        setTimeout(function () {
          if (mapRef.current && mapRef.current.fitToCoordinates) {
            mapRef.current.fitToCoordinates(fitPoints, {
              edgePadding: {
                top: insets.top + 80,
                right: 42,
                bottom: Math.round(sheetHeight + mapTabBarHeight + 16),
                left: 42,
              },
            });
            hasAutoFitRef.current = true;
          }
        }, 400);
      }
    },
    [
      driverLocation,
      targetForMap,
      userInteracted,
      routeCoords,
      sheetExpanded,
      insets.top,
      insets.bottom,
    ],
  );

  useEffect(
    function () {
      hasAutoFitRef.current = false;
    },
    [
      mode,
      sheetExpanded,
      currentTarget?.delivery_id,
      targetForMap?.latitude,
      targetForMap?.longitude,
    ],
  );

  // Animate bottom sheet
  useEffect(
    function () {
      if (!loading && currentTarget) {
        contentFadeAnim.setValue(0);
        Animated.spring(sheetAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }).start();

        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    },
    [loading, currentTarget, contentFadeAnim],
  );

  // Google Maps Navigation
  const openGoogleMaps = () => {
    if (!targetForMap) return;
    let url = Platform.select({
      ios: "maps:0,0?q=" + targetForMap.latitude + "," + targetForMap.longitude,
      android:
        "geo:0,0?q=" + targetForMap.latitude + "," + targetForMap.longitude,
    });
    Linking.openURL(url).catch(function () {
      Alert.alert("Error", "Could not open maps app");
    });
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL("tel:" + phone).catch(function () {
      Alert.alert("Error", "Could not make call");
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  useEffect(() => {
    if (loading || currentTarget) return;
    if (overlayVisible || updating || statusActionInProgressRef.current) return;
    navigation.replace("DriverTabs", { screen: "Dashboard" });
  }, [loading, currentTarget, navigation, overlayVisible, updating]);

  if (loading) {
    return <DriverMapSheetLoadingSkeleton />;
  }

  if (!currentTarget) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyEmoji}>📭</Text>
        <Text style={styles.emptyText}>No active deliveries found</Text>
        <Pressable style={styles.goBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  let translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: contentFadeAnim,
          transform: [
            {
              translateY: contentFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <StatusTransitionOverlay
        visible={overlayVisible}
        status={overlayStatus}
        actionType={overlayActionType}
        minimal
        autoCloseMs={overlayStatus === "processing" ? 60000 : 1500}
        onComplete={() => {
          if (overlayStatus === "processing") return;
          setOverlayVisible(false);
          setOverlayStatus("processing");
          setOverlayErrorMsg("");
          overlayCallbackRef.current?.();
          overlayCallbackRef.current = null;
        }}
      />

      {/* MAP */}
      {driverLocation && (
        <FreeMapView
          ref={mapRef}
          initialRegion={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          markers={[
            {
              id: "driver",
              coordinate: driverLocation,
              type: "driver",
              emoji: "\uD83D\uDE97",
              heading: driverLocation?.heading || 0,
            },
            ...(targetForMap
              ? [
                  {
                    id: "target",
                    coordinate: targetForMap,
                    type: "destination",
                  },
                ]
              : []),
          ]}
          polylines={
            routeCoords.length > 1
              ? [
                  {
                    id: "route-outline",
                    coordinates: routeCoords,
                    strokeColor: "#ffffff",
                    strokeWidth: 14,
                  },
                  {
                    id: "route",
                    coordinates: routeCoords,
                    strokeColor: "#2563eb",
                    strokeWidth: 9,
                  },
                ]
              : []
          }
          onMapPress={() => setUserInteracted(true)}
        />
      )}

      <DriverScreenSection screenKey="DriverMap" sectionIndex={0}>
        {/* TOP HEADER */}
        <SafeAreaView style={styles.topContainer} edges={["top"]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{"‹"}</Text>
          </Pressable>
        </SafeAreaView>
      </DriverScreenSection>

      {/* NAVIGATE BUTTON */}
      <Pressable
        style={[
          styles.navigateBtn,
          {
            bottom: sheetExpanded
              ? SCREEN_HEIGHT * 0.6 + mapTabBarHeight + 12
              : SCREEN_HEIGHT * 0.4 + mapTabBarHeight + 12,
          },
        ]}
        onPress={openGoogleMaps}
      >
        <Svg
          width={17}
          height={17}
          viewBox="0 0 24 24"
          style={styles.navigateBtnIcon}
        >
          <Path
            d="M21 3 11 13"
            stroke="#fff"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d="m21 3-6.4 18-3.6-8-8-3.6L21 3Z"
            stroke="#fff"
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <Text style={styles.navigateBtnText}>Navigate</Text>
      </Pressable>

      <Pressable
        style={[
          styles.mapRefreshBtn,
          {
            bottom: sheetExpanded
              ? SCREEN_HEIGHT * 0.6 + mapTabBarHeight + 12
              : SCREEN_HEIGHT * 0.4 + mapTabBarHeight + 12,
          },
        ]}
        onPress={handleMapRefresh}
        disabled={isMapRefreshing}
      >
        <Ionicons
          name={isMapRefreshing ? "sync" : "refresh"}
          size={18}
          color="#0f766e"
        />
      </Pressable>

      {/* RECENTER */}
      {userInteracted && (
        <Pressable
          style={[
            styles.recenterBtn,
            {
              bottom: sheetExpanded
                ? SCREEN_HEIGHT * 0.6 + mapTabBarHeight - 40
                : SCREEN_HEIGHT * 0.4 + mapTabBarHeight + 8,
            },
          ]}
          onPress={handleRecenter}
        >
          <Text style={styles.recenterBtnIcon}>🎯</Text>
        </Pressable>
      )}

      {/* BOTTOM SHEET */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { bottom: mapTabBarHeight },
          { height: sheetHeightAnim },
          { paddingBottom: insets.bottom },
          { transform: [{ translateY: translateY }] },
        ]}
      >
        <View
          style={styles.dragHandleTouch}
          onTouchStart={handleSheetTouchStart}
          onTouchEnd={handleSheetTouchEnd}
        >
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {mode === "pickup" ? (
            <PickupDetails
              target={currentTarget}
              onPickedUp={handlePickedUp}
              onNavigate={openGoogleMaps}
              updating={updating || isMapRefreshing}
              swipeTextStyle={styles.pickupSwipeText}
            />
          ) : (
            <DeliveryDetails
              target={currentTarget}
              onDelivered={handleDelivered}
              onCall={handleCall}
              updating={updating || isMapRefreshing}
            />
          )}

          {/* UPCOMING PICKUPS */}
          {mode === "pickup" && pickups.length > 1 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.upcomingTitle}>
                {"Upcoming Pickups (" + (pickups.length - 1) + ")"}
              </Text>
              {pickups.slice(1).map(function (p, i) {
                return (
                  <Pressable
                    key={p.delivery_id}
                    style={styles.upcomingCard}
                    onPress={() => setCurrentTarget(p)}
                  >
                    <View style={styles.upcomingIndex}>
                      <Text style={styles.upcomingIndexText}>{i + 2}</Text>
                    </View>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingName}>
                        {(p.restaurant && p.restaurant.name) ||
                          p.restaurantname ||
                          "Restaurant"}
                      </Text>
                      <Text style={styles.upcomingMeta}>
                        {"#" + (p.order_number || p.delivery_id)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* UPCOMING DELIVERIES */}
          {mode === "deliver" && deliveriesList.length > 1 && (
            <View style={styles.upcomingSection}>
              <Text style={styles.upcomingTitle}>
                {"Upcoming Deliveries (" + (deliveriesList.length - 1) + ")"}
              </Text>
              {deliveriesList.slice(1).map(function (d, i) {
                return (
                  <Pressable
                    key={d.delivery_id}
                    style={styles.upcomingCard}
                    onPress={() => setCurrentTarget(d)}
                  >
                    <View style={styles.upcomingIndex}>
                      <Text style={styles.upcomingIndexText}>{i + 2}</Text>
                    </View>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingName}>
                        {(d.customer && d.customer.name) ||
                          d.name ||
                          "Customer"}
                      </Text>
                      <Text style={styles.upcomingMeta}>
                        {"#" + (d.order_number || d.delivery_id)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* START DELIVERY button – shown once all pickups are done */}
          {mode === "pickup" &&
            pickups.length === 0 &&
            deliveriesList.length > 0 && (
              <Pressable
                style={styles.startDeliveryBtn}
                onPress={handleStartDelivery}
              >
                <Text style={styles.startDeliveryBtnText}>
                  {"🚀 START DELIVERY"}
                </Text>
              </Pressable>
            )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>

      <View
        style={[
          styles.driverMapTabBar,
          {
            height: mapTabBarHeight,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <TabBarItem
          label="Home"
          icon="home"
          focused={false}
          onPress={() =>
            navigation.navigate("DriverTabs", {
              screen: "Dashboard",
            })
          }
        />
        <TabBarItem
          label="Available"
          icon="list"
          focused={false}
          onPress={() =>
            navigation.navigate("DriverTabs", {
              screen: "Available",
            })
          }
        />
        <TabBarItem
          label="Active"
          icon="location"
          focused={true}
          onPress={() => {}}
        />
        <TabBarItem
          label="Earnings"
          icon="wallet"
          focused={false}
          onPress={() =>
            navigation.navigate("DriverTabs", {
              screen: "Earnings",
            })
          }
        />
        <TabBarItem
          label="Payment"
          icon="card"
          focused={false}
          onPress={() =>
            navigation.navigate("DriverTabs", {
              screen: "Payment",
            })
          }
        />
      </View>
    </Animated.View>
  );
}

function TabBarItem({ label, icon, focused, onPress }) {
  return (
    <Pressable style={styles.tabBarItem} onPress={onPress}>
      <Ionicons
        name={icon}
        size={24}
        color={focused ? "#06C168" : "#9ca3af"}
        style={styles.tabBarIcon}
      />
      <Text style={[styles.tabBarLabel, focused && styles.tabBarLabelFocused]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// PICKUP DETAILS
// ============================================================================

function PickupDetails({
  target,
  onPickedUp,
  onNavigate,
  updating,
  swipeTextStyle,
}) {
  let restaurant = target.restaurant || {};
  let orderItems = target.order_items || target.items || [];

  return (
    <View style={styles.detailsWrap}>
      {/* Block 1: Order number + distance + time */}
      <View style={styles.orderHeaderCard}>
        <View>
          <Text style={styles.orderHeaderLabel}>ORDER ID</Text>
          <Text style={styles.orderHeaderValue}>
            {"#" + (target.order_number || target.delivery_id)}
          </Text>
        </View>
        <View style={styles.orderHeaderBadges}>
          {target.distance_km ? (
            <MetricBadge type="distance" value={target.distance_km} unit="km" />
          ) : null}
          {target.estimated_time_minutes ? (
            <MetricBadge
              type="time"
              value={target.estimated_time_minutes}
              unit="min"
            />
          ) : null}
        </View>
      </View>

      {/* Block 2: Restaurant info */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoCardMain}>
            <Text style={[styles.infoCardName, styles.pickupInfoCardName]}>
              {restaurant.name || target.restaurantname || "Restaurant"}
            </Text>
            <Text style={styles.infoCardAddress}>
              {restaurant.address || target.restaurantaddress || "No address"}
            </Text>
          </View>
          <Pressable style={styles.navigateIconBtn} onPress={onNavigate}>
            <Text style={styles.navigateIconBtnText}>⌲</Text>
          </Pressable>
        </View>
      </View>

      {/* Block 3: Order items */}
      {orderItems.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionTitle}>ORDER ITEMS</Text>
          <View style={styles.itemsCard}>
            {orderItems.map(function (item, idx) {
              let name = item.food_name || item.name || "Item";
              let qty = item.quantity || 1;
              return (
                <View
                  key={idx}
                  style={[
                    styles.itemRow,
                    idx < orderItems.length - 1 && styles.itemRowBorder,
                  ]}
                >
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQty}>{qty + "x"}</Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemNameText}>{name}</Text>
                    {item.size ? (
                      <Text style={styles.itemSize}>
                        {item.size.charAt(0).toUpperCase() + item.size.slice(1)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <SwipeToDeliver
        onSwipeComplete={onPickedUp}
        disabled={updating}
        text="SWIPE TO PICK UP"
        textStyle={swipeTextStyle}
        color="#06C168"
      />
    </View>
  );
}

// ============================================================================
// DELIVERY DETAILS
// ============================================================================

function DeliveryDetails({ target, onDelivered, onCall, updating }) {
  let customer = target.customer || {};
  let delivItems = target.items || [];
  const existingProofUrl =
    target.delivery_proof_url || target.proof_photo_url || null;

  return (
    <View style={styles.detailsWrap}>
      {/* Block 1: Order number + distance + time */}
      <View style={styles.orderHeaderCard}>
        <View>
          <Text style={styles.orderHeaderLabel}>ORDER ID</Text>
          <Text style={styles.orderHeaderValue}>
            {"#" + (target.order_number || target.delivery_id)}
          </Text>
        </View>
        <View style={styles.orderHeaderBadges}>
          {target.distance_km ? (
            <MetricBadge type="distance" value={target.distance_km} unit="km" />
          ) : null}
          {target.estimated_time_minutes ? (
            <MetricBadge
              type="time"
              value={target.estimated_time_minutes}
              unit="min"
            />
          ) : null}
        </View>
      </View>

      {/* Block 2: Customer info */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoCardMain}>
            <Text style={[styles.infoCardName, styles.pickupInfoCardName]}>
              {customer.name || target.name || "Customer"}
            </Text>
            <Text style={styles.infoCardAddress}>
              {customer.address || target.delivery_location || "No address"}
            </Text>
            {customer.city ? (
              <Text style={styles.deliveryInfoCity}>{customer.city}</Text>
            ) : null}
            {customer.phone || target.phone ? (
              <Text style={styles.infoCardPhoneText}>
                {customer.phone || target.phone}
              </Text>
            ) : null}
          </View>
          <View style={styles.infoCardActions}>
            {customer.phone || target.phone ? (
              <Pressable
                style={styles.iconBtn}
                onPress={() => onCall(customer.phone || target.phone)}
              >
                <Ionicons name="call" size={34} color="#16a34a" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Special instructions */}
      {target.delivery_instructions ? (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>
            {"📝 Special Instructions"}
          </Text>
          <Text style={styles.instructionsText}>
            {target.delivery_instructions}
          </Text>
        </View>
      ) : null}

      {/* Block 3: Order items */}
      {delivItems.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionTitle}>ORDER ITEMS</Text>
          <View style={styles.itemsCard}>
            {delivItems.map(function (item, idx) {
              let name = item.food_name || item.name || "Item";
              let qty = item.quantity || 1;
              return (
                <View
                  key={idx}
                  style={[
                    styles.itemRow,
                    idx < delivItems.length - 1 && styles.itemRowBorder,
                  ]}
                >
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQty}>{qty + "x"}</Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemNameText}>{name}</Text>
                    {item.size ? (
                      <Text style={styles.itemSize}>
                        {item.size.charAt(0).toUpperCase() + item.size.slice(1)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Block 4: Total amount to collect */}
      <View style={styles.totalAmountCard}>
        <View>
          <Text style={styles.totalAmountLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalAmountValue}>
            {"Rs. " +
              parseFloat(
                (target.pricing && target.pricing.total) ||
                  parseFloat(target.total_amount || 0) +
                    parseFloat(target.delivery_fee || 0),
              ).toFixed(2)}
          </Text>
        </View>
      </View>

      <SwipeToDeliver
        onSwipeComplete={onDelivered}
        disabled={updating}
        text="SWIPE TO DELIVER"
        textStyle={styles.pickupSwipeText}
        color="#06C168"
      />

      <DeliveryProofUpload
        deliveryId={target.delivery_id}
        existingProofUrl={existingProofUrl}
        onUploaded={() => {}}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

let SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  android: {
    elevation: 4,
  },
});

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  // Loading / Empty
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingText: { marginTop: 16, fontSize: 16, color: "#6B7280" },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, color: "#6B7280", marginBottom: 24 },
  goBackBtn: {
    backgroundColor: "#06C168",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  goBackBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Top
  topContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  backButton: {
    marginTop: 6,
    width: 38,
    height: 38,
    backgroundColor: "#fff",
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOW,
  },
  backButtonText: { fontSize: 28, lineHeight: 30, color: "#374151" },

  // Navigate / Recenter
  navigateBtn: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.4 + 12,
    left: "50%",
    transform: [{ translateX: -64 }],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 6,
    zIndex: 10,
    ...SHADOW,
  },
  navigateBtnIcon: { fontSize: 18 },
  navigateBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  mapRefreshBtn: {
    position: "absolute",
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    ...SHADOW,
  },
  recenterBtn: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.4 + 8,
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    ...SHADOW,
  },
  recenterBtnIcon: { fontSize: 22 },

  driverMapTabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    paddingTop: 8,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    zIndex: 30,
  },
  tabBarItem: {
    width: 65,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabBarIcon: {
    marginBottom: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabBarLabelFocused: {
    color: "#06C168",
    fontWeight: "700",
  },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  bottomSheetCollapsed: {
    height: SCREEN_HEIGHT * 0.4,
  },
  bottomSheetExpanded: {
    height: SCREEN_HEIGHT * 0.6,
  },
  dragHandleTouch: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
  },
  sheetScroll: { flex: 1, paddingHorizontal: 18 },

  // Details
  detailsWrap: { paddingBottom: 10 },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailsTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  orderIdBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderIdText: { fontSize: 13, fontWeight: "700", color: "#6B7280" },

  // Info Card
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoCardEmoji: { fontSize: 18 },
  infoCardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  infoCardName: {
    fontSize: 31,
    fontWeight: "800",
    color: "#089345",
    marginBottom: 4,
  },
  pickupInfoCardName: {
    fontSize: 20,
  },
  infoCardAddress: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
    marginBottom: 2,
  },
  callBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  callBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Instructions
  instructionsCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 6,
  },
  instructionsText: { fontSize: 14, color: "#78350F", lineHeight: 20 },

  // Items
  itemsSection: { marginBottom: 14 },
  itemsSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  itemsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemNameText: { flex: 1, fontSize: 14, color: "#374151" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#111827" },

  // Pricing
  pricingCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pricingLabel: { fontSize: 14, color: "#6B7280" },
  pricingValue: { fontSize: 14, color: "#374151", fontWeight: "600" },
  pricingDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  pricingTotalLabel: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pricingTotalValue: { fontSize: 16, fontWeight: "700", color: "#06C168" },

  // Action
  actionBtn: {
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  pickupActionBtn: { backgroundColor: "#F59E0B" },
  deliverActionBtn: { backgroundColor: "#06C168" },
  actionBtnDisabled: { opacity: 0.55 },
  actionBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  // Upcoming
  upcomingSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  upcomingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  upcomingIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  upcomingIndexText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  upcomingInfo: { flex: 1 },
  upcomingName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  upcomingMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  upcomingRight: { alignItems: "flex-end" },
  upcomingDist: { fontSize: 12, fontWeight: "700", color: "#06C168" },
  upcomingTime: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // Start Delivery button
  startDeliveryBtn: {
    marginTop: 16,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  startDeliveryBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },

  // Order header card (Block 1 in PickupDetails / DeliveryDetails)
  orderHeaderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  orderHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  orderHeaderValue: { fontSize: 16, fontWeight: "800", color: "#111827" },
  orderHeaderBadges: { flexDirection: "row", gap: 6 },
  metricBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metricBadgeText: { fontSize: 12, fontWeight: "700", color: "#065F46" },

  // Info card row layout
  infoCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  infoCardMain: { flex: 1, marginRight: 10 },
  infoCardCity: { fontSize: 22, color: "#6B7280", marginTop: 2 },
  deliveryInfoCity: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  infoCardPhoneText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#16a34a",
  },
  infoCardActions: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  navigateIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  navigateIconBtnText: {
    fontSize: 22,
    color: "#DC143C",
    lineHeight: 24,
  },
  iconBtn: {
    height: 48,
    width: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnText: { fontSize: 28, color: "#16a34a", lineHeight: 30 },

  // Item layout
  itemQtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  itemDetails: { flex: 1 },
  itemSize: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  itemQty: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  pickupSwipeText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // Total amount card
  totalAmountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  totalAmountLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmountValue: { fontSize: 24, fontWeight: "800", color: "#06C168" },
});
