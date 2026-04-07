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
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import FreeMapView from "../../components/maps/FreeMapView";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ============================================================================
// CONSTANTS
// ============================================================================

const LIVE_TRACKING_INTERVAL = 3000; // 3s - smooth driver marker updates
const DATA_REFRESH_THRESHOLD = 100; // 100m - only fetch API data after this
const DEFAULT_LOCATION = { latitude: 8.5017, longitude: 81.186 };

// ============================================================================
// HELPERS
// ============================================================================

const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
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

const fetchOSRMRoute = async (fromLat, fromLng, toLat, toLng) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes[0]) {
      const r = data.routes[0];
      return {
        success: true,
        coordinates: r.geometry.coordinates.map(function (c) {
          return { latitude: c[1], longitude: c[0] };
        }),
        distance_km: (r.distance / 1000).toFixed(1),
        duration_min: Math.ceil(r.duration / 60),
      };
    }
    return { success: false };
  } catch (e) {
    return { success: false };
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DriverMapScreen({ route, navigation }) {
  const { logout } = useAuth();
  const params = route.params || {};
  const deliveryId = params.deliveryId;
  const initialMode = params.mode || "pickup";

  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const lastBackendUpdateRef = useRef(0);
  const isFetchingRef = useRef(false);
  const routeFetchLocRef = useRef(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [mode, setMode] = useState(initialMode);
  const [pickups, setPickups] = useState([]);
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [targetForMap, setTargetForMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // ============================================================================
  // INIT / CLEANUP
  // ============================================================================

  useEffect(function () {
    startLocationTracking();
    return function () {
      if (watchIdRef.current) {
        watchIdRef.current.remove();
        watchIdRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // LOCATION TRACKING
  // Live display: marker updates every 3s (distanceInterval: 0)
  // Data refresh: API calls only when moved 100m+ from last fetch
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
        accuracy: Location.Accuracy.High,
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
          accuracy: Location.Accuracy.High,
          timeInterval: LIVE_TRACKING_INTERVAL,
          distanceInterval: 0,
        },
        function (position) {
          var newLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Always update marker (smooth live tracking every 3s)
          setDriverLocation(newLoc);

          // Backend location update (throttled 5s)
          updateBackendLocation(newLoc);

          // Only fetch API data when moved 100m+ from last fetch
          var lastFetch = lastFetchLocationRef.current;
          if (lastFetch) {
            var moved = getDistanceMeters(
              lastFetch.latitude,
              lastFetch.longitude,
              newLoc.latitude,
              newLoc.longitude,
            );
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

  const fetchPickupsAndDeliveries = async (location) => {
    if (!location || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      var token = await getAccessToken();
      if (!token) {
        await logout();
        return;
      }

      // Fetch pickups
      var pickupsUrl =
        API_BASE_URL +
        "/driver/deliveries/pickups?driver_latitude=" +
        location.latitude +
        "&driver_longitude=" +
        location.longitude;
      var pickupsRes = await rateLimitedFetch(pickupsUrl, {
        headers: { Authorization: "Bearer " + token },
      });
      var pickupsData = { pickups: [] };
      if (pickupsRes.ok) {
        pickupsData = await pickupsRes.json();
      }

      // Fetch deliveries
      var deliveriesUrl =
        API_BASE_URL +
        "/driver/deliveries/deliveries-route?driver_latitude=" +
        location.latitude +
        "&driver_longitude=" +
        location.longitude;
      var deliveriesRes = await rateLimitedFetch(deliveriesUrl, {
        headers: { Authorization: "Bearer " + token },
      });
      var deliveriesData = { deliveries: [] };
      if (deliveriesRes.ok) {
        deliveriesData = await deliveriesRes.json();
      }

      var pList = pickupsData.pickups || [];
      var dList = deliveriesData.deliveries || [];

      // ── Fallback: hit /active when both lists are empty ──
      if (pList.length === 0 && dList.length === 0) {
        console.log(
          "[FETCH] Both endpoints empty, trying /driver/deliveries/active fallback...",
        );
        try {
          var fallbackRes = await rateLimitedFetch(
            API_BASE_URL + "/driver/deliveries/active",
            {
              headers: { Authorization: "Bearer " + token },
            },
          );
          if (fallbackRes.ok) {
            var fallbackData = await fallbackRes.json();
            var activeList = fallbackData.deliveries || [];
            if (activeList.length > 0) {
              var accepted = activeList.filter(function (d) {
                return d.status === "accepted";
              });
              var inProgress = activeList.filter(function (d) {
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

      setPickups(pList);
      setDeliveriesList(dList);

      // Auto-select mode and target
      if (pList.length > 0) {
        setMode("pickup");
        var pTarget = deliveryId
          ? pList.find(function (p) {
              return p.delivery_id === deliveryId;
            }) || pList[0]
          : pList[0];
        setCurrentTarget(pTarget);
      } else if (dList.length > 0) {
        setMode("deliver");
        var dTarget = deliveryId
          ? dList.find(function (d) {
              return d.delivery_id === deliveryId;
            }) || dList[0]
          : dList[0];
        setCurrentTarget(dTarget);
      } else {
        setCurrentTarget(null);
      }
    } catch (err) {
      console.error("[FETCH] Data error:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
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
        setTargetForMap({
          latitude: parseFloat(currentTarget.restaurant.latitude),
          longitude: parseFloat(currentTarget.restaurant.longitude),
        });
      } else if (mode === "deliver" && currentTarget.customer) {
        setTargetForMap({
          latitude: parseFloat(currentTarget.customer.latitude),
          longitude: parseFloat(currentTarget.customer.longitude),
        });
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
      var prev = routeFetchLocRef.current;
      if (!prev) {
        routeFetchLocRef.current = driverLocation;
        return;
      }
      var moved = getDistanceMeters(
        prev.latitude,
        prev.longitude,
        driverLocation.latitude,
        driverLocation.longitude,
      );
      if (moved >= DATA_REFRESH_THRESHOLD) {
        routeFetchLocRef.current = driverLocation;
        doFetchRoute(driverLocation, targetForMap);
      }
    },
    [driverLocation],
  );

  const doFetchRoute = async (from, to) => {
    var result = await fetchOSRMRoute(
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
      var backendCoords =
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
        setRouteCoords([from, to]);
      }
      setRouteInfo(null);
    }
  };

  // ============================================================================
  // BACKEND LOCATION UPDATE (throttled to 5s)
  // ============================================================================

  const updateBackendLocation = async (loc) => {
    var now = Date.now();
    if (now - lastBackendUpdateRef.current < 5000) return;
    lastBackendUpdateRef.current = now;
    try {
      var token = await getAccessToken();
      if (!token || !deliveryId) return;
      await fetch(
        API_BASE_URL + "/driver/deliveries/" + deliveryId + "/location",
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

  const handlePickedUp = async () => {
    if (!currentTarget || updating) return;
    setUpdating(true);
    try {
      var token = await getAccessToken();
      var res = await fetch(
        API_BASE_URL +
          "/driver/deliveries/" +
          currentTarget.delivery_id +
          "/status",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "picked_up",
            latitude: driverLocation ? driverLocation.latitude : null,
            longitude: driverLocation ? driverLocation.longitude : null,
          }),
        },
      );
      if (res.ok) {
        var updated = pickups.filter(function (p) {
          return p.delivery_id !== currentTarget.delivery_id;
        });
        setPickups(updated);
        if (updated.length > 0) {
          setCurrentTarget(updated[0]);
        } else {
          // All picked up - refetch to switch to delivery mode
          if (driverLocation) {
            await fetchPickupsAndDeliveries(driverLocation);
          }
        }
        Alert.alert("Picked Up", "Order picked up successfully!");
      } else {
        var errData = await res.json().catch(function () {
          return {};
        });
        Alert.alert("Error", errData.message || "Failed to update status");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to mark as picked up");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelivered = async () => {
    if (!currentTarget || updating) return;
    setUpdating(true);
    try {
      var token = await getAccessToken();
      var statusUrl =
        API_BASE_URL +
        "/driver/deliveries/" +
        currentTarget.delivery_id +
        "/status";
      var headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
      var locBody = {
        latitude: driverLocation ? driverLocation.latitude : null,
        longitude: driverLocation ? driverLocation.longitude : null,
      };

      // Progress through status steps
      var currentStatus = currentTarget.status || "";
      if (currentStatus === "picked_up" || currentStatus === "accepted") {
        await fetch(statusUrl, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify(
            Object.assign({ status: "on_the_way" }, locBody),
          ),
        });
      }
      if (
        currentStatus === "picked_up" ||
        currentStatus === "on_the_way" ||
        currentStatus === "accepted"
      ) {
        await fetch(statusUrl, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify(
            Object.assign({ status: "at_customer" }, locBody),
          ),
        });
      }
      // Final: delivered
      var finalRes = await fetch(statusUrl, {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify(Object.assign({ status: "delivered" }, locBody)),
      });

      if (finalRes.ok) {
        var resData = await finalRes.json().catch(function () {
          return {};
        });
        var updated = deliveriesList.filter(function (d) {
          return d.delivery_id !== currentTarget.delivery_id;
        });

        // If backend promoted another delivery to on_the_way, update its status in the list
        if (resData.promotedDelivery && updated.length > 0) {
          var promotedIdx = updated.findIndex(function (d) {
            return d.delivery_id === resData.promotedDelivery.id;
          });
          if (promotedIdx !== -1) {
            updated[promotedIdx] = Object.assign({}, updated[promotedIdx], {
              status: "on_the_way",
            });
          }
        }

        setDeliveriesList(updated);
        if (updated.length > 0) {
          setCurrentTarget(updated[0]);
        } else {
          Alert.alert("All Deliveries Completed!", "Great job!", [
            {
              text: "OK",
              onPress: function () {
                navigation.navigate("ActiveDeliveries");
              },
            },
          ]);
        }
      } else {
        var errData = await finalRes.json().catch(function () {
          return {};
        });
        Alert.alert("Error", errData.message || "Failed to mark as delivered");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to mark as delivered");
    } finally {
      setUpdating(false);
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
  };

  // Auto-fit map
  useEffect(
    function () {
      if (!userInteracted && driverLocation && targetForMap) {
        setTimeout(function () {
          if (mapRef.current && mapRef.current.fitToCoordinates) {
            mapRef.current.fitToCoordinates([driverLocation, targetForMap], {
              edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
            });
          }
        }, 400);
      }
    },
    [driverLocation, targetForMap, userInteracted],
  );

  // Animate bottom sheet
  useEffect(
    function () {
      if (!loading && currentTarget) {
        Animated.spring(sheetAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      }
    },
    [loading, currentTarget],
  );

  // Google Maps Navigation
  const openGoogleMaps = () => {
    if (!targetForMap) return;
    var url = Platform.select({
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06C168" />
        <Text style={styles.loadingText}>Loading delivery...</Text>
      </View>
    );
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

  var translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <View style={styles.container}>
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
            },
            ...(targetForMap
              ? [
                  {
                    id: "target",
                    coordinate: targetForMap,
                    type: mode === "pickup" ? "restaurant" : "customer",
                    emoji: mode === "pickup" ? "\uD83C\uDFEA" : "\uD83D\uDCCD",
                  },
                ]
              : []),
          ]}
          polylines={
            routeCoords.length > 1
              ? [
                  {
                    id: "route",
                    coordinates: routeCoords,
                    strokeColor: mode === "pickup" ? "#EF4444" : "#06C168",
                    strokeWidth: 4,
                  },
                ]
              : []
          }
          onMapPress={() => setUserInteracted(true)}
        />
      )}

      {/* TOP BADGES */}
      <SafeAreaView style={styles.topContainer} edges={["top"]}>
        <View style={styles.topBadges}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{"← Back"}</Text>
          </Pressable>

          <View
            style={[
              styles.modeBadge,
              mode === "pickup" ? styles.pickupBadge : styles.deliverBadge,
            ]}
          >
            <Text style={styles.modeBadgeText}>
              {mode === "pickup" ? "🏪 PICKUP MODE" : "📦 DELIVERY MODE"}
            </Text>
          </View>

          <View style={styles.trackingBadge}>
            <View
              style={[
                styles.trackingDot,
                isTracking && styles.trackingDotActive,
              ]}
            />
            <Text style={styles.trackingText}>
              {isTracking ? "Live" : "Off"}
            </Text>
          </View>
        </View>

        {routeInfo && (
          <View style={styles.routeInfoCard}>
            <Text style={styles.routeInfoText}>
              {"📍 " +
                routeInfo.distance_km +
                " km  •  ⏱️ ~" +
                routeInfo.duration_min +
                " min"}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* NAVIGATE BUTTON */}
      <Pressable style={styles.navigateBtn} onPress={openGoogleMaps}>
        <Text style={styles.navigateBtnIcon}>🧭</Text>
        <Text style={styles.navigateBtnText}>Navigate</Text>
      </Pressable>

      {/* RECENTER */}
      {userInteracted && (
        <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
          <Text style={styles.recenterBtnIcon}>🎯</Text>
        </Pressable>
      )}

      {/* BOTTOM SHEET */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: translateY }] },
        ]}
      >
        <View style={styles.dragHandle} />

        <ScrollView
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {mode === "pickup" ? (
            <PickupDetails
              target={currentTarget}
              onPickedUp={handlePickedUp}
              onCall={handleCall}
              updating={updating}
            />
          ) : (
            <DeliveryDetails
              target={currentTarget}
              onDelivered={handleDelivered}
              onCall={handleCall}
              updating={updating}
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
                    <View style={styles.upcomingRight}>
                      {p.distance_km ? (
                        <Text style={styles.upcomingDist}>
                          {p.distance_km + " km"}
                        </Text>
                      ) : null}
                      {p.estimated_time_minutes ? (
                        <Text style={styles.upcomingTime}>
                          {p.estimated_time_minutes + " min"}
                        </Text>
                      ) : null}
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
                    <View style={styles.upcomingRight}>
                      {d.distance_km ? (
                        <Text style={styles.upcomingDist}>
                          {d.distance_km + " km"}
                        </Text>
                      ) : null}
                      {d.estimated_time_minutes ? (
                        <Text style={styles.upcomingTime}>
                          {d.estimated_time_minutes + " min"}
                        </Text>
                      ) : null}
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
    </View>
  );
}

// ============================================================================
// PICKUP DETAILS
// ============================================================================

function PickupDetails({ target, onPickedUp, onCall, updating }) {
  var restaurant = target.restaurant || {};
  var orderItems = target.order_items || target.items || [];

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
            <View style={styles.distBadge}>
              <Text style={styles.distBadgeText}>
                {"📍 " + target.distance_km + " km"}
              </Text>
            </View>
          ) : null}
          {target.estimated_time_minutes ? (
            <View style={styles.distBadge}>
              <Text style={styles.distBadgeText}>
                {"⏱ " + target.estimated_time_minutes + " min"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Block 2: Restaurant info */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoCardMain}>
            <Text style={styles.infoCardName}>
              {restaurant.name || target.restaurantname || "Restaurant"}
            </Text>
            <Text style={styles.infoCardAddress}>
              {restaurant.address || target.restaurantaddress || "No address"}
            </Text>
          </View>
          <View style={styles.infoCardActions}>
            {restaurant.phone || target.restaurant_phone ? (
              <Pressable
                style={styles.iconBtn}
                onPress={() =>
                  onCall(restaurant.phone || target.restaurant_phone)
                }
              >
                <Text style={styles.iconBtnText}>📞</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Block 3: Order items */}
      {orderItems.length > 0 && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsSectionTitle}>{"📦 Order Items"}</Text>
          <View style={styles.itemsCard}>
            {orderItems.map(function (item, idx) {
              var name = item.food_name || item.name || "Item";
              var qty = item.quantity || 1;
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

      {/* Action */}
      <Pressable
        style={[
          styles.actionBtn,
          styles.pickupActionBtn,
          updating && styles.actionBtnDisabled,
        ]}
        onPress={onPickedUp}
        disabled={updating}
      >
        {updating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionBtnText}>{"✅ Mark as Picked Up"}</Text>
        )}
      </Pressable>
    </View>
  );
}

// ============================================================================
// DELIVERY DETAILS
// ============================================================================

function DeliveryDetails({ target, onDelivered, onCall, updating }) {
  var customer = target.customer || {};
  var delivItems = target.items || [];

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
            <View style={styles.distBadge}>
              <Text style={styles.distBadgeText}>
                {"📍 " + target.distance_km + " km"}
              </Text>
            </View>
          ) : null}
          {target.estimated_time_minutes ? (
            <View style={styles.distBadge}>
              <Text style={styles.distBadgeText}>
                {"⏱ " + target.estimated_time_minutes + " min"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Block 2: Customer info */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardRow}>
          <View style={styles.infoCardMain}>
            <Text style={styles.infoCardName}>
              {customer.name || target.name || "Customer"}
            </Text>
            <Text style={styles.infoCardAddress}>
              {customer.address || target.delivery_location || "No address"}
            </Text>
            {customer.city ? (
              <Text style={styles.infoCardCity}>{customer.city}</Text>
            ) : null}
          </View>
          <View style={styles.infoCardActions}>
            {customer.phone || target.phone ? (
              <Pressable
                style={styles.iconBtn}
                onPress={() => onCall(customer.phone || target.phone)}
              >
                <Text style={styles.iconBtnText}>📞</Text>
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
          <Text style={styles.itemsSectionTitle}>{"📦 Order Items"}</Text>
          <View style={styles.itemsCard}>
            {delivItems.map(function (item, idx) {
              var name = item.food_name || item.name || "Item";
              var qty = item.quantity || 1;
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
            {"LKR " +
              parseFloat(
                (target.pricing && target.pricing.total) ||
                  parseFloat(target.total_amount || 0) +
                    parseFloat(target.delivery_fee || 0),
              ).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Action */}
      <Pressable
        style={[
          styles.actionBtn,
          styles.deliverActionBtn,
          updating && styles.actionBtnDisabled,
        ]}
        onPress={onDelivered}
        disabled={updating}
      >
        {updating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionBtnText}>{"✅ Mark as Delivered"}</Text>
        )}
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

var SHADOW = Platform.select({
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
    zIndex: 10,
  },
  topBadges: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  backButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...SHADOW,
  },
  backButtonText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  modeBadge: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...SHADOW,
  },
  pickupBadge: { backgroundColor: "#FEF3C7" },
  deliverBadge: { backgroundColor: "#B8F0D0" },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  trackingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    ...SHADOW,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  trackingDotActive: { backgroundColor: "#06C168" },
  trackingText: { fontSize: 12, fontWeight: "700", color: "#374151" },

  // Route Info
  routeInfoCard: {
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    ...SHADOW,
  },
  routeInfoText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#06C168",
    textAlign: "center",
  },

  // Navigate / Recenter
  navigateBtn: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.46 + 60,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 25,
    gap: 6,
    zIndex: 10,
    ...SHADOW,
  },
  navigateBtnIcon: { fontSize: 18 },
  navigateBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  recenterBtn: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.46 + 8,
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

  // Bottom Sheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.46,
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
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
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
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
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
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  infoCardAddress: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 10,
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
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  itemsCard: { backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemQty: { fontSize: 14, fontWeight: "700", color: "#06C168", width: 36 },
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
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  orderHeaderValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
  orderHeaderBadges: { flexDirection: "row", gap: 6 },
  distBadge: {
    backgroundColor: "#B8F0D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  distBadgeText: { fontSize: 12, fontWeight: "700", color: "#04553C" },

  // Info card row layout
  infoCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoCardMain: { flex: 1, marginRight: 10 },
  infoCardCity: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  infoCardActions: { gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnText: { fontSize: 18 },

  // Item layout
  itemQtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#B8F0D0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  itemDetails: { flex: 1 },
  itemSize: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Total amount card
  totalAmountCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
