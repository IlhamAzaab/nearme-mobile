/**
 * Driver Dashboard Screen
 *
 * Features:
 * - Online/Offline status toggle with working time validation
 * - Today's earnings and deliveries stats
 * - Active time tracking
 * - Nearby delivery requests with mini map previews
 * - Working time based status (full_time, day, night)
 * - Manual override for outside working hours
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedAlert from "../../components/common/AnimatedAlert";
import FreeMapView from "../../components/maps/FreeMapView";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";
import { useDriverDeliveryNotifications } from "../../context/DriverDeliveryNotificationContext";
import { getAccessToken } from "../../lib/authStorage";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Working time display labels
const WORKING_TIME_LABELS = {
  full_time: "Full Time",
  day: "Day Shift (5AM - 7PM)",
  night: "Night Shift (6PM - 6AM)",
};

// Default driver location (Kinniya, Sri Lanka)
const DEFAULT_LOCATION = { latitude: 8.5017, longitude: 81.2377 };

// ============================================================================
// Mini Map Component for delivery preview
// ============================================================================

function MiniDeliveryMap({ delivery }) {
  const restaurant = delivery.restaurant;
  const customerLocation = delivery.delivery || delivery.customer;

  const center = useMemo(() => {
    if (restaurant?.latitude && restaurant?.longitude) {
      return {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      };
    }
    return DEFAULT_LOCATION;
  }, [restaurant]);

  const hasMarkers =
    restaurant?.latitude &&
    restaurant?.longitude &&
    customerLocation?.latitude &&
    customerLocation?.longitude;

  if (!hasMarkers) {
    return (
      <View style={styles.miniMapPlaceholder}>
        <Ionicons name="map-outline" size={24} color="#cbd5e1" />
      </View>
    );
  }

  // Prepare markers array
  const markers = [];

  // Add restaurant marker
  if (restaurant?.latitude && restaurant?.longitude) {
    markers.push({
      id: "restaurant",
      coordinate: {
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      },
      type: "restaurant",
      emoji: "🏪",
      title: restaurant.name || "Restaurant",
    });
  }

  // Add customer marker
  if (customerLocation?.latitude && customerLocation?.longitude) {
    markers.push({
      id: "customer",
      coordinate: {
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
      },
      type: "customer",
      emoji: "📍",
      title: "Customer",
    });
  }

  // Prepare polylines array
  const polylines = [];
  const restaurantToCustomerRoute = delivery.restaurant_to_customer_route;

  if (restaurantToCustomerRoute?.coordinates) {
    // Use route coordinates
    const coordinates = restaurantToCustomerRoute.coordinates.map((c) => ({
      latitude: c[1],
      longitude: c[0],
    }));
    polylines.push({
      id: "route",
      coordinates,
      strokeColor: "#06C168",
      strokeWidth: 3,
    });
  } else if (restaurant?.latitude && customerLocation?.latitude) {
    // Fallback: straight line
    polylines.push({
      id: "route",
      coordinates: [
        { latitude: restaurant.latitude, longitude: restaurant.longitude },
        {
          latitude: customerLocation.latitude,
          longitude: customerLocation.longitude,
        },
      ],
      strokeColor: "#06C168",
      strokeWidth: 2,
    });
  }

  return (
    <View style={styles.miniMapContainer}>
      <FreeMapView
        initialRegion={{
          ...center,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        markers={markers}
        polylines={polylines}
      />
    </View>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardScreen({ navigation }) {
  const isFocused = useIsFocused();
  const { logout } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayDeliveries: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState({
    earnings: 0,
    deliveries: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [availableDeliveries, setAvailableDeliveries] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverProfile, setDriverProfile] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [acceptingOrder, setAcceptingOrder] = useState(null);
  const [withinWorkingHours, setWithinWorkingHours] = useState(true);
  const [manualOverrideActive, setManualOverrideActive] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [alert, setAlert] = useState({
    visible: false,
    type: "info",
    message: "",
  });

  // Driver notification context - to sync online status
  const { setDriverOnline } = useDriverDeliveryNotifications();

  const workingHoursCheckRef = useRef(null);
  const driverLocationRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Alert helpers
  const showAlertMessage = (type, message) => {
    setAlert({ visible: true, type, message });
  };
  const showSuccess = (message) => showAlertMessage("success", message);
  const showError = (message) => showAlertMessage("error", message);

  // ============================================================================
  // SYNC ONLINE STATUS TO NOTIFICATION CONTEXT
  // (Skip on first mount to avoid overwriting saved/server status with false)
  // ============================================================================

  useEffect(() => {
    if (!hasInitializedRef.current) return;
    setDriverOnline(isOnline);
    AsyncStorage.setItem("driver_is_online", JSON.stringify(isOnline));
  }, [isOnline, setDriverOnline]);

  // ============================================================================
  // RESTORE ONLINE STATUS ON MOUNT
  // 1. Immediately restore from AsyncStorage (fast, cached)
  // 2. Then fetch from server (authoritative, may override)
  // ============================================================================

  useEffect(() => {
    (async () => {
      try {
        // Step 1: Restore cached status instantly so UI doesn't flash offline
        const savedStatus = await AsyncStorage.getItem("driver_is_online");
        if (savedStatus !== null) {
          const restored = JSON.parse(savedStatus);
          setIsOnline(restored);
          setDriverOnline(restored);
        }
      } catch (e) {
        console.error("Failed to restore driver status:", e);
      } finally {
        // Step 2: Mark initialized so sync effect can start working
        hasInitializedRef.current = true;
      }
    })();
  }, [setDriverOnline]);

  // ============================================================================
  // APP STATE LISTENER - Re-fetch status when app returns to foreground
  // ============================================================================

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground - re-fetch server status (source of truth)
        fetchStatusInfo();
        fetchDashboardData();
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription?.remove();
  }, [fetchStatusInfo, fetchDashboardData]);

  // ============================================================================
  // FETCH STATUS INFO (matches web version)
  // ============================================================================

  const fetchStatusInfo = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await rateLimitedFetch(`${API_URL}/driver/status-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStatusInfo(data);
        const serverOnline = data.currentStatus === "active";
        setIsOnline(serverOnline);
        setWithinWorkingHours(data.shouldBeActive || false);
        // Sync server truth to storage & notification context
        AsyncStorage.setItem("driver_is_online", JSON.stringify(serverOnline));
        setDriverOnline(serverOnline);
      }
    } catch (error) {
      console.error("Status info fetch error:", error);
    }
  }, [setDriverOnline]);

  // ============================================================================
  // FETCH DRIVER PROFILE
  // ============================================================================

  const fetchDriverProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        await logout();
        return;
      }

      const res = await rateLimitedFetch(`${API_URL}/driver/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        await logout();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setDriverProfile(data.driver);
        // Don't set isOnline here anymore - use status-info endpoint
        setManualOverrideActive(data.driver.manual_status_override || false);
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
      // Only logout on auth errors, not on network/read errors
      if (error?.message?.includes("401") || error?.message?.includes("403")) {
        await logout();
      }
    }
  }, [logout]);

  // ============================================================================
  // CHECK WORKING HOURS STATUS
  // ============================================================================

  const checkWorkingHoursStatus = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await rateLimitedFetch(
        `${API_URL}/driver/working-hours-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        setWithinWorkingHours(data.within_working_hours);
        setManualOverrideActive(data.manual_override);

        if (data.auto_updated) {
          setIsOnline(data.driver_status === "active");
          setStatusMessage(
            data.message || "Status changed due to working hours",
          );
          setTimeout(() => setStatusMessage(""), 5000);
        }
      }
    } catch (error) {
      console.error("Working hours check error:", error);
    }
  }, []);

  // ============================================================================
  // FETCH DASHBOARD DATA
  // ============================================================================

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        await logout();
        return;
      }

      // Get driver's current location
      let currentLocation = driverLocationRef.current || DEFAULT_LOCATION;
      driverLocationRef.current = currentLocation;
      setDriverLocation(currentLocation);

      const headers = { Authorization: `Bearer ${token}` };

      // Batch all dashboard API calls in parallel
      const [
        statsRes,
        monthlyStatsRes,
        recentRes,
        deliveriesRes,
        activeDeliveriesRes,
      ] = await Promise.all([
        rateLimitedFetch(`${API_URL}/driver/stats/today`, { headers }),
        rateLimitedFetch(`${API_URL}/driver/stats/monthly`, { headers }),
        rateLimitedFetch(`${API_URL}/driver/deliveries/recent?limit=5`, {
          headers,
        }),
        rateLimitedFetch(
          `${API_URL}/driver/deliveries/available/v2?driver_latitude=${currentLocation.latitude}&driver_longitude=${currentLocation.longitude}`,
          { headers },
        ),
        rateLimitedFetch(`${API_URL}/driver/deliveries/active`, { headers }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          todayEarnings: statsData.earnings || 0,
          todayDeliveries: statsData.deliveries || 0,
        });
      }

      if (monthlyStatsRes.ok) {
        const monthlyData = await monthlyStatsRes.json();
        setMonthlyStats({
          earnings: monthlyData.earnings || 0,
          deliveries: monthlyData.deliveries || 0,
        });
      }

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentDeliveries(recentData.deliveries || []);
      }

      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        setAvailableDeliveries(
          deliveriesData.available_deliveries ||
            deliveriesData.deliveries ||
            [],
        );
      }

      if (activeDeliveriesRes.ok) {
        const activeDeliveriesData = await activeDeliveriesRes.json();
        setActiveDeliveries(activeDeliveriesData.deliveries || []);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchDriverProfile();
    fetchStatusInfo();
    fetchDashboardData();

    // Polling only runs when this tab is focused
    // Status info: every 60 seconds (was 30s)
    // Dashboard data: every 60 seconds (was 30s)
    const statusInterval = setInterval(() => {
      if (isFocused) fetchStatusInfo();
    }, 60000);
    const dataInterval = setInterval(() => {
      if (isFocused) fetchDashboardData();
    }, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(dataInterval);
    };
  }, [fetchDriverProfile, fetchStatusInfo, fetchDashboardData, isFocused]);

  // ============================================================================
  // WORKING HOURS CHECK (every minute)
  // ============================================================================

  useEffect(() => {
    workingHoursCheckRef.current = setInterval(() => {
      if (isFocused) checkWorkingHoursStatus();
    }, 120000); // Every 2 minutes (was 1 minute)
    return () => {
      if (workingHoursCheckRef.current) {
        clearInterval(workingHoursCheckRef.current);
      }
    };
  }, [checkWorkingHoursStatus]);

  // ============================================================================
  // TOGGLE ONLINE STATUS (Enhanced to match web version)
  // ============================================================================

  const handleToggleOnline = async (manualOverride = false) => {
    const newStatus = !isOnline;

    // Check if toggle is allowed using status info
    if (statusInfo) {
      const canToggle = newStatus
        ? statusInfo.canToggleToActive
        : statusInfo.canToggleToInactive;

      if (!canToggle && !manualOverride) {
        if (newStatus && !statusInfo.shouldBeActive) {
          // Show override modal for activating outside working hours
          setShowOverrideModal(true);
          return;
        } else {
          showError("Cannot toggle status at this time");
          return;
        }
      }
    }

    setTogglingStatus(true);

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_URL}/driver/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus ? "active" : "inactive",
          manualOverride: manualOverride,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.status === "active");
        showSuccess(`Status updated to ${data.status}`);

        // Refresh status info and dashboard data
        fetchStatusInfo();
        fetchDashboardData();
      } else {
        const errorData = await res.json();
        showError(errorData.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Status toggle error:", error);
      showError("Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleManualOverrideConfirm = () => {
    setShowOverrideModal(false);
    handleToggleOnline(true);
  };

  // ============================================================================
  // ACCEPT DELIVERY REQUEST
  // ============================================================================

  const handleAcceptDelivery = async (deliveryId) => {
    setAcceptingOrder(deliveryId);
    try {
      const token = await getAccessToken();
      const delivery = availableDeliveries.find(
        (d) => d.delivery_id === deliveryId,
      );

      const body = {
        driver_latitude: driverLocation?.latitude,
        driver_longitude: driverLocation?.longitude,
        earnings_data: delivery
          ? {
              delivery_sequence: delivery.route_impact?.delivery_sequence || 1,
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
        `${API_URL}/driver/deliveries/${deliveryId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        navigation.navigate("ActiveDeliveries");
      } else {
        const data = await res.json();
        showError(data.message || "Failed to accept delivery");
      }
    } catch (error) {
      console.error("Accept delivery error:", error);
      showError("Failed to accept delivery");
    } finally {
      setAcceptingOrder(null);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const calculateDistance = (delivery) => {
    const routeImpact = delivery.route_impact || {};
    if (routeImpact.total_delivery_distance_km) {
      return parseFloat(routeImpact.total_delivery_distance_km).toFixed(1);
    }
    if (routeImpact.r1_distance_km) {
      return parseFloat(routeImpact.r1_distance_km).toFixed(1);
    }
    if (delivery.distance_km) {
      return parseFloat(delivery.distance_km).toFixed(1);
    }
    return "—";
  };

  const getDeliveryEarnings = (delivery) => {
    const routeImpact = delivery.route_impact || {};
    const pricing = delivery.pricing || {};
    return Number(
      routeImpact.total_trip_earnings ||
        pricing.total_trip_earnings ||
        pricing.driver_earnings ||
        delivery.delivery_fee ||
        0,
    ).toFixed(2);
  };

  const getEstimatedTime = (delivery) => {
    const routeImpact = delivery.route_impact || {};
    return (
      routeImpact.estimated_time_minutes || delivery.estimated_time_minutes || 0
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#06C168" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AnimatedAlert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        onDismiss={() => setAlert({ ...alert, visible: false })}
      />

      {/* Manual Override Modal */}
      <Modal
        visible={showOverrideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOverrideModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalIconContainer}>
              <Ionicons name="time-outline" size={32} color="#d97706" />
            </View>
            <Text style={styles.modalTitle}>Outside Working Hours</Text>
            <Text style={styles.modalDescription}>
              Your working time is set to{" "}
              <Text style={styles.modalBold}>
                {WORKING_TIME_LABELS[driverProfile?.working_time] || "Unknown"}
              </Text>
              . You are currently outside your scheduled working hours.
            </Text>
            <Text style={styles.modalSubtext}>
              Do you want to go online anyway?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowOverrideModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleManualOverrideConfirm}
              >
                <Text style={styles.modalConfirmText}>Go Online</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Status Message Toast */}
      {statusMessage ? (
        <View style={styles.statusToast}>
          <Ionicons name="information-circle" size={20} color="#f59e0b" />
          <Text style={styles.statusToastText}>{statusMessage}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#06C168"]}
          />
        }
      >
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate("DriverAccountProfile")}
          >
            <View style={styles.avatarContainer}>
              {driverProfile?.profile_picture ? (
                <Image
                  source={{ uri: driverProfile.profile_picture }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#64748b" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {driverProfile?.user_name || "Driver"}
              </Text>
              <Text style={styles.profileSubtext}>
                {WORKING_TIME_LABELS[driverProfile?.working_time] || ""}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate("DriverNotifications")}
          >
            <Ionicons name="notifications-outline" size={24} color="#64748b" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Online/Offline Toggle */}
        <View style={styles.section}>
          <View style={styles.statusCard}>
            <View style={styles.statusContent}>
              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  Status: {isOnline ? "Online" : "Offline"}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {statusInfo?.workingTimeDescription ||
                    (isOnline
                      ? "Receiving requests nearby"
                      : "Not receiving requests")}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleContainer,
                  isOnline && styles.toggleContainerActive,
                  togglingStatus && styles.toggleContainerDisabled,
                ]}
                onPress={() => handleToggleOnline(false)}
                disabled={togglingStatus}
              >
                {togglingStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View
                    style={[
                      styles.toggleThumb,
                      isOnline && styles.toggleThumbActive,
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Status Messages from status-info */}
            {statusInfo && !statusInfo.shouldBeActive && (
              <View style={styles.statusMessageBanner}>
                <Ionicons name="time-outline" size={16} color="#d97706" />
                <Text style={styles.statusMessageText}>
                  ⏰ You are currently outside your working hours. You'll be
                  able to accept deliveries during your scheduled time.
                </Text>
              </View>
            )}

            {statusInfo && statusInfo.shouldBeActive && !isOnline && (
              <View
                style={[styles.statusMessageBanner, styles.statusMessageInfo]}
              >
                <Ionicons name="bulb-outline" size={16} color="#3b82f6" />
                <Text
                  style={[
                    styles.statusMessageText,
                    styles.statusMessageTextInfo,
                  ]}
                >
                  💡 You're within your working hours. Activate your status to
                  start receiving delivery requests.
                </Text>
              </View>
            )}

            {statusInfo && statusInfo.isActive && (
              <View
                style={[
                  styles.statusMessageBanner,
                  styles.statusMessageSuccess,
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color="#06C168" />
                <Text
                  style={[
                    styles.statusMessageText,
                    styles.statusMessageTextSuccess,
                  ]}
                >
                  ✅ You are active and can receive delivery requests!
                </Text>
              </View>
            )}

            {/* Working Hours Status */}
            {driverProfile?.working_time &&
              driverProfile.working_time !== "full_time" && (
                <View
                  style={[
                    styles.workingHoursStatus,
                    withinWorkingHours
                      ? styles.workingHoursStatusActive
                      : manualOverrideActive
                        ? styles.workingHoursStatusWarning
                        : styles.workingHoursStatusInactive,
                  ]}
                >
                  <Ionicons
                    name={
                      withinWorkingHours ? "checkmark-circle" : "time-outline"
                    }
                    size={16}
                    color={
                      withinWorkingHours
                        ? "#06C168"
                        : manualOverrideActive
                          ? "#d97706"
                          : "#64748b"
                    }
                  />
                  <Text
                    style={[
                      styles.workingHoursText,
                      withinWorkingHours
                        ? styles.workingHoursTextActive
                        : manualOverrideActive
                          ? styles.workingHoursTextWarning
                          : styles.workingHoursTextInactive,
                    ]}
                  >
                    {withinWorkingHours
                      ? "Within working hours"
                      : manualOverrideActive
                        ? "Manual override active (outside working hours)"
                        : "Outside working hours"}
                  </Text>
                </View>
              )}

            {/* Next Status Change Info */}
            {statusInfo?.nextStatusChange && (
              <View style={styles.nextStatusChangeInfo}>
                <Text style={styles.nextStatusChangeText}>
                  Next automatic status change:{" "}
                  {new Date(statusInfo.nextStatusChange).toLocaleTimeString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Earnings</Text>
            <Text style={styles.statValue}>
              Rs. {stats.todayEarnings.toFixed(0)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Deliveries</Text>
            <Text style={styles.statValueBlack}>{stats.todayDeliveries}</Text>
          </View>
        </View>

        {/* Active Deliveries Section */}
        {activeDeliveries.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Active Deliveries ({activeDeliveries.length})
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("ActiveDeliveries")}
              >
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.section}>
              {activeDeliveries.slice(0, 3).map((delivery) => (
                <TouchableOpacity
                  key={delivery.id}
                  style={styles.activeDeliveryCard}
                  onPress={() => navigation.navigate("ActiveDeliveries")}
                >
                  <View style={styles.activeDeliveryIcon}>
                    <Ionicons
                      name={
                        delivery.status === "accepted"
                          ? "restaurant"
                          : delivery.status === "picked_up"
                            ? "bicycle"
                            : delivery.status === "on_the_way"
                              ? "car"
                              : "location"
                      }
                      size={24}
                      color="#d97706"
                    />
                  </View>
                  <View style={styles.activeDeliveryInfo}>
                    <Text style={styles.activeDeliveryRestaurant}>
                      {delivery.orders?.restaurant_name || "Restaurant"}
                    </Text>
                    <Text style={styles.activeDeliveryOrder}>
                      Order #{delivery.orders?.order_number || "N/A"}
                    </Text>
                    <Text style={styles.activeDeliveryStatus}>
                      {delivery.status?.replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </View>
            {!isOnline && activeDeliveries.length > 0 && (
              <View style={styles.warningBanner}>
                <Ionicons name="information-circle" size={18} color="#d97706" />
                <Text style={styles.warningText}>
                  You're offline but have active deliveries. Complete these
                  deliveries to receive your earnings.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Nearby Requests Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Nearby Requests ({availableDeliveries.length})
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("AvailableDeliveries")}
          >
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Nearby Requests List */}
        <View style={styles.section}>
          {!isOnline ? (
            activeDeliveries.length > 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="hourglass-outline" size={56} color="#f59e0b" />
                <Text style={styles.emptyStateTitle}>
                  Complete your active deliveries
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  You can go online after completing current deliveries
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="wifi-off"
                  size={64}
                  color="#cbd5e1"
                />
                <Text style={styles.emptyStateTitle}>
                  You're currently offline
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Go online to receive delivery requests
                </Text>
              </View>
            )
          ) : availableDeliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyStateTitle}>No requests nearby</Text>
              <Text style={styles.emptyStateSubtext}>
                New orders will appear here
              </Text>
            </View>
          ) : (
            availableDeliveries.slice(0, 5).map((delivery, index) => (
              <View key={delivery.delivery_id} style={styles.deliveryCard}>
                <View style={styles.deliveryHeader}>
                  <View style={styles.deliveryHeaderLeft}>
                    <View style={styles.deliveryBadges}>
                      {index === 0 && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW ORDER</Text>
                        </View>
                      )}
                      {delivery.orders?.length > 1 && (
                        <View style={styles.bulkBadge}>
                          <Text style={styles.bulkBadgeText}>BULK ORDER</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.distanceText}>
                      {calculateDistance(delivery)} km away
                    </Text>
                    <Text style={styles.earningsAmount}>
                      Rs. {getDeliveryEarnings(delivery)}
                    </Text>
                    {parseFloat(delivery.pricing?.tip_amount || 0) > 0 && (
                      <View style={styles.tipBadge}>
                        <Text style={styles.tipEmoji}>💰</Text>
                        <Text style={styles.tipText}>
                          +Rs.
                          {parseFloat(delivery.pricing.tip_amount).toFixed(
                            0,
                          )}{" "}
                          tip included
                        </Text>
                      </View>
                    )}
                    <View style={styles.restaurantInfo}>
                      <Ionicons name="storefront" size={18} color="#64748b" />
                      <Text style={styles.restaurantName}>
                        {delivery.restaurant?.name ||
                          delivery.restaurant_name ||
                          "Restaurant"}
                      </Text>
                    </View>
                    {getEstimatedTime(delivery) > 0 && (
                      <Text style={styles.estimatedTime}>
                        ~{getEstimatedTime(delivery)} mins
                      </Text>
                    )}
                  </View>
                  <MiniDeliveryMap delivery={delivery} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    acceptingOrder === delivery.delivery_id &&
                      styles.acceptButtonDisabled,
                  ]}
                  onPress={() => handleAcceptDelivery(delivery.delivery_id)}
                  disabled={acceptingOrder === delivery.delivery_id}
                >
                  {acceptingOrder === delivery.delivery_id ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.acceptButtonText}>Accepting...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#fff"
                      />
                      <Text style={styles.acceptButtonText}>
                        Accept Request
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Monthly Performance Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Performance</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.monthlyEarningsCard]}>
            <Text style={styles.monthlyStatLabel}>Month Earnings</Text>
            <Text style={styles.monthlyStatValue}>
              Rs. {monthlyStats.earnings.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.statCard, styles.monthlyDeliveriesCard]}>
            <Text style={styles.monthlyStatLabel}>Month Deliveries</Text>
            <Text style={styles.monthlyStatValue}>
              {monthlyStats.deliveries}
            </Text>
          </View>
        </View>

        {/* Recent Deliveries Section */}
        {recentDeliveries.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Deliveries</Text>
            </View>
            <View style={styles.section}>
              {recentDeliveries.map((delivery) => (
                <View key={delivery.id} style={styles.recentDeliveryCard}>
                  <View style={styles.recentDeliveryIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#06C168"
                    />
                  </View>
                  <View style={styles.recentDeliveryInfo}>
                    <Text style={styles.recentDeliveryRestaurant}>
                      {delivery.restaurant_name || "Restaurant"}
                    </Text>
                    <Text style={styles.recentDeliveryOrder}>
                      Order #{delivery.order_number || "N/A"}
                    </Text>
                    <Text style={styles.recentDeliveryEarnings}>
                      Rs. {parseFloat(delivery.driver_earnings || 0).toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.recentDeliveryTime}>
                    <Text style={styles.recentDeliveryDate}>
                      {delivery.delivered_at
                        ? new Date(delivery.delivered_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )
                        : ""}
                    </Text>
                    <Text style={styles.recentDeliveryTimeText}>
                      {delivery.delivered_at
                        ? new Date(delivery.delivered_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert("Logout", "Are you sure you want to logout?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Logout",
                style: "destructive",
                onPress: async () => await logout(),
              },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  scrollView: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  profileSubtext: {
    fontSize: 12,
    color: "#64748b",
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#06C168",
    borderWidth: 2,
    borderColor: "#fff",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  toggleContainer: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: "#cbd5e1",
    padding: 2,
    justifyContent: "center",
  },
  toggleContainerActive: {
    backgroundColor: "#06C168",
  },
  toggleContainerDisabled: {
    opacity: 0.6,
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  statusMessageBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  statusMessageInfo: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  },
  statusMessageSuccess: {
    backgroundColor: "#B8F0D0",
    borderColor: "#6EDE9A",
  },
  statusMessageText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
    lineHeight: 18,
  },
  statusMessageTextInfo: {
    color: "#1e40af",
  },
  statusMessageTextSuccess: {
    color: "#04553C",
  },
  nextStatusChangeInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  nextStatusChangeText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
  workingHoursStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  workingHoursStatusActive: {
    backgroundColor: "#B8F0D0",
    borderColor: "#6EDE9A",
  },
  workingHoursStatusWarning: {
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
  },
  workingHoursStatusInactive: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  workingHoursText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  workingHoursTextActive: {
    color: "#06C168",
  },
  workingHoursTextWarning: {
    color: "#d97706",
  },
  workingHoursTextInactive: {
    color: "#64748b",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: -0.5,
  },
  statValueBlack: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#06C168",
  },
  activeDeliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activeDeliveryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fde68a",
    justifyContent: "center",
    alignItems: "center",
  },
  activeDeliveryInfo: {
    flex: 1,
  },
  activeDeliveryRestaurant: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  activeDeliveryOrder: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  activeDeliveryStatus: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d97706",
    textTransform: "capitalize",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400e",
  },
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  deliveryHeaderLeft: {
    flex: 1,
  },
  deliveryBadges: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  newBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: 0.5,
  },
  bulkBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  bulkBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef9c3",
    borderWidth: 1,
    borderColor: "#fde047",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  tipEmoji: {
    fontSize: 12,
  },
  tipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#854d0e",
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  estimatedTime: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  miniMapContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  miniMapPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#06C168",
    borderRadius: 12,
    height: 48,
    shadowColor: "#06C168",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  monthlyEarningsCard: {
    backgroundColor: "#dcfce7",
    borderColor: "#6EDE9A",
  },
  monthlyDeliveriesCard: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  },
  monthlyStatLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#046B4D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  monthlyStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#046B4D",
    letterSpacing: -0.5,
  },
  recentDeliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recentDeliveryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#B8F0D0",
    justifyContent: "center",
    alignItems: "center",
  },
  recentDeliveryInfo: {
    flex: 1,
  },
  recentDeliveryRestaurant: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  recentDeliveryOrder: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  recentDeliveryEarnings: {
    fontSize: 12,
    fontWeight: "600",
    color: "#06C168",
  },
  recentDeliveryTime: {
    alignItems: "flex-end",
  },
  recentDeliveryDate: {
    fontSize: 12,
    color: "#94a3b8",
  },
  recentDeliveryTimeText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
  },
  modalBold: {
    fontWeight: "700",
  },
  modalSubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#06C168",
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  statusToast: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  statusToastText: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#dc2626",
  },
});
