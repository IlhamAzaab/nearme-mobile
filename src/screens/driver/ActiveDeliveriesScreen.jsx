/**
 * Active Deliveries Screen (React Native)
 *
 * Converted from web version with same logic and styling:
 * - Full route map overview (Driver → All Restaurants → All Customers)
 * - Optimized route order (nearest first using Haversine)
 * - OSRM routing for segment-by-segment directions
 * - Pickup and Deliver modes with auto-switch
 * - Interactive maps with FREE Carto tiles
 * - Polyline routes
 * - Skeleton loading with shimmer
 * - Caching for instant load
 * - Real-time location updates every 3 seconds
 * - Auto-navigate to map page when deliveries available
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import * as Location from "expo-location";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY_ACTIVE = "active_deliveries_cache";
const CACHE_EXPIRY = 30000; // 30 seconds cache (active deliveries need fresher data)
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds
const DATA_REFRESH_INTERVAL = 5000; // 5 seconds

// Default driver location (Kinniya, Sri Lanka)
const DEFAULT_DRIVER_LOCATION = {
  latitude: 8.5017,
  longitude: 81.186,
};

// Carto Voyager tiles (FREE - no API key needed)
const CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

// Marker colors
const MARKER_COLORS = {
  driver: "#10B981",
  restaurant: "#EF4444",
  customer: "#3B82F6",
  route: "#8B5CF6",
};

// ============================================================================
// CACHE HELPERS
// ============================================================================

const loadCachedData = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY_ACTIVE);
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
      CACHE_KEY_ACTIVE,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn("Cache save error:", e);
  }
};

// ============================================================================
// HAVERSINE DISTANCE CALCULATOR
// ============================================================================

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// ============================================================================
// POLYLINE DECODER
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActiveDeliveriesScreen({ navigation }) {
  // Initialize with cached data for instant display
  const [pickups, setPickups] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [mode, setMode] = useState("pickup"); // pickup | deliver
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [hasFetchedSuccessfully, setHasFetchedSuccessfully] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [fullRouteData, setFullRouteData] = useState(null);
  const [toast, setToast] = useState(null);

  // Refs
  const locationIntervalRef = useRef(null);
  const dataFetchIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initScreen();
    return () => cleanup();
  }, []);

  const initScreen = async () => {
    // Load cached data for instant display
    const cached = await loadCachedData();
    if (cached) {
      setPickups(cached.pickups || []);
      setDeliveries(cached.deliveries || []);
      setMode(cached.mode || "pickup");
      if (cached.driverLocation) setDriverLocation(cached.driverLocation);
      if (cached.fullRouteData) setFullRouteData(cached.fullRouteData);
      setHasFetchedSuccessfully(true);
      setInitialLoading(false);
    }

    // Get location and fetch fresh data
    await fetchWithLocation(false);

    // Update location every 3 seconds for live map display
    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, LOCATION_UPDATE_INTERVAL);

    // Fetch data every 5 seconds (active deliveries need fresher data)
    dataFetchIntervalRef.current = setInterval(() => {
      console.log("[DATA REFRESH] Fetching active deliveries...");
      fetchWithLocation(true);
    }, DATA_REFRESH_INTERVAL);
  };

  const cleanup = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    if (dataFetchIntervalRef.current) {
      clearInterval(dataFetchIntervalRef.current);
      dataFetchIntervalRef.current = null;
    }
  };

  // ============================================================================
  // LOCATION TRACKING
  // ============================================================================

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[LOCATION] Permission denied, using default");
        return DEFAULT_DRIVER_LOCATION;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err) {
      console.error("[LOCATION] Error:", err);
      return DEFAULT_DRIVER_LOCATION;
    }
  };

  const updateLocation = async () => {
    const location = await getLocation();
    console.log(
      `[LOCATION] Updated: (${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)})`
    );
    setDriverLocation(location);
  };

  const fetchWithLocation = async (isBackgroundRefresh = false) => {
    if (isFetchingRef.current && isBackgroundRefresh) return;

    const location = await getLocation();
    setDriverLocation(location);
    await fetchPickups(location, isBackgroundRefresh);
  };

  // ============================================================================
  // FETCH DATA
  // ============================================================================

  const fetchPickups = async (location, isBackgroundRefresh = false) => {
    if (isFetchingRef.current && isBackgroundRefresh) return;
    isFetchingRef.current = true;

    try {
      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");

      if (role !== "driver") {
        navigation.replace("Login");
        return;
      }

      if (!location) {
        // Even without location, check for active deliveries
        try {
          const fallbackRes = await fetch(
            `${API_BASE_URL}/driver/deliveries/active`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const activeList = fallbackData.deliveries || [];
            if (activeList.length > 0) {
              // Has active deliveries — navigate to map page
              navigation.navigate("DriverMap", {
                deliveryId: activeList[0].id,
              });
              return;
            }
          }
        } catch (e) {
          console.error("Fallback active check error:", e);
        }
        setInitialLoading(false);
        return;
      }

      // Only show skeleton on initial load when no cached data
      if (!isBackgroundRefresh && pickups.length === 0 && deliveries.length === 0) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      // Clear previous error on new fetch attempt
      if (!isBackgroundRefresh) {
        setFetchError(null);
      }

      const url = `${API_BASE_URL}/driver/deliveries/pickups?driver_latitude=${location.latitude}&driver_longitude=${location.longitude}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        setHasFetchedSuccessfully(true);
        setFetchError(null);
        const list = data.pickups || [];
        setPickups(list);

        if (list.length > 0) {
          setMode("pickup");
          setDeliveries([]);

          // Build optimized route
          const optimizedData = buildOptimizedRoute(location, list);
          setFullRouteData(optimizedData);

          // Cache data
          await saveCacheData({
            pickups: list,
            deliveries: [],
            mode: "pickup",
            driverLocation: location,
            fullRouteData: optimizedData,
          });

          // Auto-navigate to map page on initial load (not background refresh)
          if (!isBackgroundRefresh) {
            navigation.navigate("DriverMap", {
              deliveryId: list[0].delivery_id,
              mode: "pickup",
            });
            return;
          }
        } else {
          // No pickups left → check for deliveries to deliver
          await fetchDeliveriesRoute(location, isBackgroundRefresh);
        }
      } else {
        console.error("Failed to fetch pickups:", data.message);
        if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
          setFetchError(`Failed to load pickups: ${data.message || "Server error"}`);
        }
      }
    } catch (e) {
      console.error("Fetch pickups error:", e);
      if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
        setFetchError(`Network error: ${e.message || "Unable to connect to server"}`);
      }
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  const fetchDeliveriesRoute = async (location, isBackgroundRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const url = `${API_BASE_URL}/driver/deliveries/deliveries-route?driver_latitude=${location.latitude}&driver_longitude=${location.longitude}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setHasFetchedSuccessfully(true);
        setFetchError(null);
        const list = data.deliveries || [];
        setDeliveries(list);
        setMode("deliver");
        setPickups([]);

        // Cache data
        await saveCacheData({
          pickups: [],
          deliveries: list,
          mode: "deliver",
          driverLocation: location,
          fullRouteData,
        });

        // Auto-navigate to map page on initial load
        if (list.length > 0 && !isBackgroundRefresh) {
          navigation.navigate("DriverMap", {
            deliveryId: list[0].delivery_id,
            mode: "deliver",
          });
          return;
        }

        // Auto-set first delivery to on_the_way when starting delivering mode
        if (list.length > 0 && list[0].status === "picked_up") {
          try {
            await fetch(
              `${API_BASE_URL}/driver/deliveries/${list[0].delivery_id}/status`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: "on_the_way" }),
              }
            );
            // Optimistically reflect status
            setDeliveries((prev) =>
              prev.map((d, i) => (i === 0 ? { ...d, status: "on_the_way" } : d))
            );
          } catch (err) {
            console.error("Failed to auto-set first delivery on-the-way:", err);
          }
        }
      } else {
        console.error("Failed to fetch deliveries route:", data.message);
        if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
          setFetchError(`Failed to load deliveries: ${data.message || "Server error"}`);
        }
      }
    } catch (e) {
      console.error("Fetch deliveries route error:", e);
      if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
        setFetchError(`Network error: ${e.message || "Unable to connect to server"}`);
      }
    }
  };

  // ============================================================================
  // ROUTE OPTIMIZATION
  // ============================================================================

  // Optimize restaurant pickup order: based on nearest customer distance
  const getOptimizedRestaurantOrderByShortest = (pickupsList, driverLoc) => {
    if (pickupsList.length <= 1) return pickupsList;

    console.log(
      `📍 [SMART ROUTE] Analyzing ${pickupsList.length} deliveries for shortest total distance...`
    );

    // For each restaurant, find which customer is nearest to it
    const restaurantCustomerMap = pickupsList.map((pickup) => {
      const distToCustomer = haversineDistance(
        parseFloat(pickup.restaurant.latitude),
        parseFloat(pickup.restaurant.longitude),
        parseFloat(pickup.customer.latitude),
        parseFloat(pickup.customer.longitude)
      );

      return {
        ...pickup,
        distToOwnCustomer: distToCustomer,
      };
    });

    // Calculate distance from driver to each restaurant
    const withDriverDist = restaurantCustomerMap.map((item) => {
      const distFromDriver = haversineDistance(
        driverLoc.latitude,
        driverLoc.longitude,
        parseFloat(item.restaurant.latitude),
        parseFloat(item.restaurant.longitude)
      );
      return {
        ...item,
        distFromDriver,
      };
    });

    // Sort by: restaurant whose customer is farthest from driver should be picked first
    const sorted = [...withDriverDist].sort((a, b) => {
      const totalA = a.distFromDriver + a.distToOwnCustomer;
      const totalB = b.distFromDriver + b.distToOwnCustomer;
      return totalB - totalA;
    });

    console.log(`📍 [SMART ROUTE] Pickup order (by nearest customer distance):`);
    sorted.forEach((item, idx) => {
      console.log(
        `📍 [SMART ROUTE]   ${idx + 1}. ${item.restaurant.name} → ${item.customer.name} (${(item.distToOwnCustomer / 1000).toFixed(2)} km to customer)`
      );
    });

    return sorted;
  };

  // Optimize customer delivery order based on proximity after all pickups
  const getOptimizedCustomerOrderByShortest = (pickupsList) => {
    if (pickupsList.length <= 1) return pickupsList;

    // After all pickups, driver is at the last restaurant
    const lastRestaurant = pickupsList[pickupsList.length - 1].restaurant;

    const remaining = [...pickupsList];
    const ordered = [];
    let currentLat = parseFloat(lastRestaurant.latitude);
    let currentLng = parseFloat(lastRestaurant.longitude);

    console.log(
      `📍 [SMART ROUTE] Delivery order (starting from last restaurant: ${lastRestaurant.name}):`
    );

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      remaining.forEach((pickup, idx) => {
        const dist = haversineDistance(
          currentLat,
          currentLng,
          parseFloat(pickup.customer.latitude),
          parseFloat(pickup.customer.longitude)
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      });

      const nearest = remaining[nearestIdx];
      ordered.push(nearest);

      console.log(
        `📍 [SMART ROUTE]   C${ordered.length}. ${nearest.customer.name} (${(nearestDist / 1000).toFixed(2)} km from current location)`
      );

      currentLat = parseFloat(nearest.customer.latitude);
      currentLng = parseFloat(nearest.customer.longitude);
      remaining.splice(nearestIdx, 1);
    }

    return ordered;
  };

  const buildOptimizedRoute = (driverLoc, pickupsList) => {
    // STEP 1: Optimize restaurant order
    const optimizedRestaurants = getOptimizedRestaurantOrderByShortest(
      pickupsList,
      driverLoc
    );

    // STEP 2: Optimize customer delivery order
    const optimizedCustomers = getOptimizedCustomerOrderByShortest(optimizedRestaurants);

    console.log(`📍 [FULL ROUTE] ═══════════════════════════════════════════`);
    console.log(`📍 [FULL ROUTE] SMART ROUTE OPTIMIZED ORDER:`);
    console.log(
      `📍 [FULL ROUTE]   Restaurants: ${optimizedRestaurants.map((p) => p.restaurant.name).join(" → ")}`
    );
    console.log(
      `📍 [FULL ROUTE]   Customers: ${optimizedCustomers.map((p) => p.customer.name).join(" → ")}`
    );
    console.log(`📍 [FULL ROUTE] ═══════════════════════════════════════════`);

    return {
      driver_location: driverLoc,
      optimizedRestaurants,
      optimizedCustomers,
      total_deliveries: pickupsList.length,
    };
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handlePrimaryAction = () => {
    if (mode === "pickup") {
      if (pickups.length === 0) {
        showToast("No pickups available", "error");
        return;
      }
      navigation.navigate("DriverMap", {
        deliveryId: pickups[0].delivery_id,
        mode: "pickup",
      });
      return;
    }
    if (mode === "deliver") {
      if (deliveries.length === 0) {
        showToast("No deliveries available", "error");
        return;
      }
      navigation.navigate("DriverMap", {
        deliveryId: deliveries[0].delivery_id,
        mode: "deliver",
      });
    }
  };

  const onRefresh = useCallback(() => {
    fetchWithLocation(true);
  }, []);

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

  // ============================================================================
  // RENDER
  // ============================================================================

  const hasActiveDeliveries = pickups.length > 0 || deliveries.length > 0;
  const currentList = mode === "pickup" ? pickups : deliveries;

  return (
    <View style={styles.container}>
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

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Active Deliveries</Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubtitle}>
                {mode === "pickup"
                  ? `${pickups.length} pickup${pickups.length !== 1 ? "s" : ""} ready`
                  : `${deliveries.length} deliver${deliveries.length !== 1 ? "ies" : "y"} ready`}
              </Text>
              {isRefreshing && (
                <ActivityIndicator
                  size="small"
                  color="#10B981"
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
            <Text style={styles.modeLabel}>
              Mode: {mode === "pickup" ? "Pick-up" : "Delivering"}
            </Text>
          </View>
          <Pressable
            style={styles.availableBtn}
            onPress={() => navigation.navigate("Available")}
          >
            <Text style={styles.availableBtnText}>Available</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Content */}
      {initialLoading ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : fetchError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{fetchError}</Text>
          <Text style={styles.errorHint}>
            Please check your internet connection and try again
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              setFetchError(null);
              setInitialLoading(true);
              fetchWithLocation(false);
            }}
          >
            <Text style={styles.retryBtnIcon}>🔄</Text>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : !hasActiveDeliveries ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>
            {mode === "pickup" ? "No Active Pickups" : "No Active Deliveries"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {mode === "pickup"
              ? "Accept deliveries to start picking up orders"
              : "Pick up orders to start delivering to customers"}
          </Text>
          <Pressable
            style={styles.findDeliveriesBtn}
            onPress={() => navigation.navigate("Available")}
          >
            <Text style={styles.findDeliveriesBtnText}>View Available Deliveries</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#10B981"
              colors={["#10B981"]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Full Route Overview Map */}
          {mode === "pickup" && pickups.length > 0 && fullRouteData && (
            <FullRouteMap
              driverLocation={driverLocation}
              pickups={pickups}
              fullRouteData={fullRouteData}
            />
          )}
        </ScrollView>
      )}

      {/* Fixed Start Button */}
      {hasActiveDeliveries && (
        <SafeAreaView edges={["bottom"]} style={styles.fixedBottom}>
          <Pressable style={styles.startBtn} onPress={handlePrimaryAction}>
            <Text style={styles.startBtnIcon}>📍</Text>
            <Text style={styles.startBtnText}>
              {mode === "pickup" ? "START PICK-UP" : "START DELIVERY"}
            </Text>
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  );
}

