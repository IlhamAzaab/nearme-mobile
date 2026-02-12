/**
 * Driver Map Screen
 *
 * Full-featured delivery map with:
 * - Live GPS tracking (every 3 seconds)
 * - Pickup and Delivery modes
 * - Route display with polyline
 * - Real-time location updates to backend
 * - Bottom sheet with delivery info
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  Animated,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import { getOSRMRoute } from "../../services/mapService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// MARKER COMPONENTS
// ============================================================================

const DriverMarker = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.driverPin]}>
      <Text style={styles.markerEmoji}>🚗</Text>
    </View>
  </View>
);

const RestaurantMarker = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.restaurantPin]}>
      <Text style={styles.markerEmoji}>🏪</Text>
    </View>
  </View>
);

const CustomerMarker = () => (
  <View style={styles.markerContainer}>
    <View style={[styles.markerPin, styles.customerPin]}>
      <Text style={styles.markerEmoji}>📍</Text>
    </View>
  </View>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DriverMapScreen({ route, navigation }) {
  const { deliveryId } = route.params || {};
  const mapRef = useRef(null);
  const locationInterval = useRef(null);
  const [sheetAnim] = useState(new Animated.Value(0));

  // State
  const [mode, setMode] = useState("pickup"); // "pickup" or "delivery"
  const [pickups, setPickups] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);

  // ============================================================================
  // LOCATION TRACKING
  // ============================================================================

  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required for delivery tracking");
        return;
      }

      setIsTracking(true);

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(initialLocation);
      updateLocationOnBackend(deliveryId, initialLocation);

      // Update every 3 seconds
      locationInterval.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const newLocation = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setDriverLocation(newLocation);
          updateLocationOnBackend(deliveryId, newLocation);
        } catch (err) {
          console.log("Location update error:", err);
        }
      }, 3000);
    } catch (err) {
      console.log("Location tracking error:", err);
      setIsTracking(false);
    }
  }, [deliveryId]);

  const stopLocationTracking = useCallback(() => {
    setIsTracking(false);
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  }, []);

  const updateLocationOnBackend = async (delivId, location) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_BASE_URL}/driver/deliveries/${delivId}/location`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
    } catch (e) {
      console.log("Backend location update error:", e);
    }
  };

  // ============================================================================
  // FETCH DATA
  // ============================================================================

  const fetchPickupsAndDeliveries = useCallback(async () => {
    if (!driverLocation) return;

    try {
      const token = await AsyncStorage.getItem("token");

      // Fetch pickups
      const pickupsUrl = `${API_BASE_URL}/driver/deliveries/pickups?driver_latitude=${driverLocation.latitude}&driver_longitude=${driverLocation.longitude}`;
      const pickupsRes = await fetch(pickupsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pickupsData = await pickupsRes.json();

      // Fetch deliveries
      const deliveriesUrl = `${API_BASE_URL}/driver/deliveries/deliveries-route?driver_latitude=${driverLocation.latitude}&driver_longitude=${driverLocation.longitude}`;
      const deliveriesRes = await fetch(deliveriesUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const deliveriesData = await deliveriesRes.json();

      if (pickupsRes.ok) {
        setPickups(pickupsData.pickups || []);
        if (pickupsData.pickups?.length > 0) {
          setMode("pickup");
          setCurrentTarget(pickupsData.pickups[0]);
        }
      }

      if (deliveriesRes.ok) {
        setDeliveries(deliveriesData.deliveries || []);
        if ((!pickupsData.pickups || pickupsData.pickups.length === 0) && deliveriesData.deliveries?.length > 0) {
          setMode("delivery");
          setCurrentTarget(deliveriesData.deliveries[0]);
        }
      }
    } catch (e) {
      console.log("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [driverLocation]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    startLocationTracking();
    return () => stopLocationTracking();
  }, []);

  useEffect(() => {
    if (driverLocation) {
      fetchPickupsAndDeliveries();
    }
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // ============================================================================
  // OSRM ROUTE FETCHING (Same as Website)
  // ============================================================================
  
  useEffect(() => {
    const fetchRoute = async () => {
      if (!driverLocation || !currentTarget) {
        setRouteCoords([]);
        setRouteInfo(null);
        return;
      }

      let targetLat, targetLng;
      
      if (mode === "pickup" && currentTarget.restaurant) {
        targetLat = parseFloat(currentTarget.restaurant.latitude);
        targetLng = parseFloat(currentTarget.restaurant.longitude);
      } else if (mode === "delivery" && currentTarget.customer) {
        targetLat = parseFloat(currentTarget.customer.latitude);
        targetLng = parseFloat(currentTarget.customer.longitude);
      }
      
      if (!targetLat || !targetLng) return;
      
      // Fetch OSRM route (same as website)
      const result = await getOSRMRoute(
        driverLocation.latitude,
        driverLocation.longitude,
        targetLat,
        targetLng
      );
      
      if (result.success) {
        setRouteCoords(result.coordinates);
        setRouteInfo({
          distance_km: result.distance_km,
          duration_min: result.duration_min,
        });
      } else {
        // Fallback to backend route if OSRM fails
        const backendCoords = currentTarget.route_geometry?.coordinates?.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        })) || [];
        setRouteCoords(backendCoords);
      }
    };
    
    fetchRoute();
  }, [driverLocation?.latitude, driverLocation?.longitude, currentTarget?.delivery_id, mode]);

  // Animate bottom sheet
  useEffect(() => {
    if (!loading && currentTarget) {
      Animated.spring(sheetAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [loading, currentTarget]);

  // Fit map to markers
  useEffect(() => {
    if (mapRef.current && driverLocation && currentTarget && !userHasInteracted) {
      const coordinates = [
        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      ];

      if (mode === "pickup" && currentTarget.restaurant) {
        coordinates.push({
          latitude: parseFloat(currentTarget.restaurant.latitude),
          longitude: parseFloat(currentTarget.restaurant.longitude),
        });
      } else if (mode === "delivery" && currentTarget.customer) {
        coordinates.push({
          latitude: parseFloat(currentTarget.customer.latitude),
          longitude: parseFloat(currentTarget.customer.longitude),
        });
      }

      if (coordinates.length > 1) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: SCREEN_HEIGHT * 0.45, left: 50 },
          animated: true,
        });
      }
    }
  }, [driverLocation, currentTarget, mode, userHasInteracted]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handlePickedUp = async () => {
    if (!currentTarget) return;

    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/driver/deliveries/${currentTarget.delivery_id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "picked_up",
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          }),
        }
      );

      if (res.ok) {
        const updatedPickups = pickups.filter((p) => p.delivery_id !== currentTarget.delivery_id);
        setPickups(updatedPickups);

        if (updatedPickups.length > 0) {
          setCurrentTarget(updatedPickups[0]);
        } else {
          await fetchPickupsAndDeliveries();
        }
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to update status");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelivered = async () => {
    if (!currentTarget) return;

    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem("token");

      // Update status progression
      if (currentTarget.status === "picked_up") {
        await fetch(`${API_BASE_URL}/driver/deliveries/${currentTarget.delivery_id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "on_the_way" }),
        });
      }

      if (currentTarget.status === "picked_up" || currentTarget.status === "on_the_way") {
        await fetch(`${API_BASE_URL}/driver/deliveries/${currentTarget.delivery_id}/status`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "at_customer" }),
        });
      }

      // Mark as delivered
      const res = await fetch(
        `${API_BASE_URL}/driver/deliveries/${currentTarget.delivery_id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "delivered",
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          }),
        }
      );

      if (res.ok) {
        const updatedDeliveries = deliveries.filter((d) => d.delivery_id !== currentTarget.delivery_id);
        setDeliveries(updatedDeliveries);

        if (updatedDeliveries.length > 0) {
          setCurrentTarget(updatedDeliveries[0]);
        } else {
          Alert.alert("🎉 All Deliveries Completed!", "Great job!", [
            { text: "OK", onPress: () => navigation.navigate("Active") },
          ]);
        }
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to mark as delivered");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to mark as delivered");
    } finally {
      setUpdating(false);
    }
  };

  const handleRecenter = () => {
    setUserHasInteracted(false);
  };

  const handleCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleStartDelivery = () => {
    if (deliveries.length > 0) {
      setMode("delivery");
      setCurrentTarget(deliveries[0]);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (!currentTarget) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>✅</Text>
        <Text style={styles.emptyTitle}>All Deliveries Completed!</Text>
        <Pressable style={styles.emptyButton} onPress={() => navigation.navigate("Available")}>
          <Text style={styles.emptyButtonText}>View Available Deliveries</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  // Get target location for marker
  const targetLocation = mode === "pickup"
    ? currentTarget.restaurant
      ? { latitude: parseFloat(currentTarget.restaurant.latitude), longitude: parseFloat(currentTarget.restaurant.longitude) }
      : null
    : currentTarget.customer
      ? { latitude: parseFloat(currentTarget.customer.latitude), longitude: parseFloat(currentTarget.customer.longitude) }
      : null;

  return (
    <View style={styles.container}>
      {/* Map */}
      {driverLocation && (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="none"
          initialRegion={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPanDrag={() => setUserHasInteracted(true)}
        >
          {/* 🆓 FREE OpenStreetMap Tiles */}
          <UrlTile
            urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
            maximumZ={19}
            flipY={false}
            tileSize={256}
            zIndex={-1}
          />
          {/* Driver Marker */}
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <DriverMarker />
          </Marker>

          {/* Target Marker */}
          {targetLocation && (
            <Marker coordinate={targetLocation} anchor={{ x: 0.5, y: 1 }}>
              {mode === "pickup" ? <RestaurantMarker /> : <CustomerMarker />}
            </Marker>
          )}

          {/* Route Line - OSRM Route */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={mode === "pickup" ? "#EF4444" : "#10B981"}
              strokeWidth={4}
            />
          )}
        </MapView>
      )}

      {/* Mode Badge */}
      <SafeAreaView style={styles.topBadges} edges={["top"]}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>
            {mode === "pickup" ? "🏪 PICKUP" : "📦 DELIVERY"}
          </Text>
        </View>

        {/* Route Info Badge */}
        {routeInfo && (
          <View style={styles.routeInfoBadge}>
            <Text style={styles.routeInfoText}>
              {routeInfo.distance_km.toFixed(1)} km • {routeInfo.duration_min} min
            </Text>
          </View>
        )}

        <View style={styles.trackingBadge}>
          <View style={[styles.trackingDot, isTracking && styles.trackingDotActive]} />
          <Text style={styles.trackingText}>{isTracking ? "Live" : "Off"}</Text>
        </View>
      </SafeAreaView>

      {/* Recenter Button */}
      {userHasInteracted && (
        <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
          <Text style={styles.recenterIcon}>🎯</Text>
          <Text style={styles.recenterText}>Recenter</Text>
        </Pressable>
      )}

      {/* Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
        <View style={styles.dragHandle} />

        <ScrollView style={styles.sheetContent} showsVerticalScrollIndicator={false}>
          {mode === "pickup" ? (
            <PickupInfo
              pickup={currentTarget}
              onPickedUp={handlePickedUp}
              onCall={handleCall}
              updating={updating}
            />
          ) : (
            <DeliveryInfoCard
              delivery={currentTarget}
              onDelivered={handleDelivered}
              onCall={handleCall}
              updating={updating}
            />
          )}

          {/* Upcoming List */}
          <View style={styles.upcomingSection}>
            <Text style={styles.upcomingTitle}>
              {mode === "pickup"
                ? `Upcoming Pickups (${Math.max(0, pickups.length - 1)})`
                : `Upcoming Deliveries (${Math.max(0, deliveries.length - 1)})`}
            </Text>

            {mode === "pickup" &&
              pickups.slice(1).map((pickup, index) => (
                <UpcomingCard
                  key={pickup.delivery_id}
                  item={pickup}
                  index={index + 2}
                  type="pickup"
                />
              ))}

            {mode === "delivery" &&
              deliveries.slice(1).map((delivery, index) => (
                <UpcomingCard
                  key={delivery.delivery_id}
                  item={delivery}
                  index={index + 2}
                  type="delivery"
                />
              ))}
          </View>

          {/* Start Delivery Button */}
          {mode === "pickup" && pickups.length === 0 && deliveries.length > 0 && (
            <Pressable style={styles.startDeliveryBtn} onPress={handleStartDelivery}>
              <Text style={styles.startDeliveryText}>START DELIVERY</Text>
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================

function PickupInfo({ pickup, onPickedUp, onCall, updating }) {
  const { order_number, restaurant, distance_km, estimated_time_minutes } = pickup;

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <View>
          <Text style={styles.orderNumber}>Order #{order_number}</Text>
          <Text style={styles.targetName}>{restaurant?.name}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{distance_km} km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{estimated_time_minutes} min</Text>
          </View>
        </View>
      </View>

      <Text style={styles.addressText}>{restaurant?.address}</Text>

      {restaurant?.phone && (
        <Pressable style={styles.callBtn} onPress={() => onCall(restaurant.phone)}>
          <Text style={styles.callIcon}>📞</Text>
          <Text style={styles.callText}>{restaurant.phone}</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.actionBtn, styles.pickupBtn, updating && styles.actionBtnDisabled]}
        onPress={onPickedUp}
        disabled={updating}
      >
        <Text style={styles.actionBtnText}>
          {updating ? "Updating..." : "MARK AS PICKED UP"}
        </Text>
      </Pressable>
    </View>
  );
}

function DeliveryInfoCard({ delivery, onDelivered, onCall, updating }) {
  const { order_number, customer, pricing, distance_km, estimated_time_minutes, restaurant_name } = delivery;

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <View>
          <Text style={styles.orderNumber}>Order #{order_number}</Text>
          <Text style={styles.targetName}>{customer?.name}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{distance_km} km</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{estimated_time_minutes} min</Text>
          </View>
        </View>
      </View>

      {/* Pricing Box */}
      <View style={styles.pricingBox}>
        <Text style={styles.pricingFrom}>From: {restaurant_name}</Text>
        <View style={styles.pricingGrid}>
          <View style={styles.pricingItem}>
            <Text style={styles.pricingLabel}>Subtotal</Text>
            <Text style={styles.pricingValue}>Rs. {pricing?.subtotal?.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingItem}>
            <Text style={styles.pricingLabel}>Delivery</Text>
            <Text style={styles.pricingValue}>Rs. {pricing?.delivery_fee?.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingItem}>
            <Text style={styles.pricingLabel}>Service</Text>
            <Text style={styles.pricingValue}>Rs. {pricing?.service_fee?.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingItem}>
            <Text style={styles.pricingLabel}>Total</Text>
            <Text style={[styles.pricingValue, styles.totalValue]}>
              Rs. {pricing?.total?.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.addressText}>{customer?.address}</Text>

      {customer?.phone && (
        <Pressable style={styles.callBtn} onPress={() => onCall(customer.phone)}>
          <Text style={styles.callIcon}>📞</Text>
          <Text style={styles.callText}>{customer.phone}</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.actionBtn, styles.deliverBtn, updating && styles.actionBtnDisabled]}
        onPress={onDelivered}
        disabled={updating}
      >
        <Text style={styles.actionBtnText}>
          {updating ? "Updating..." : "MARK AS DELIVERED"}
        </Text>
      </Pressable>
    </View>
  );
}

