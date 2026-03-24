/**
 * Active Deliveries Screen (React Native) - ENHANCED VERSION
 *
 * Converted from web version with EXACT same logic and styling:
 * - Full route map overview (Driver → All Restaurants → All Customers)
 * - Individual pickup/delivery cards with mini maps
 * - Optimized route order using OSRM real driving distances
 * - Movement-based refresh (30m threshold)
 * - Pickup and Deliver modes with auto-switch
 * - Interactive maps with FREE OpenStreetMap tiles
 * - Skeleton loading with shimmer effects
 * - Caching for instant load
 * - Real-time location updates with watchPosition
 * - Auto-navigate to map page when deliveries available
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FreeMapView from "../../components/maps/FreeMapView";
import { API_BASE_URL } from "../../constants/api";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY_ACTIVE = "active_deliveries_cache";
const CACHE_EXPIRY = 30000; // 30 seconds cache (active deliveries need fresher data)
const LIVE_TRACKING_INTERVAL = 3000; // 3 seconds - smooth driver marker updates
const DATA_REFRESH_THRESHOLD = 100; // Only fetch API data when driver moves 100m+

// Default driver location (Kinniya, Sri Lanka)
const DEFAULT_DRIVER_LOCATION = {
  latitude: 8.5017,
  longitude: 81.186,
};

// Marker colors
const MARKER_COLORS = {
  driver: "#06C168",
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
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch (e) {
    console.warn("Cache save error:", e);
  }
};

// ============================================================================
// DISTANCE CALCULATOR
// ============================================================================

const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ============================================================================
// OSRM DISTANCE CALCULATOR
// ============================================================================

const getOSRMDistance = async (lat1, lng1, lat2, lng2) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `https://router.project-osrm.org/route/v1/foot/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (data.code === "Ok" && data.routes?.[0]) {
      return data.routes[0].distance; // meters
    }
    return null;
  } catch (e) {
    console.warn(`[OSRM] Distance request failed: ${e.message}`);
    return null;
  }
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
// PICKUP CARD COMPONENT (Matching web version structure)
// ============================================================================

const PickupCard = ({ pickup, index, isFirst, driverLocation }) => {
  const navigation = useNavigation();

  const formatDistance = (meters) => {
    if (!meters) return "Calculating...";
    return meters < 1000
      ? `${Math.round(meters)}m`
      : `${(meters / 1000).toFixed(1)}km`;
  };

  const formatETA = (seconds) => {
    if (!seconds) return "Calculating...";
    const mins = Math.round(seconds / 60);
    return `~${mins} min${mins !== 1 ? "s" : ""}`;
  };

  const handleNavigate = () => {
    navigation.navigate("DriverMap", {
      deliveryId: pickup.delivery_id,
      mode: "pickup",
    });
  };

  return (
    <View style={styles.deliveryCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {isFirst ? "🎯 Next Pickup" : `Pickup #${index + 1}`}
        </Text>
        {isFirst && (
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>START</Text>
          </View>
        )}
      </View>

      {/* Restaurant Info */}
      <View style={styles.stopSection}>
        <View style={styles.stopIcon}>
          <Text style={styles.stopEmoji}>🏪</Text>
        </View>
        <View style={styles.stopDetails}>
          <Text style={styles.stopTitle}>
            {pickup.restaurantname || "Unknown Restaurant"}
          </Text>
          <Text style={styles.stopAddress}>
            {pickup.restaurantaddress || "No address"}
          </Text>
          {pickup.restaurantDistance && (
            <Text style={styles.stopMeta}>
              📍 {formatDistance(pickup.restaurantDistance)}
            </Text>
          )}
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.stopSection}>
        <View style={styles.stopIcon}>
          <Text style={styles.stopEmoji}>📍</Text>
        </View>
        <View style={styles.stopDetails}>
          <Text style={styles.stopTitle}>{pickup.name || "Customer"}</Text>
          <Text style={styles.stopAddress}>
            {pickup.delivery_location || "No address"}
          </Text>
          {pickup.customerDistance && (
            <Text style={styles.stopMeta}>
              📍 {formatDistance(pickup.customerDistance)}
            </Text>
          )}
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity style={styles.startButton} onPress={handleNavigate}>
        <Text style={styles.startButtonText}>🚗 Start Delivery</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// DELIVERY CARD COMPONENT (Matching web version structure)
// ============================================================================