// ============================================================================
// FULL ROUTE MAP COMPONENT
// ============================================================================

function FullRouteMap({ driverLocation, pickups, fullRouteData }) {
  const mapRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const hasFetchedDirections = useRef(false);

  const { optimizedRestaurants = [], optimizedCustomers = [] } = fullRouteData || {};

  // Calculate all coordinates for map fitting
  const allCoordinates = useMemo(() => {
    const coords = [];
    if (driverLocation) {
      coords.push({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      });
    }
    pickups.forEach((p) => {
      if (p.restaurant) {
        coords.push({
          latitude: parseFloat(p.restaurant.latitude),
          longitude: parseFloat(p.restaurant.longitude),
        });
      }
      if (p.customer) {
        coords.push({
          latitude: parseFloat(p.customer.latitude),
          longitude: parseFloat(p.customer.longitude),
        });
      }
    });
    return coords;
  }, [driverLocation, pickups]);

  // Calculate map center
  const getCenter = () => {
    if (allCoordinates.length === 0) {
      return { latitude: 0, longitude: 0 };
    }
    const avgLat =
      allCoordinates.reduce((sum, c) => sum + c.latitude, 0) / allCoordinates.length;
    const avgLng =
      allCoordinates.reduce((sum, c) => sum + c.longitude, 0) / allCoordinates.length;
    return { latitude: avgLat, longitude: avgLng };
  };

  // Fetch segment-by-segment route using OSRM
  const fetchDirections = useCallback(async () => {
    if (hasFetchedDirections.current) return;
    if (!driverLocation || pickups.length === 0) return;

    hasFetchedDirections.current = true;

    // Build waypoints
    const restOrder = optimizedRestaurants.length > 0 ? optimizedRestaurants : pickups;
    const custOrder = optimizedCustomers.length > 0 ? optimizedCustomers : pickups;

    const waypoints = [
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      ...restOrder.map((p) => ({
        lat: parseFloat(p.restaurant.latitude),
        lng: parseFloat(p.restaurant.longitude),
      })),
      ...custOrder.map((p) => ({
        lat: parseFloat(p.customer.latitude),
        lng: parseFloat(p.customer.longitude),
      })),
    ];

    try {
      console.log(`📍 [SEGMENT ROUTE] Starting segment-by-segment route calculation...`);
      console.log(`📍 [SEGMENT ROUTE] Total waypoints: ${waypoints.length}`);

      const allRouteSegments = [];
      let totalDistance = 0;
      let totalDuration = 0;

      // Fetch each segment individually
      for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        const segmentUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(segmentUrl, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const data = await response.json();

          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const route = data.routes[0];

            const segmentPath = route.geometry.coordinates.map((coord) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));

            // Skip first point for non-first segments to avoid duplicates
            if (allRouteSegments.length > 0 && segmentPath.length > 0) {
              allRouteSegments.push(...segmentPath.slice(1));
            } else {
              allRouteSegments.push(...segmentPath);
            }

            totalDistance += route.distance;
            totalDuration += route.duration;

            console.log(
              `📍 [SEGMENT ${i + 1}/${waypoints.length - 1}] ✓ ${(route.distance / 1000).toFixed(2)} km, ${Math.ceil(route.duration / 60)} min`
            );
          } else {
            console.warn(`📍 [SEGMENT ${i + 1}] Failed to get route, using straight line`);
            allRouteSegments.push({ latitude: from.lat, longitude: from.lng });
            allRouteSegments.push({ latitude: to.lat, longitude: to.lng });
          }

          // Small delay between requests
          if (i < waypoints.length - 2) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (segmentError) {
          console.warn(`📍 [SEGMENT ${i + 1}] Error:`, segmentError.message);
          allRouteSegments.push({ latitude: from.lat, longitude: from.lng });
          allRouteSegments.push({ latitude: to.lat, longitude: to.lng });
        }
      }

      if (allRouteSegments.length > 0) {
        setRoutePath(allRouteSegments);
        setRouteInfo({
          totalDistance: (totalDistance / 1000).toFixed(2),
          totalDuration: Math.ceil(totalDuration / 60),
        });

        console.log("📍 [SEGMENT ROUTE] ═══════════════════════════════════════════");
        console.log("📍 [SEGMENT ROUTE] Route calculation complete:");
        console.log(`📍 [SEGMENT ROUTE]   Total distance: ${(totalDistance / 1000).toFixed(2)} km`);
        console.log(`📍 [SEGMENT ROUTE]   Total duration: ${Math.ceil(totalDuration / 60)} min`);
        console.log("📍 [SEGMENT ROUTE] ═══════════════════════════════════════════");
      }
    } catch (error) {
      console.error("Failed to fetch segment routes:", error);
    }
  }, [driverLocation, pickups, optimizedRestaurants, optimizedCustomers]);

  // Reset when pickups change
  useEffect(() => {
    hasFetchedDirections.current = false;
  }, [pickups.length]);

  // Trigger route fetch
  useEffect(() => {
    if (driverLocation && pickups.length > 0 && !hasFetchedDirections.current) {
      fetchDirections();
    }
  }, [driverLocation, pickups, fetchDirections]);

  // Fit map to markers
  useEffect(() => {
    if (mapRef.current && allCoordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(allCoordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [allCoordinates]);

  const restOrder = optimizedRestaurants.length > 0 ? optimizedRestaurants : pickups;
  const custOrder = optimizedCustomers.length > 0 ? optimizedCustomers : pickups;

  return (
    <View style={styles.fullRouteCard}>
      {/* Header */}
      <View style={styles.fullRouteHeader}>
        <Text style={styles.fullRouteTitle}>🗺️ Full Route Overview</Text>
        <Text style={styles.fullRouteSubtitle}>
          Driver → {pickups.length} Restaurant{pickups.length > 1 ? "s" : ""} → {pickups.length}{" "}
          Customer{pickups.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Stats */}
      {routeInfo && (
        <View style={styles.fullRouteStats}>
          <View style={styles.fullRouteStat}>
            <Text style={styles.fullRouteStatValue}>{routeInfo.totalDistance}</Text>
            <Text style={styles.fullRouteStatLabel}>km Total</Text>
          </View>
          <View style={styles.fullRouteStat}>
            <Text style={styles.fullRouteStatValue}>{routeInfo.totalDuration}</Text>
            <Text style={styles.fullRouteStatLabel}>min ETA</Text>
          </View>
          <View style={styles.fullRouteStat}>
            <Text style={styles.fullRouteStatValue}>{pickups.length * 2}</Text>
            <Text style={styles.fullRouteStatLabel}>Stops</Text>
          </View>
        </View>
      )}

      {/* Map */}
      <View style={styles.fullRouteMapContainer}>
        <MapView
          ref={mapRef}
          style={styles.fullRouteMap}
          mapType="none"
          initialRegion={{
            ...getCenter(),
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {/* FREE Carto Tiles */}
          <UrlTile
            urlTemplate={CARTO_TILE_URL}
            maximumZ={19}
            flipY={false}
            tileSize={256}
            zIndex={-1}
          />

          {/* Driver Marker */}
          {driverLocation && (
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
            >
              <View style={[styles.mapMarker, styles.driverMarker]}>
                <Text style={styles.mapMarkerText}>D</Text>
              </View>
            </Marker>
          )}

          {/* Restaurant Markers */}
          {restOrder.map((pickup, idx) =>
            pickup.restaurant && (
              <Marker
                key={`r-marker-${pickup.delivery_id}`}
                coordinate={{
                  latitude: parseFloat(pickup.restaurant.latitude),
                  longitude: parseFloat(pickup.restaurant.longitude),
                }}
              >
                <View style={[styles.mapMarker, styles.restaurantMarker]}>
                  <Text style={styles.mapMarkerText}>R{idx + 1}</Text>
                </View>
              </Marker>
            )
          )}

          {/* Customer Markers */}
          {custOrder.map((pickup, idx) =>
            pickup.customer && (
              <Marker
                key={`c-marker-${pickup.delivery_id}`}
                coordinate={{
                  latitude: parseFloat(pickup.customer.latitude),
                  longitude: parseFloat(pickup.customer.longitude),
                }}
              >
                <View style={[styles.mapMarker, styles.customerMarker]}>
                  <Text style={styles.mapMarkerText}>C{idx + 1}</Text>
                </View>
              </Marker>
            )
          )}

          {/* Route Polyline */}
          {routePath.length > 1 && (
            <>
              {/* Shadow layer */}
              <Polyline
                coordinates={routePath}
                strokeColor="rgba(255,255,255,0.4)"
                strokeWidth={8}
              />
              {/* Main route */}
              <Polyline
                coordinates={routePath}
                strokeColor={MARKER_COLORS.route}
                strokeWidth={5}
              />
            </>
          )}
        </MapView>
      </View>

      {/* Ordered Stops List */}
      <View style={styles.stopsContainer}>
        <Text style={styles.stopsTitle}>📋 Ordered Stops</Text>

        {/* Driver Starting Point */}
        <View style={[styles.stopItem, styles.stopItemDriver]}>
          <View style={[styles.stopMarker, { backgroundColor: MARKER_COLORS.driver }]}>
            <Text style={styles.stopMarkerText}>D</Text>
          </View>
          <View style={styles.stopContent}>
            <Text style={styles.stopName}>Your Location (Starting Point)</Text>
            <Text style={styles.stopAddress}>Driver Position</Text>
          </View>
        </View>

        {/* Restaurant Pickups */}
        {restOrder.map((pickup, idx) => (
          <View key={`stop-r-${idx}`} style={[styles.stopItem, styles.stopItemRestaurant]}>
            <View style={[styles.stopMarker, { backgroundColor: MARKER_COLORS.restaurant }]}>
              <Text style={styles.stopMarkerText}>R{idx + 1}</Text>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopName}>🍽️ {pickup.restaurant?.name}</Text>
              <Text style={styles.stopAddress}>{pickup.restaurant?.address}</Text>
              <Text style={styles.stopOrder}>Order #{pickup.order_number}</Text>
            </View>
          </View>
        ))}

        {/* Customer Deliveries */}
        {custOrder.map((pickup, idx) => (
          <View key={`stop-c-${idx}`} style={[styles.stopItem, styles.stopItemCustomer]}>
            <View style={[styles.stopMarker, { backgroundColor: MARKER_COLORS.customer }]}>
              <Text style={styles.stopMarkerText}>C{idx + 1}</Text>
            </View>
            <View style={styles.stopContent}>
              <Text style={styles.stopName}>👤 {pickup.customer?.name}</Text>
              <Text style={styles.stopAddress}>{pickup.customer?.address}</Text>
              <Text style={styles.stopOrder}>Order #{pickup.order_number}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS.driver }]} />
          <Text style={styles.legendText}>Driver (D)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS.restaurant }]} />
          <Text style={styles.legendText}>Restaurant (R)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS.customer }]} />
          <Text style={styles.legendText}>Customer (C)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: MARKER_COLORS.route }]} />
          <Text style={styles.legendText}>Route Path</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// SKELETON CARD COMPONENT