function UpcomingCard({ item, index, type }) {
  const name = type === "pickup" ? item.restaurant?.name : item.customer?.name;

  return (
    <View style={styles.upcomingCard}>
      <View style={styles.upcomingIndex}>
        <Text style={styles.upcomingIndexText}>{index}</Text>
      </View>
      <View style={styles.upcomingInfo}>
        <Text style={styles.upcomingName}>{name}</Text>
        <Text style={styles.upcomingOrder}>#{item.order_number}</Text>
      </View>
      <View style={styles.upcomingStats}>
        <Text style={styles.upcomingStat}>{item.distance_km} km</Text>
        <Text style={styles.upcomingStat}>{item.estimated_time_minutes} min</Text>
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
    backgroundColor: "#F3F4F6",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  // Markers
  markerContainer: {
    alignItems: "center",
  },
  markerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  driverPin: {
    backgroundColor: "#3B82F6",
  },
  restaurantPin: {
    backgroundColor: "#EF4444",
  },
  customerPin: {
    backgroundColor: "#10B981",
  },
  markerEmoji: {
    fontSize: 20,
  },

  // Top Badges
  topBadges: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modeBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  trackingBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#9CA3AF",
  },
  trackingDotActive: {
    backgroundColor: "#10B981",
  },
  trackingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },

  // Recenter Button
  recenterBtn: {
    position: "absolute",
    top: 100,
    right: 16,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterIcon: {
    fontSize: 16,
  },
  recenterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.5,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Info Card
  infoCard: {
    paddingVertical: 16,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  targetName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    alignItems: "flex-end",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  addressText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    lineHeight: 20,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  callIcon: {
    fontSize: 16,
  },
  callText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },

  // Pricing Box
  pricingBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pricingFrom: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  pricingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pricingItem: {
    width: "48%",
  },
  pricingLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  totalValue: {
    color: "#10B981",
    fontSize: 16,
  },

  // Action Buttons
  actionBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  pickupBtn: {
    backgroundColor: "#10B981",
  },
  deliverBtn: {
    backgroundColor: "#10B981",
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  // Upcoming Section
  upcomingSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  upcomingTitle: {
    fontSize: 14,
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
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  upcomingIndexText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  upcomingOrder: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  upcomingStats: {
    alignItems: "flex-end",
  },
  upcomingStat: {
    fontSize: 11,
    color: "#6B7280",
  },

  // Start Delivery Button
  startDeliveryBtn: {
    height: 54,
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  startDeliveryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  
  // Route Info Badge
  routeInfoBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
});
