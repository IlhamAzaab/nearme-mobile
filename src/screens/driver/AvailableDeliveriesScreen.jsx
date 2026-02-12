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
  Dimensions,
  Alert,
  FlatList,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { API_BASE_URL } from "../../constants/api";
import { getOSRMRoute, haversineDistance } from "../../services/mapService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = "available_deliveries_cache";
const CACHE_EXPIRY = 60000; // 1 minute cache
const MOVEMENT_THRESHOLD_METERS = 50; // Minimum distance to trigger refresh
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds
const SAFETY_REFRESH_INTERVAL = 60000; // 60 second fallback

// Default driver location (Kinniya, Sri Lanka)
const DEFAULT_DRIVER_LOCATION = {
  latitude: 8.5017,
  longitude: 81.186,
};

// Carto Voyager tiles (FREE - no API key needed)
const CARTO_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png";

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
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn("Cache save error:", e);
  }
};

// ============================================================================
// HAVERSINE DISTANCE CALCULATION
// ============================================================================

const calculateDistance = (lat1, lng1, lat2, lng2) => {
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
// MAIN COMPONENT
// ============================================================================

export default function AvailableDeliveriesScreen({ navigation }) {
  // Initialize with cached data for instant display
  const [deliveries, setDeliveries] = useState([]);
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasCompletedFirstFetch, setHasCompletedFirstFetch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [driverLocation, setDriverLocation] = useState(DEFAULT_DRIVER_LOCATION);
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

  // Refs
  const flatListRef = useRef(null);
  const abortControllerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const dataFetchIntervalRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const fetchPendingDeliveriesRef = useRef(null);
  const locationSubscriptionRef = useRef(null);

  // Animation for toast
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
      setDeliveries(cached.deliveries || []);
      setCurrentRoute(cached.currentRoute || { total_stops: 0, active_deliveries: 0 });
      if (cached.driverLocation) setDriverLocation(cached.driverLocation);
      setHasCompletedFirstFetch(true);
      setInitialLoading(false);
    }

    // Check if driver is in delivering mode
    await checkDeliveringMode();

    // Get initial location and fetch deliveries
    const location = await getLocation();
    setDriverLocation(location);
    lastFetchLocationRef.current = location;
    await fetchPendingDeliveriesWithLocation(location, !cached);

    // Start location tracking every 3 seconds
    startLocationTracking();

    // Safety fallback refresh every 60 seconds
    dataFetchIntervalRef.current = setInterval(() => {
      console.log("[DATA REFRESH] Safety fallback check (60s interval)...");
      fetchDeliveriesWithCurrentLocation(true);
    }, SAFETY_REFRESH_INTERVAL);
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

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      // Watch position changes
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 10, // Update if moved 10 meters
        },
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          setDriverLocation(location);

          // Check if driver moved significantly since last API fetch
          if (lastFetchLocationRef.current) {
            const distanceMoved = calculateDistance(
              lastFetchLocationRef.current.latitude,
              lastFetchLocationRef.current.longitude,
              location.latitude,
              location.longitude
            );

            if (distanceMoved >= MOVEMENT_THRESHOLD_METERS) {
              console.log(
                `[LOCATION] 🚗 Driver moved ${distanceMoved.toFixed(0)}m (threshold: ${MOVEMENT_THRESHOLD_METERS}m) - Triggering refresh`
              );
              lastFetchLocationRef.current = location;
              if (fetchPendingDeliveriesRef.current) {
                fetchPendingDeliveriesRef.current(location, true);
              }
            }
          }
        }
      );
    } catch (err) {
      console.error("[LOCATION] Watch error:", err);
      // Fallback to interval-based updates
      locationIntervalRef.current = setInterval(async () => {
        const location = await getLocation();
        setDriverLocation(location);
      }, LOCATION_UPDATE_INTERVAL);
    }
  };

  const fetchDeliveriesWithCurrentLocation = useCallback(
    async (isBackgroundRefresh = false) => {
      const location = await getLocation();
      setDriverLocation(location);
      lastFetchLocationRef.current = location;
      await fetchPendingDeliveriesWithLocation(location, isBackgroundRefresh);
    },
    []
  );

  // ============================================================================
  // CHECK DELIVERING MODE
  // ============================================================================

  const checkDeliveringMode = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const currentLoc = driverLocation || DEFAULT_DRIVER_LOCATION;

      const res = await fetch(
        `${API_BASE_URL}/driver/deliveries/pickups?driver_latitude=${currentLoc.latitude}&driver_longitude=${currentLoc.longitude}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (!data.pickups || data.pickups.length === 0) {
          const activeRes = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (activeRes.ok) {
            const activeData = await activeRes.json();
            const hasDeliveringOrders = activeData.deliveries?.some((d) =>
              ["picked_up", "on_the_way", "at_customer"].includes(d.status)
            );
            if (hasDeliveringOrders) {
              setInDeliveringMode(true);
              setTimeout(() => navigation.navigate("Active"), 100);
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
    showLoading = true
  ) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (!hasCompletedFirstFetch && showLoading) {
        setInitialLoading(true);
      } else if (!showLoading) {
        setIsRefreshing(true);
      }

      const token = await AsyncStorage.getItem("token");
      const currentLoc = location || DEFAULT_DRIVER_LOCATION;

      const url = `${API_BASE_URL}/driver/deliveries/available/v2?driver_latitude=${currentLoc.latitude}&driver_longitude=${currentLoc.longitude}`;

      console.log("[FETCH] Requesting available deliveries from:", url);

      const res = await fetch(url, {
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
      setDeliveries(deliveriesArray);

      const newCurrentRoute = data.current_route || {
        total_stops: 0,
        active_deliveries: 0,
      };
      setCurrentRoute(newCurrentRoute);

      const newDriverLocation = data.driver_location || currentLoc;
      setDriverLocation(newDriverLocation);

      // Save to cache
      await saveCacheData({
        deliveries: deliveriesArray,
        currentRoute: newCurrentRoute,
        driverLocation: newDriverLocation,
      });

      setFetchError(null);
      setHasCompletedFirstFetch(true);
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
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  // Store fetch function in ref
  fetchPendingDeliveriesRef.current = fetchPendingDeliveriesWithLocation;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleAcceptDelivery = async (deliveryId) => {
    setAccepting(deliveryId);
    try {
      const token = await AsyncStorage.getItem("token");
      const delivery = deliveries.find((d) => d.delivery_id === deliveryId);

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
        }
      );

      const data = await res.json();

      if (res.ok) {
        showToast("✅ Delivery accepted!");

        // Clear ALL deliveries immediately
        setDeliveries([]);
        setIsLoadingAfterAccept(true);

        // Fetch updated deliveries
        setTimeout(async () => {
          await fetchPendingDeliveriesWithLocation(driverLocation, false);
          setIsLoadingAfterAccept(false);
        }, 500);
      } else {
        showToast(data.message || "Failed to accept delivery", "error");
      }
    } catch (e) {
      console.error("Accept error:", e);
      showToast("Failed to accept delivery", "error");
    } finally {
      setAccepting(null);
    }
  };

  const handleDecline = (deliveryId) => {
    setDeclinedIds((prev) => new Set([...prev, deliveryId]));

    // Scroll to top
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
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
    fetchDeliveriesWithCurrentLocation(true);
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Sort deliveries: non-declined first, then declined
  const sortedDeliveries = useMemo(() => {
    const nonDeclined = deliveries.filter((d) => !declinedIds.has(d.delivery_id));
    const declined = deliveries.filter((d) => declinedIds.has(d.delivery_id));
    return [...nonDeclined, ...declined];
  }, [deliveries, declinedIds]);

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
        accepting={accepting === item.delivery_id}
        onAccept={handleAcceptDelivery}
        onDecline={handleDecline}
        hasActiveDeliveries={currentRoute.active_deliveries > 0}
        isFirstDelivery={isFirstNonDeclined}
        isDeclined={isDeclined}
      />
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

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

      {/* WebSocket Status Indicator */}
      <View
        style={[
          styles.socketIndicator,
          isSocketConnected ? styles.socketConnected : styles.socketDisconnected,
        ]}
      >
        <View
          style={[
            styles.socketDot,
            isSocketConnected ? styles.socketDotConnected : styles.socketDotDisconnected,
          ]}
        />
        <Text style={styles.socketText}>
          {isSocketConnected ? "Live" : "Offline"}
        </Text>
      </View>

      {/* Error Banner */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {fetchError}</Text>
          <Pressable onPress={() => fetchDeliveriesWithCurrentLocation(false)}>
            <Text style={styles.errorRetry}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable
            style={styles.backBtn}
            onPress={() => navigation.navigate("Active")}
          >
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>New Delivery Request</Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubtitle}>
                {deliveries.length} available
              </Text>
              {isRefreshing && (
                <ActivityIndicator
                  size="small"
                  color="#13ec37"
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
          </View>
          {currentRoute.active_deliveries > 0 && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                {currentRoute.active_deliveries} Active
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Content */}
      {inDeliveringMode ? (
        <View style={styles.deliveringContainer}>
          <Text style={styles.deliveringEmoji}>🚗</Text>
          <Text style={styles.deliveringTitle}>Currently Delivering</Text>
          <Text style={styles.deliveringSubtitle}>
            Complete current deliveries first
          </Text>
          <Pressable
            style={styles.goToActiveBtn}
            onPress={() => navigation.navigate("Active")}
          >
            <Text style={styles.goToActiveBtnText}>Go to Active Deliveries</Text>
          </Pressable>
        </View>
      ) : initialLoading || !hasCompletedFirstFetch || isLoadingAfterAccept ? (
        <ScrollView style={styles.loadingContainer}>
          <SkeletonCard withHeartbeat={isLoadingAfterAccept} />
          <SkeletonCard withHeartbeat={isLoadingAfterAccept} />
          <SkeletonCard withHeartbeat={isLoadingAfterAccept} />
          {isLoadingAfterAccept && (
            <Text style={styles.loadingText}>Loading available deliveries...</Text>
          )}
        </ScrollView>
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
                setIsLoadingAfterAccept(true);
                fetchPendingDeliveriesWithLocation(driverLocation, false).finally(
                  () => setIsLoadingAfterAccept(false)
                );
              }}
            >
              <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
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
        <FlatList
          ref={flatListRef}
          data={sortedDeliveries}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.delivery_id.toString()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#13ec37"
              colors={["#13ec37"]}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Bottom Navigation */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomNav}>
        <View style={styles.bottomNavContent}>
          <Pressable
            style={styles.navItem}
            onPress={() => navigation.navigate("Dashboard")}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={styles.navLabel}>Home</Text>
          </Pressable>
          <Pressable style={[styles.navItem, styles.navItemActive]}>
            <Text style={styles.navIcon}>📋</Text>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Orders</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => navigation.navigate("Active")}
          >
            <View style={styles.navIconWrap}>
              <Text style={styles.navIcon}>📍</Text>
              {currentRoute.active_deliveries > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>
                    {currentRoute.active_deliveries}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.navLabel}>Active</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => navigation.navigate("Profile")}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={styles.navLabel}>Profile</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ============================================================================
// DELIVERY CARD COMPONENT
// ============================================================================

function DeliveryCard({
  delivery,
  driverLocation,
  accepting,
  onAccept,
  onDecline,
  hasActiveDeliveries,
  isFirstDelivery = false,
  isDeclined = false,
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
  const totalItems = order_items.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
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

  const restaurantToCustomerPath = restaurant_to_customer_route?.encoded_polyline
    ? decodePolyline(restaurant_to_customer_route.encoded_polyline)
    : restaurant_to_customer_route?.coordinates?.map((coord) => ({
        latitude: coord[1],
        longitude: coord[0],
      })) || [];

  const hasPolylineData =
    driverToRestaurantPath.length > 0 || restaurantToCustomerPath.length > 0;

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
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      { latitude: parseFloat(restaurant.latitude), longitude: parseFloat(restaurant.longitude) }
    );
  }, [driverLocation, restaurant, generateCurvedPath]);

  const restaurantToCustomerCurved = useMemo(() => {
    if (!restaurant || !customer) return [];
    return generateCurvedPath(
      { latitude: parseFloat(restaurant.latitude), longitude: parseFloat(restaurant.longitude) },
      { latitude: parseFloat(customer.latitude), longitude: parseFloat(customer.longitude) }
    );
  }, [restaurant, customer, generateCurvedPath]);

  // Fit map to markers
  useEffect(() => {
    if (mapRef.current && restaurant && customer) {
      const coordinates = [];
      if (driverLocation) {
        coordinates.push({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        });
      }
      coordinates.push({
        latitude: parseFloat(restaurant.latitude),
        longitude: parseFloat(restaurant.longitude),
      });
      coordinates.push({
        latitude: parseFloat(customer.latitude),
        longitude: parseFloat(customer.longitude),
      });

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
          animated: true,
        });
      }, 300);
    }
  }, [restaurant, customer, driverLocation]);

  return (
    <View
      style={[
        styles.card,
        isDeclined && styles.cardDeclined,
        !can_accept && styles.cardDisabled,
      ]}
    >
      {/* Declined Badge */}
      {isDeclined && (
        <View style={styles.declinedBanner}>
          <Text style={styles.declinedBannerIcon}>⏱️</Text>
          <Text style={styles.declinedBannerText}>Moved to bottom</Text>
          <Text style={styles.declinedBannerHint}>Still available to accept</Text>
        </View>
      )}

      {/* Map Section */}
      <View style={styles.mapContainer}>
        {restaurant && customer ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType="none"
            initialRegion={{
              latitude: parseFloat(restaurant.latitude),
              longitude: parseFloat(restaurant.longitude),
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
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
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.markerDriver}>
                  <Text style={styles.markerEmoji}>🛵</Text>
                </View>
              </Marker>
            )}

            {/* Restaurant Marker */}
            <Marker
              coordinate={{
                latitude: parseFloat(restaurant.latitude),
                longitude: parseFloat(restaurant.longitude),
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerRestaurant}>
                <Text style={styles.markerEmoji}>🏪</Text>
              </View>
            </Marker>

            {/* Customer Marker */}
            <Marker
              coordinate={{
                latitude: parseFloat(customer.latitude),
                longitude: parseFloat(customer.longitude),
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerCustomer}>
                <Text style={styles.markerEmoji}>📍</Text>
              </View>
            </Marker>

            {/* FIRST DELIVERY: Solid polyline routes */}
            {showRoutes && hasPolylineData && driverToRestaurantPath.length > 1 && (
              <Polyline
                coordinates={driverToRestaurantPath}
                strokeColor="#1a1a1a"
                strokeWidth={4}
              />
            )}
            {showRoutes && hasPolylineData && restaurantToCustomerPath.length > 1 && (
              <Polyline
                coordinates={restaurantToCustomerPath}
                strokeColor="#1a1a1a"
                strokeWidth={3}
              />
            )}

            {/* FIRST DELIVERY FALLBACK: Curved solid lines */}
            {showRoutes && !hasPolylineData && driverToRestaurantCurved.length > 0 && (
              <Polyline
                coordinates={driverToRestaurantCurved}
                strokeColor="#1a1a1a"
                strokeWidth={4}
              />
            )}
            {showRoutes && !hasPolylineData && restaurantToCustomerCurved.length > 0 && (
              <Polyline
                coordinates={restaurantToCustomerCurved}
                strokeColor="#1a1a1a"
                strokeWidth={3}
              />
            )}

            {/* STACKED DELIVERY: Dashed curved lines */}
            {isStackedDelivery && driverToRestaurantCurved.length > 0 && (
              <Polyline
                coordinates={driverToRestaurantCurved}
                strokeColor="#1a1a1a"
                strokeWidth={4}
                lineDashPattern={[8, 12]}
                lineCap="round"
              />
            )}
            {isStackedDelivery && restaurantToCustomerCurved.length > 0 && (
              <Polyline
                coordinates={restaurantToCustomerCurved}
                strokeColor="#1a1a1a"
                strokeWidth={4}
                lineDashPattern={[8, 12]}
                lineCap="round"
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color="#13ec37" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}

        {/* Decline Button */}
        {onDecline && !isDeclined && (
          <Pressable
            style={styles.declineBtn}
            onPress={() => onDecline(delivery_id)}
          >
            <Text style={styles.declineBtnIcon}>🗑️</Text>
            <Text style={styles.declineBtnText}>Decline</Text>
          </Pressable>
        )}
      </View>

      {/* Content Card */}
      <View style={styles.cardContent}>
        {/* Cannot Accept Warning */}
        {!can_accept && reason && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ {reason}</Text>
          </View>
        )}

        {/* Tip Amount Badge */}
        {tipAmount > 0 && (
          <View style={styles.tipBox}>
            <View style={styles.tipLeft}>
              <Text style={styles.tipIcon}>💰</Text>
              <Text style={styles.tipLabel}>Manager Tip Included</Text>
            </View>
            <Text style={styles.tipValue}>+Rs.{tipAmount.toFixed(0)}</Text>
          </View>
        )}

        {/* Stacked Delivery: Bonus Box */}
        {isStackedDelivery && Number(bonus_amount) > 0 && (
          <View style={styles.bonusBox}>
            <Text style={styles.bonusLabel}>Bonus For This Delivery</Text>
            <Text style={styles.bonusValue}>+Rs.{Number(bonus_amount).toFixed(2)}</Text>
          </View>
        )}

        {/* Earnings Section */}
        <View style={styles.earningsRow}>
          <View>
            <Text style={styles.earningsAmount}>
              {isStackedDelivery
                ? `+Rs.${Number(extra_earnings || 0).toFixed(2)}`
                : `Rs. ${Number(total_trip_earnings || driverEarnings || 0).toFixed(2)}`}
            </Text>
            <Text style={styles.earningsLabel}>
              {isStackedDelivery ? "Extra Earnings" : "Total Earnings"}
            </Text>
          </View>
          <View style={styles.statsColumn}>
            <View style={styles.statBadge}>
              <Text style={styles.statIcon}>🗺️</Text>
              <Text style={styles.statValue}>
                {isStackedDelivery
                  ? `+${Number(extra_distance_km || 0).toFixed(1)} km`
                  : `${Number(total_delivery_distance_km || r1_distance_km || 0).toFixed(1)} km`}
              </Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statIcon}>⏱️</Text>
              <Text style={styles.statValue}>
                {isStackedDelivery
                  ? `+${Number(extra_time_minutes || 0).toFixed(0)} mins`
                  : `${estimated_time_minutes || 0} mins`}
              </Text>
            </View>
          </View>
        </View>

        {/* Route Details Header */}
        <Text style={styles.sectionTitle}>Route Details</Text>

        {/* Timeline */}
        <View style={styles.timeline}>
          {/* Pickup */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconWrap}>
              <View style={styles.timelineIcon}>
                <Text style={styles.timelineIconText}>🏢</Text>
              </View>
              <View style={styles.timelineLine} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>
                Pickup: <Text style={styles.timelineName}>{restaurant?.name}</Text>
              </Text>
              <Text style={styles.timelineAddress} numberOfLines={2}>
                {restaurant?.address}
              </Text>
            </View>
          </View>

          {/* Drop-off */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconWrap}>
              <View style={styles.timelineIcon}>
                <Text style={styles.timelineIconText}>📍</Text>
              </View>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>
                Drop-off: <Text style={styles.timelineName}>{customer?.name || "Customer"}</Text>
              </Text>
              <Text style={styles.timelineAddress} numberOfLines={2}>
                {customer?.address || "No address"}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Badge */}
        {totalItems > 0 && (
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🛒 {totalItems} item{totalItems !== 1 ? "s" : ""}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>#{order_number}</Text>
            </View>
          </View>
        )}

        {/* Accept Button */}
        <Pressable
          style={[
            styles.acceptBtn,
            !can_accept && styles.acceptBtnDisabled,
            accepting && styles.acceptBtnLoading,
          ]}
          onPress={() => onAccept(delivery_id)}
          disabled={accepting || !can_accept}
        >
          {accepting ? (
            <>
              <ActivityIndicator size="small" color="#111812" />
              <Text style={styles.acceptBtnText}>Accepting...</Text>
            </>
          ) : !can_accept ? (
            <Text style={styles.acceptBtnTextDisabled}>Cannot Accept</Text>
          ) : (
            <>
              <Text style={styles.acceptBtnText}>
                {isStackedDelivery ? "Accept Stacked Delivery" : "Accept Delivery"}
              </Text>
              <Text style={styles.acceptBtnArrow}>→</Text>
            </>
          )}
        </Pressable>
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
        ])
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
            <View style={[styles.skeletonLine, { width: 130, height: 14, marginTop: 6 }]} />
          </View>
          <View style={styles.skeletonEarningsRight}>
            <View style={[styles.skeletonBadge, { width: 80, height: 28 }]} />
            <View style={[styles.skeletonBadge, { width: 80, height: 28, marginTop: 6 }]} />
          </View>
        </View>

        {/* Route Header */}
        <View style={[styles.skeletonLine, { width: 110, height: 16, marginBottom: 16 }]} />

        {/* Timeline */}
        <View style={styles.skeletonTimeline}>
          {/* Pickup */}
          <View style={styles.skeletonTimelineItem}>
            <View style={styles.skeletonTimelineIcon} />
            <View style={styles.skeletonTimelineContent}>
              <View style={[styles.skeletonLine, { width: 60, height: 12 }]} />
              <View style={[styles.skeletonLine, { width: 160, height: 16, marginTop: 4 }]} />
              <View style={[styles.skeletonLine, { width: 200, height: 14, marginTop: 4 }]} />
            </View>
          </View>

          {/* Dropoff */}
          <View style={styles.skeletonTimelineItem}>
            <View style={styles.skeletonTimelineIcon} />
            <View style={styles.skeletonTimelineContent}>
              <View style={[styles.skeletonLine, { width: 60, height: 12 }]} />
              <View style={[styles.skeletonLine, { width: 130, height: 16, marginTop: 4 }]} />
              <View style={[styles.skeletonLine, { width: 180, height: 14, marginTop: 4 }]} />
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
    backgroundColor: "#10B981",
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
    borderColor: "#BBF7D0",
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
    backgroundColor: "#22C55E",
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

  // Header
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 22,
    color: "#374151",
    fontWeight: "600",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  activeBadge: {
    backgroundColor: "#13ec37",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
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
    height: SCREEN_HEIGHT * 0.4,
    minHeight: 220,
    backgroundColor: "#E5E7EB",
  },
  map: {
    flex: 1,
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  mapLoadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },

  // Decline Button
  declineBtn: {
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
  cardContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
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

  // Tip Box
  tipBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 2,
    borderColor: "#FCD34D",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  tipLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  tipValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#D97706",
  },

  // Bonus Box
  bonusBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 2,
    borderColor: "#13ec37",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  bonusLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  bonusValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#13ec37",
  },

  // Earnings Row
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 16,
  },
  earningsAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#13ec37",
  },
  earningsLabel: {
    fontSize: 14,
    color: "#111812",
    fontWeight: "500",
    marginTop: 2,
  },
  statsColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statIcon: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111812",
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },

  // Timeline
  timeline: {
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineIconWrap: {
    alignItems: "center",
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(19, 236, 55, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconText: {
    fontSize: 18,
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

  // Accept Button
  acceptBtn: {
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

  // ============================================================================
  // SKELETON STYLES
  // ============================================================================

  skeletonCard: {
    backgroundColor: "#fff",
    marginBottom: 16,
    overflow: "hidden",
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
    backgroundColor: "#BBF7D0",
    borderRadius: 28,
  },
});