// ============================================================================

function SkeletonCard() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.skeletonCard}>
      {/* Map Skeleton */}
      <Animated.View style={[styles.skeletonMap, { opacity: shimmerOpacity }]}>
        <View style={styles.skeletonMapBadge} />
        <View style={styles.skeletonMapBadge2} />
      </Animated.View>

      {/* Content Skeleton */}
      <View style={styles.skeletonContent}>
        {/* Location Info */}
        <View style={styles.skeletonRow}>
          <Animated.View
            style={[styles.skeletonCircle, { opacity: shimmerOpacity }]}
          />
          <View style={styles.skeletonLines}>
            <Animated.View
              style={[styles.skeletonLine, { width: 120, opacity: shimmerOpacity }]}
            />
            <Animated.View
              style={[styles.skeletonLine, { width: 180, marginTop: 6, opacity: shimmerOpacity }]}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.skeletonStats}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonStatItem}>
              <Animated.View
                style={[styles.skeletonStatValue, { opacity: shimmerOpacity }]}
              />
              <Animated.View
                style={[styles.skeletonStatLabel, { opacity: shimmerOpacity }]}
              />
            </View>
          ))}
        </View>

        {/* Button */}
        <Animated.View style={[styles.skeletonButton, { opacity: shimmerOpacity }]} />
      </View>
    </View>
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
    backgroundColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#EF4444",
  },
  toastText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // Header
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  modeLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  availableBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  availableBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  findDeliveriesBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  findDeliveriesBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Error State
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#EF4444",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    gap: 8,
  },
  retryBtnIcon: {
    fontSize: 18,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Fixed Bottom
  fixedBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 0 : 12,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  startBtnIcon: {
    fontSize: 22,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },

  // ============================================================================
  // FULL ROUTE MAP STYLES
  // ============================================================================

  fullRouteCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#10B981",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fullRouteHeader: {
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fullRouteTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  fullRouteSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  fullRouteStats: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#D1FAE5",
  },
  fullRouteStat: {
    flex: 1,
    alignItems: "center",
  },
  fullRouteStatValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#059669",
  },
  fullRouteStatLabel: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
    marginTop: 2,
  },
  fullRouteMapContainer: {
    height: 300,
    backgroundColor: "#E5E7EB",
  },
  fullRouteMap: {
    flex: 1,
  },

  // Map Markers
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  driverMarker: {
    backgroundColor: MARKER_COLORS.driver,
  },
  restaurantMarker: {
    backgroundColor: MARKER_COLORS.restaurant,
  },
  customerMarker: {
    backgroundColor: MARKER_COLORS.customer,
  },
  mapMarkerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Stops List
  stopsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  stopItemDriver: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  stopItemRestaurant: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  stopItemCustomer: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  stopMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stopMarkerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  stopContent: {
    flex: 1,
  },
  stopName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  stopAddress: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  stopOrder: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "600",
    marginTop: 4,
  },

  // Legend
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 16,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLine: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
  },

  // ============================================================================
  // SKELETON STYLES
  // ============================================================================

  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  skeletonMap: {
    height: 200,
    backgroundColor: "#E5E7EB",
    justifyContent: "space-between",
    padding: 12,
  },
  skeletonMapBadge: {
    width: 100,
    height: 32,
    backgroundColor: "#D1D5DB",
    borderRadius: 8,
  },
  skeletonMapBadge2: {
    width: 80,
    height: 32,
    backgroundColor: "#D1D5DB",
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  skeletonContent: {
    padding: 16,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
  },
  skeletonStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 16,
  },
  skeletonStatItem: {
    alignItems: "center",
  },
  skeletonStatValue: {
    width: 48,
    height: 24,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 6,
  },
  skeletonStatLabel: {
    width: 64,
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
  },
  skeletonButton: {
    height: 52,
    backgroundColor: "#A7F3D0",
    borderRadius: 14,
  },
});