const DeliveryCard = ({ delivery, index, isFirst, driverLocation }) => {
  const navigation = useNavigation();

  const formatDistance = (meters) => {
    if (!meters) return "Calculating...";
    return meters < 1000
      ? `${Math.round(meters)}m`
      : `${(meters / 1000).toFixed(1)}km`;
  };

  const handleNavigate = () => {
    navigation.navigate("DriverMap", {
      deliveryId: delivery.delivery_id,
      mode: "deliver",
    });
  };

  return (
    <View style={styles.deliveryCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {isFirst ? "🎯 Next Delivery" : `Delivery #${index + 1}`}
        </Text>
        {isFirst && (
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>START</Text>
          </View>
        )}
      </View>

      {/* Customer Info */}
      <View style={styles.stopSection}>
        <View style={styles.stopIcon}>
          <Text style={styles.stopEmoji}>🏠</Text>
        </View>
        <View style={styles.stopDetails}>
          <Text style={styles.stopTitle}>{delivery.name || "Customer"}</Text>
          <Text style={styles.stopAddress}>
            {delivery.delivery_location || "No address"}
          </Text>
          {delivery.customerDistance && (
            <Text style={styles.stopMeta}>
              📍 {formatDistance(delivery.customerDistance)}
            </Text>
          )}
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity style={styles.startButton} onPress={handleNavigate}>
        <Text style={styles.startButtonText}>🚗 Deliver Now</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ActiveDeliveriesScreen({ navigation }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Initialize with cached data for instant display
  const cachedData = useRef(null);
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

  // Refs for location tracking (matching web version)
  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const isFetchingRef = useRef(false);
  const hasFetchedInitialRef = useRef(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initScreen();
    return () => cleanup();
  }, []);

  const initScreen = async () => {
    const role = await AsyncStorage.getItem("role");
    if (role !== "driver") {
      navigation.replace("Login");
      return;
    }

    // Load cached data for instant display (matching web version)
    const cached = await loadCachedData();
    if (cached) {
      cachedData.current = cached;
      setPickups(cached.pickups || []);
      setDeliveries(cached.deliveries || []);
      setMode(cached.mode || "pickup");
      if (cached.driverLocation) setDriverLocation(cached.driverLocation);
      if (cached.fullRouteData) setFullRouteData(cached.fullRouteData);
      setHasFetchedSuccessfully(true);
      setInitialLoading(false);
    }

    // Initial fetch
    await startLocationTracking();
  };

  const cleanup = () => {
    if (watchIdRef.current) {
      watchIdRef.current.remove();
      watchIdRef.current = null;
    }
  };

  // ============================================================================
  // LOCATION TRACKING (Matching web version with watchPosition)
  // ============================================================================

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[LOCATION] Permission denied, using default");
        const defaultLoc = DEFAULT_DRIVER_LOCATION;
        lastLocationRef.current = defaultLoc;
        lastFetchLocationRef.current = defaultLoc;
        setDriverLocation(defaultLoc);
        await fetchPickups(defaultLoc, false);
        hasFetchedInitialRef.current = true;
        return;
      }

      // Get initial position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const loc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      lastLocationRef.current = loc;
      lastFetchLocationRef.current = loc;
      setDriverLocation(loc);
      await fetchPickups(loc, false);
      hasFetchedInitialRef.current = true;

      // Watch position: fires every 3s for smooth live tracking
      // distanceInterval: 0 so marker updates continuously
      watchIdRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LIVE_TRACKING_INTERVAL, // 3 seconds
          distanceInterval: 0, // Always fire for smooth marker updates
        },
        (position) => {
          const newLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Always update driver marker on map (smooth live tracking)
          lastLocationRef.current = newLoc;
          setDriverLocation(newLoc);

          if (!hasFetchedInitialRef.current) {
            hasFetchedInitialRef.current = true;
            lastFetchLocationRef.current = newLoc;
            fetchPickups(newLoc, false);
            return;
          }

          // Only refresh API data when moved 100m+ from last fetch
          const movedSinceFetch = lastFetchLocationRef.current
            ? getDistanceMeters(
                lastFetchLocationRef.current.latitude,
                lastFetchLocationRef.current.longitude,
                newLoc.latitude,
                newLoc.longitude,
              )
            : Infinity;

          if (movedSinceFetch >= DATA_REFRESH_THRESHOLD) {
            // Only trigger API refresh when this tab is focused
            if (!isFocusedRef.current) return;
            console.log(
              `[LOCATION] Moved ${movedSinceFetch.toFixed(0)}m since last fetch (threshold: ${DATA_REFRESH_THRESHOLD}m) → refreshing data`,
            );
            lastFetchLocationRef.current = newLoc;
            fetchPickups(newLoc, true);
          }
        },
      );

      // NO periodic refresh intervals — only movement-based (matching web version)
    } catch (err) {
      console.error("[LOCATION] Error:", err);
      const defaultLoc = DEFAULT_DRIVER_LOCATION;
      lastLocationRef.current = defaultLoc;
      setDriverLocation(defaultLoc);
      await fetchPickups(defaultLoc, false);
    }
  };

  // ============================================================================
  // FETCH DATA (Matching web version logic exactly)
  // ============================================================================

  const fetchPickups = async (location, isBackgroundRefresh = false) => {
    if (isFetchingRef.current && isBackgroundRefresh) return;
    isFetchingRef.current = true;

    try {
      const token = await AsyncStorage.getItem("token");

      if (!location) {
        // Even without location, check for active deliveries (matching web)
        try {
          const fallbackRes = await rateLimitedFetch(
            `${API_BASE_URL}/driver/deliveries/active`,
            { headers: { Authorization: `Bearer ${token}` } },
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
        isFetchingRef.current = false;
        return;
      }

      // Only show skeleton on initial load when no cached data
      if (
        !isBackgroundRefresh &&
        pickups.length === 0 &&
        deliveries.length === 0
      ) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      // Clear previous error on new fetch attempt
      if (!isBackgroundRefresh) {
        setFetchError(null);
      }

      const url = `${API_BASE_URL}/driver/deliveries/pickups?driver_latitude=${location.latitude}&driver_longitude=${location.longitude}`;

      const res = await rateLimitedFetch(url, {
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

          // Build optimized route in background (non-blocking)
          if (!isBackgroundRefresh) {
            buildOptimizedRoute(location, list)
              .then((optimizedData) => {
                setFullRouteData(optimizedData);
              })
              .catch((err) => {
                console.error("Route optimization error:", err);
                // Fallback: build simple route without optimization
                buildRouteFromPickups(location, list);
              });
          }

          // Cache data immediately
          await saveCacheData({
            pickups: list,
            deliveries: [],
            mode: "pickup",
            driverLocation: location,
          });
        } else {
          // No pickups left → check for deliveries to deliver
          await fetchDeliveriesRoute(location, isBackgroundRefresh);
        }
      } else {
        const errorMsg =
          data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
        console.error("Failed to fetch pickups:", errorMsg, data);
        if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
          setFetchError(`Failed to load pickups: ${errorMsg}`);
        }
      }
    } catch (e) {
      console.error("Fetch pickups error:", e);
      if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
        setFetchError(
          `Network error: ${e.message || "Unable to connect to server"}`,
        );
      }
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  // Fetch full route for developer overview
  const fetchFullRoute = async (location, pickupsList) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const url = `${API_BASE_URL}/driver/deliveries/full-route?driver_latitude=${location.latitude}&driver_longitude=${location.longitude}`;

      const res = await rateLimitedFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        console.log("📍 [FULL ROUTE] Received full route data:", data);
        setFullRouteData(data);
      } else {
        // If endpoint doesn't exist, build route data from pickups
        console.log("📍 [FULL ROUTE] Building route from pickups data");
        buildRouteFromPickups(location, pickupsList);
      }
    } catch (e) {
      console.error("Fetch full route error:", e);
      buildRouteFromPickups(location, pickupsList);
    }
  };

  // Build route data from pickups when full-route endpoint isn't available
  const buildRouteFromPickups = (location, pickupsList) => {
    const restaurants = pickupsList.map((p, idx) => ({
      id: p.delivery_id,
      order_number: p.order_number,
      lat: parseFloat(p.restaurant.latitude),
      lng: parseFloat(p.restaurant.longitude),
      name: p.restaurant.name,
      address: p.restaurant.address,
      label: `R${idx + 1}`,
    }));

    const customers = pickupsList.map((p, idx) => ({
      id: p.delivery_id,
      order_number: p.order_number,
      lat: parseFloat(p.customer.latitude),
      lng: parseFloat(p.customer.longitude),
      name: p.customer.name,
      address: p.customer.address,
      label: `C${idx + 1}`,
    }));

    setFullRouteData({
      driver_location: location,
      restaurants,
      customers,
      total_deliveries: pickupsList.length,
    });
  };

  const fetchDeliveriesRoute = async (
    location,
    isBackgroundRefresh = false,
  ) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const url = `${API_BASE_URL}/driver/deliveries/deliveries-route?driver_latitude=${location.latitude}&driver_longitude=${location.longitude}`;

      const res = await rateLimitedFetch(url, {
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
        });

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
              },
            );
            // Optimistically reflect status
            setDeliveries((prev) =>
              prev.map((d, i) =>
                i === 0 ? { ...d, status: "on_the_way" } : d,
              ),
            );
          } catch (err) {
            console.error("Failed to auto-set first delivery on-the-way:", err);
          }
        }
      } else {
        const errorMsg =
          data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
        console.error("Failed to fetch deliveries route:", errorMsg, data);
        if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
          setFetchError(`Failed to load deliveries: ${errorMsg}`);
        }
      }
    } catch (e) {
      console.error("Fetch deliveries route error:", e);
      if (!isBackgroundRefresh && !hasFetchedSuccessfully) {
        setFetchError(
          `Network error: ${e.message || "Unable to connect to server"}`,
        );
      }
    }
  };

  // ============================================================================
  // ROUTE OPTIMIZATION (Using OSRM for real driving distances)
  // ============================================================================

  const getOptimizedRestaurantOrderByShortest = async (
    pickupsList,
    driverLoc,
  ) => {
    if (pickupsList.length <= 1) return pickupsList;

    console.log(
      `📍 [SMART ROUTE] Analyzing ${pickupsList.length} deliveries via OSRM...`,
    );

    const enriched = await Promise.all(
      pickupsList.map(async (pickup) => {
        const [distToCustomer, distFromDriver] = await Promise.all([
          getOSRMDistance(
            parseFloat(pickup.restaurant.latitude),
            parseFloat(pickup.restaurant.longitude),
            parseFloat(pickup.customer.latitude),
            parseFloat(pickup.customer.longitude),
          ),
          getOSRMDistance(
            driverLoc.latitude,
            driverLoc.longitude,
            parseFloat(pickup.restaurant.latitude),
            parseFloat(pickup.restaurant.longitude),
          ),
        ]);

        return {
          ...pickup,
          distToOwnCustomer: distToCustomer ?? Infinity,
          distFromDriver: distFromDriver ?? Infinity,
        };
      }),
    );

    // Sort: restaurant with largest total trip first (far customers first)
    const sorted = [...enriched].sort((a, b) => {
      const totalA = a.distFromDriver + a.distToOwnCustomer;
      const totalB = b.distFromDriver + b.distToOwnCustomer;
      return totalB - totalA;
    });

    console.log(`📍 [SMART ROUTE] Pickup order (OSRM):`);
    sorted.forEach((item, idx) => {
      console.log(
        `📍 [SMART ROUTE]   ${idx + 1}. ${item.restaurant.name} → ${item.customer.name} (${(item.distToOwnCustomer / 1000).toFixed(2)} km to customer)`,
      );
    });

    return sorted;
  };

  const getOptimizedCustomerOrderByShortest = async (pickupsList) => {
    if (pickupsList.length <= 1) return pickupsList;

    const lastRestaurant = pickupsList[pickupsList.length - 1].restaurant;
    const remaining = [...pickupsList];
    const ordered = [];
    let currentLat = parseFloat(lastRestaurant.latitude);
    let currentLng = parseFloat(lastRestaurant.longitude);

    console.log(
      `📍 [SMART ROUTE] Delivery order via OSRM (starting from: ${lastRestaurant.name}):`,
    );

    while (remaining.length > 0) {
      const distances = await Promise.all(
        remaining.map(async (pickup) => {
          const dist = await getOSRMDistance(
            currentLat,
            currentLng,
            parseFloat(pickup.customer.latitude),
            parseFloat(pickup.customer.longitude),
          );
          return dist ?? Infinity;
        }),
      );

      let nearestIdx = 0;
      let nearestDist = distances[0];
      for (let i = 1; i < distances.length; i++) {
        if (distances[i] < nearestDist) {
          nearestDist = distances[i];
          nearestIdx = i;
        }
      }

      const nearest = remaining[nearestIdx];
      ordered.push(nearest);

      console.log(
        `📍 [SMART ROUTE]   C${ordered.length}. ${nearest.customer.name} (${(nearestDist / 1000).toFixed(2)} km from current)`,
      );

      currentLat = parseFloat(nearest.customer.latitude);
      currentLng = parseFloat(nearest.customer.longitude);
      remaining.splice(nearestIdx, 1);
    }

    return ordered;
  };

  const buildOptimizedRoute = async (driverLoc, pickupsList) => {
    // STEP 1: Optimize restaurant order using OSRM
    const optimizedRestaurants = await getOptimizedRestaurantOrderByShortest(
      pickupsList,
      driverLoc,
    );

    // STEP 2: Optimize customer delivery order using OSRM
    const optimizedCustomers =
      await getOptimizedCustomerOrderByShortest(optimizedRestaurants);

    console.log(`📍 [FULL ROUTE] ═══════════════════════════════════════════`);
    console.log(`📍 [FULL ROUTE] SMART ROUTE OPTIMIZED ORDER:`);
    console.log(
      `📍 [FULL ROUTE]   Restaurants: ${optimizedRestaurants.map((p) => p.restaurant.name).join(" → ")}`,
    );
    console.log(
      `📍 [FULL ROUTE]   Customers: ${optimizedCustomers.map((p) => p.customer.name).join(" → ")}`,
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

  const fetchWithLocation = useCallback(
    async (isBackgroundRefresh = false) => {
      if (isFetchingRef.current && isBackgroundRefresh) return;

      const location = lastLocationRef.current || driverLocation;
      if (location) {
        await fetchPickups(location, isBackgroundRefresh);
      } else {
        await startLocationTracking();
      }
    },
    [driverLocation],
  );

  const onRefresh = useCallback(() => {
    fetchWithLocation(true);
  }, [fetchWithLocation]);

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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Active Deliveries</Text>
              {isRefreshing && (
                <View style={styles.headerSpinner}>
                  <ActivityIndicator size="small" color="#06C168" />
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {mode === "pickup"
                ? `${pickups.length} pickup${pickups.length !== 1 ? "s" : ""} ready`
                : `${deliveries.length} deliver${deliveries.length !== 1 ? "ies" : "y"} ready`}
            </Text>
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
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
            <Text style={styles.findDeliveriesBtnText}>
              View Available Deliveries
            </Text>
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
              tintColor="#06C168"
              colors={["#06C168"]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Pickup/Delivery Cards List */}
          {mode === "pickup" && pickups.length > 0 && (
            <View style={styles.deliveryCardsContainer}>
              {pickups.map((pickup, idx) => (
                <PickupCard
                  key={pickup.delivery_id}
                  pickup={pickup}
                  index={idx}
                  isFirst={idx === 0}
                  driverLocation={driverLocation}
                />
              ))}
            </View>
          )}

          {mode === "deliver" && deliveries.length > 0 && (
            <View style={styles.deliveryCardsContainer}>
              {deliveries.map((delivery, idx) => (
                <DeliveryCard
                  key={delivery.delivery_id}
                  delivery={delivery}
                  index={idx}
                  isFirst={idx === 0}
                  driverLocation={driverLocation}
                />
              ))}
            </View>
          )}

          {/* Full Route Overview Map (optional, loads after optimization) */}
          {mode === "pickup" && pickups.length > 1 && fullRouteData && (
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
// FULL ROUTE MAP COMPONENT (Matching web version exactly)
// ============================================================================

function FullRouteMap({ driverLocation, pickups, fullRouteData }) {
  const mapRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [optimizedRestaurantOrder, setOptimizedRestaurantOrder] = useState([]);
  const [optimizedCustomerOrder, setOptimizedCustomerOrder] = useState([]);
  const hasFetchedDirections = useRef(false);

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
      allCoordinates.reduce((sum, c) => sum + c.latitude, 0) /
      allCoordinates.length;
    const avgLng =
      allCoordinates.reduce((sum, c) => sum + c.longitude, 0) /
      allCoordinates.length;
    return { latitude: avgLat, longitude: avgLng };
  };

  // Optimize routes using OSRM (matching web version)
  const optimizeRoutes = useCallback(async () => {
    if (hasFetchedDirections.current) return;
    if (!driverLocation || pickups.length === 0) return;

    hasFetchedDirections.current = true;

    // STEP 1: Optimize restaurant order
    const optimizedRestaurants = await getOptimizedRestaurantOrderByShortest(
      pickups,
      driverLocation,
    );
    setOptimizedRestaurantOrder(optimizedRestaurants);

    // STEP 2: Optimize customer delivery order
    const optimizedCustomers =
      await getOptimizedCustomerOrderByShortest(optimizedRestaurants);
    setOptimizedCustomerOrder(optimizedCustomers);

    console.log(`📍 [FULL ROUTE] ═══════════════════════════════════════════`);
    console.log(`📍 [FULL ROUTE] SMART ROUTE OPTIMIZED ORDER:`);
    console.log(
      `📍 [FULL ROUTE]   Restaurants: ${optimizedRestaurants.map((p) => p.restaurant.name).join(" → ")}`,
    );
    console.log(
      `📍 [FULL ROUTE]   Customers: ${optimizedCustomers.map((p) => p.customer.name).join(" → ")}`,
    );
    console.log(`📍 [FULL ROUTE] ═══════════════════════════════════════════`);

    // Build waypoints for segment-by-segment routing
    const waypoints = [
      { lat: driverLocation.latitude, lng: driverLocation.longitude },
      ...optimizedRestaurants.map((p) => ({
        lat: parseFloat(p.restaurant.latitude),
        lng: parseFloat(p.restaurant.longitude),
      })),
      ...optimizedCustomers.map((p) => ({
        lat: parseFloat(p.customer.latitude),
        lng: parseFloat(p.customer.longitude),
      })),
    ];

    // Fetch segment-by-segment route (matching web version)
    await fetchSegmentBySegmentRoute(waypoints);
  }, [driverLocation, pickups]);

  // Helper function for getting OSRM distance
  const getOSRMDistance = async (lat1, lng1, lat2, lng2) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const url = `https://router.project-osrm.org/route/v1/foot/${lng1},${lat1};${lng2},${lat2}?overview=false`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.code === "Ok" && data.routes?.[0]) {
        return data.routes[0].distance;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Optimize restaurant pickup order
  const getOptimizedRestaurantOrderByShortest = async (
    pickupsList,
    driverLoc,
  ) => {
    if (pickupsList.length <= 1) return pickupsList;

    const enriched = await Promise.all(
      pickupsList.map(async (pickup) => {
        const [distToCustomer, distFromDriver] = await Promise.all([
          getOSRMDistance(
            parseFloat(pickup.restaurant.latitude),
            parseFloat(pickup.restaurant.longitude),
            parseFloat(pickup.customer.latitude),
            parseFloat(pickup.customer.longitude),
          ),
          getOSRMDistance(
            driverLoc.latitude,
            driverLoc.longitude,
            parseFloat(pickup.restaurant.latitude),
            parseFloat(pickup.restaurant.longitude),
          ),
        ]);

        return {
          ...pickup,
          distToOwnCustomer: distToCustomer ?? Infinity,
          distFromDriver: distFromDriver ?? Infinity,
        };
      }),
    );

    const sorted = [...enriched].sort((a, b) => {
      const totalA = a.distFromDriver + a.distToOwnCustomer;
      const totalB = b.distFromDriver + b.distToOwnCustomer;
      return totalB - totalA;
    });

    return sorted;
  };

  // Optimize customer delivery order
  const getOptimizedCustomerOrderByShortest = async (pickupsList) => {
    if (pickupsList.length <= 1) return pickupsList;

    const lastRestaurant = pickupsList[pickupsList.length - 1].restaurant;
    const remaining = [...pickupsList];
    const ordered = [];
    let currentLat = parseFloat(lastRestaurant.latitude);
    let currentLng = parseFloat(lastRestaurant.longitude);

    while (remaining.length > 0) {
      const distances = await Promise.all(
        remaining.map(async (pickup) => {
          const dist = await getOSRMDistance(
            currentLat,
            currentLng,
            parseFloat(pickup.customer.latitude),
            parseFloat(pickup.customer.longitude),
          );
          return dist ?? Infinity;
        }),
      );

      let nearestIdx = 0;
      let nearestDist = distances[0];
      for (let i = 1; i < distances.length; i++) {
        if (distances[i] < nearestDist) {
          nearestDist = distances[i];
          nearestIdx = i;
        }
      }

      const nearest = remaining[nearestIdx];
      ordered.push(nearest);

      currentLat = parseFloat(nearest.customer.latitude);
      currentLng = parseFloat(nearest.customer.longitude);
      remaining.splice(nearestIdx, 1);
    }

    return ordered;
  };

  // Fetch segment-by-segment route (matching web version exactly)
  const fetchSegmentBySegmentRoute = async (waypoints) => {
    try {
      console.log(
        `📍 [SEGMENT ROUTE] Starting segment-by-segment route calculation...`,
      );
      console.log(`📍 [SEGMENT ROUTE] Total waypoints: ${waypoints.length}`);

      const allRouteSegments = [];
      let totalDistance = 0;
      let totalDuration = 0;

      // Fetch each segment individually
      for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to = waypoints[i + 1];

        const segmentUrl = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;

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
              `📍 [SEGMENT ${i + 1}/${waypoints.length - 1}] ✓ ${(route.distance / 1000).toFixed(2)} km, ${Math.ceil(route.duration / 60)} min`,
            );
          } else {
            console.warn(
              `📍 [SEGMENT ${i + 1}] Failed to get route, using straight line`,
            );
            allRouteSegments.push({ latitude: from.lat, longitude: from.lng });
            allRouteSegments.push({ latitude: to.lat, longitude: to.lng });
          }

          // Small delay between requests to avoid rate limiting
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
          optimizedRestaurants: optimizedRestaurantOrder,
          optimizedCustomers: optimizedCustomerOrder,
          selectedMode: "OSRM_FOOT_SEGMENTS",
        });

        console.log(
          "📍 [SEGMENT ROUTE] ═══════════════════════════════════════════",
        );
        console.log("📍 [SEGMENT ROUTE] Route calculation complete:");
        console.log(
          `📍 [SEGMENT ROUTE]   Total distance: ${(totalDistance / 1000).toFixed(2)} km`,
        );
        console.log(
          `📍 [SEGMENT ROUTE]   Total duration: ${Math.ceil(totalDuration / 60)} min`,
        );
        console.log(
          `📍 [SEGMENT ROUTE]   Path points: ${allRouteSegments.length}`,
        );
        console.log(
          "📍 [SEGMENT ROUTE] ═══════════════════════════════════════════",
        );
      }
    } catch (error) {
      console.error("Failed to fetch segment routes:", error);
    }
  };

  // Reset when pickups change
  useEffect(() => {
    hasFetchedDirections.current = false;
  }, [pickups.length]);

  // Trigger route optimization
  useEffect(() => {
    if (driverLocation && pickups.length > 0 && !hasFetchedDirections.current) {
      optimizeRoutes();
    }
  }, [driverLocation, pickups, optimizeRoutes]);

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

  const restOrder =
    optimizedRestaurantOrder.length > 0 ? optimizedRestaurantOrder : pickups;
  const custOrder =
    optimizedCustomerOrder.length > 0 ? optimizedCustomerOrder : pickups;

  // Open Google Maps with navigation to coordinates
  const openGoogleMaps = (latitude, longitude, label) => {
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${latitude},${longitude}`;
    const labelEncoded = encodeURIComponent(label);
    const url = Platform.select({
      ios: `${scheme}${latLng}(${labelEncoded})`,
      android: `${scheme}${latLng}(${labelEncoded})`,
    });

    Linking.openURL(url).catch((err) => {
      // Fallback to web Google Maps if native app fails
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;
      Linking.openURL(webUrl);
    });
  };

  return (
    <View style={styles.fullRouteCard}>
      {/* Header */}
      <View style={styles.fullRouteHeader}>
        <Text style={styles.fullRouteTitle}>🗺️ Full Route Overview</Text>
        <Text style={styles.fullRouteSubtitle}>
          Driver → {pickups.length} Restaurant{pickups.length > 1 ? "s" : ""} →{" "}
          {pickups.length} Customer{pickups.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Stats */}
      {routeInfo && (
        <View style={styles.fullRouteStats}>
          <View style={styles.fullRouteStat}>
            <Text style={styles.fullRouteStatValue}>
              {routeInfo.totalDistance}
            </Text>
            <Text style={styles.fullRouteStatLabel}>km Total</Text>
          </View>
          <View style={styles.fullRouteStat}>
            <Text style={styles.fullRouteStatValue}>
              {routeInfo.totalDuration}
            </Text>
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
        <FreeMapView
          ref={mapRef}
          style={styles.fullRouteMap}
          initialRegion={{
            ...getCenter(),
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
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
                    emoji: "🚗",
                    title: "D",
                  },
                ]
              : []),
            ...restOrder
              .filter((p) => p.restaurant)
              .map((pickup, idx) => ({
                id: `r-${pickup.delivery_id}`,
                coordinate: {
                  latitude: parseFloat(pickup.restaurant.latitude),
                  longitude: parseFloat(pickup.restaurant.longitude),
                },
                type: "restaurant",
                emoji: "🏪",
                title: `R${idx + 1}`,
              })),
            ...custOrder
              .filter((p) => p.customer)
              .map((pickup, idx) => ({
                id: `c-${pickup.delivery_id}`,
                coordinate: {
                  latitude: parseFloat(pickup.customer.latitude),
                  longitude: parseFloat(pickup.customer.longitude),
                },
                type: "customer",
                emoji: "📍",
                title: `C${idx + 1}`,
              })),
          ]}
          polylines={
            routePath.length > 1
              ? [
                  {
                    id: "route",
                    coordinates: routePath,
                    strokeColor: MARKER_COLORS.route,
                    strokeWidth: 5,
                  },
                ]
              : []
          }
        />
      </View>

      {/* Start Navigation Button */}
      {restOrder.length > 0 && (
        <View style={styles.startNavigationContainer}>
          <Pressable
            style={styles.startNavigationBtn}
            onPress={() => {
              const firstStop = restOrder[0];
              openGoogleMaps(
                parseFloat(firstStop.restaurant.latitude),
                parseFloat(firstStop.restaurant.longitude),
                firstStop.restaurant.name,
              );
            }}
          >
            <Text style={styles.startNavigationIcon}>🧭</Text>
            <Text style={styles.startNavigationText}>
              Start Navigation to First Stop
            </Text>
          </Pressable>
        </View>
      )}

      {/* Ordered Stops List (matching web version) */}
      {routeInfo &&
        routeInfo.optimizedRestaurants &&
        routeInfo.optimizedCustomers && (
          <View style={styles.stopsContainer}>
            <Text style={styles.stopsTitle}>📋 Ordered Stops</Text>

            {/* Driver Starting Point */}
            <View style={[styles.stopItem, styles.stopItemDriver]}>
              <View
                style={[
                  styles.stopMarker,
                  { backgroundColor: MARKER_COLORS.driver },
                ]}
              >
                <Text style={styles.stopMarkerText}>D</Text>
              </View>
              <View style={styles.stopContent}>
                <Text style={styles.stopName}>
                  Your Location (Starting Point)
                </Text>
                <Text style={styles.stopAddress}>Driver Position</Text>
              </View>
            </View>

            {/* Restaurant Pickups */}
            {routeInfo.optimizedRestaurants.map((pickup, idx) => (
              <View
                key={`stop-r-${idx}`}
                style={[styles.stopItem, styles.stopItemRestaurant]}
              >
                <View
                  style={[
                    styles.stopMarker,
                    { backgroundColor: MARKER_COLORS.restaurant },
                  ]}
                >
                  <Text style={styles.stopMarkerText}>R{idx + 1}</Text>
                </View>
                <View style={styles.stopContent}>
                  <Text style={styles.stopName}>
                    🍽️ {pickup.restaurant?.name}
                  </Text>
                  <Text style={styles.stopAddress}>
                    {pickup.restaurant?.address}
                  </Text>
                  <Text style={styles.stopOrder}>
                    Order #{pickup.order_number}
                  </Text>
                </View>
                <Pressable
                  style={styles.navigateBtn}
                  onPress={() =>
                    openGoogleMaps(
                      parseFloat(pickup.restaurant.latitude),
                      parseFloat(pickup.restaurant.longitude),
                      pickup.restaurant.name,
                    )
                  }
                >
                  <Text style={styles.navigateBtnIcon}>🧭</Text>
                </Pressable>
              </View>
            ))}

            {/* Customer Deliveries */}
            {routeInfo.optimizedCustomers.map((pickup, idx) => (
              <View
                key={`stop-c-${idx}`}
                style={[styles.stopItem, styles.stopItemCustomer]}
              >
                <View
                  style={[
                    styles.stopMarker,
                    { backgroundColor: MARKER_COLORS.customer },
                  ]}
                >
                  <Text style={styles.stopMarkerText}>C{idx + 1}</Text>
                </View>
                <View style={styles.stopContent}>
                  <Text style={styles.stopName}>
                    👤 {pickup.customer?.name}
                  </Text>
                  <Text style={styles.stopAddress}>
                    {pickup.customer?.address}
                  </Text>
                  <Text style={styles.stopOrder}>
                    Order #{pickup.order_number}
                  </Text>
                </View>
                <Pressable
                  style={styles.navigateBtn}
                  onPress={() =>
                    openGoogleMaps(
                      parseFloat(pickup.customer.latitude),
                      parseFloat(pickup.customer.longitude),
                      pickup.customer.name,
                    )
                  }
                >
                  <Text style={styles.navigateBtnIcon}>🧭</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

      {/* Legend (matching web version) */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: MARKER_COLORS.driver },
            ]}
          />
          <Text style={styles.legendText}>Driver (D)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: MARKER_COLORS.restaurant },
            ]}
          />
          <Text style={styles.legendText}>Restaurant (R)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: MARKER_COLORS.customer },
            ]}
          />
          <Text style={styles.legendText}>Customer (C)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendLine,
              { backgroundColor: MARKER_COLORS.route },
            ]}
          />
          <Text style={styles.legendText}>Route Path</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// SKELETON CARD COMPONENT (Matching web version with shimmer)
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
      ]),
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
              style={[
                styles.skeletonLine,
                { width: 120, opacity: shimmerOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.skeletonLine,
                { width: 180, marginTop: 6, opacity: shimmerOpacity },
              ]}
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
        <Animated.View
          style={[styles.skeletonButton, { opacity: shimmerOpacity }]}
        />
      </View>
    </View>
  );
}

// ============================================================================
// STYLES (Matching web version design)
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
    backgroundColor: "#06C168",
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
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  headerSpinner: {
    width: 16,
    height: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
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

  // Empty State (matching web version)
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
    backgroundColor: "#06C168",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  findDeliveriesBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Error State (matching web version)
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

  // Fixed Bottom (matching web version)
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
    backgroundColor: "#06C168",
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
  // FULL ROUTE MAP STYLES (Matching web version)
  // ============================================================================

  fullRouteCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#06C168",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fullRouteHeader: {
    backgroundColor: "#06C168",
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
    backgroundColor: "#E6F9EE",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#B8F0D0",
  },
  fullRouteStat: {
    flex: 1,
    alignItems: "center",
  },
  fullRouteStatValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#06C168",
  },
  fullRouteStatLabel: {
    fontSize: 12,
    color: "#046B4D",
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

  // Stops List (matching web version)
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
    backgroundColor: "#E6F9EE",
    borderWidth: 1,
    borderColor: "#86E5AF",
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
  navigateBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  navigateBtnIcon: {
    fontSize: 22,
  },

  // Start Navigation Button
  startNavigationContainer: {
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  startNavigationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  startNavigationIcon: {
    fontSize: 20,
  },
  startNavigationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Legend (matching web version)
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
  // SKELETON STYLES (Matching web version with shimmer)
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
    backgroundColor: "#86E5AF",
    borderRadius: 14,
  },

  // =========== DELIVERY CARD STYLES ===========
  deliveryCardsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  deliveryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  nextBadge: {
    backgroundColor: "#06C168",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nextBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stopSection: {
    flexDirection: "row",
    marginBottom: 14,
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stopEmoji: {
    fontSize: 20,
  },
  stopDetails: {
    flex: 1,
  },
  stopTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  stopAddress: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  stopMeta: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  startButton: {
    backgroundColor: "#06C168",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
