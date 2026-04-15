/**
 * Driver Dashboard Screen
 *
 * Features:
 * - Online/Offline status toggle with working time validation
 * - Today's earnings and deliveries stats
 * - Active time tracking
 * - Nearby delivery requests list
 * - Working time based status (full_time, day, night)
 * - Manual override for outside working hours
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
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
import OptimizedImage from "../../components/common/OptimizedImage";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import { useDriverDeliveryNotifications } from "../../context/DriverDeliveryNotificationContext";
import { useSocket } from "../../context/SocketContext";
import { approximateDistanceMeters } from "../../utils/osrmClient";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";
import SplashScreen from "../SplashScreen";

// Working time display labels
const WORKING_TIME_LABELS = {
  full_time: "Full Time",
  day: "Day Shift (5AM - 7PM)",
  night: "Night Shift (6PM - 6AM)",
};

// Default driver location (Kinniya, Sri Lanka)
const AVAILABLE_CACHE_KEY = "available_deliveries_cache";
const AVAILABLE_CACHE_EXPIRY = 60000;
const DASHBOARD_ASYNC_CACHE_KEY = "driver_dashboard_snapshot_cache";
const DASHBOARD_ASYNC_CACHE_EXPIRY = 120000;
const LOCATION_MAX_ACCURACY_METERS = 250;
const LOCATION_MAX_RETRIES = 3;
const LOCATION_RETRY_DELAY_MS = 1200;
const DRIVER_STATUS_ENDPOINT = "/driver/working-hours-status";
const NEARBY_PAGE_SIZE = 5;
const DASHBOARD_CACHE_KEY = ["driver", "dashboard", "snapshot"];
const AVAILABLE_SYNC_MOVEMENT_THRESHOLD = 200;
const LIVE_LOCATION_NEARBY_REFRESH_INTERVAL_MS = 5000;
const DRIVER_STATUS_FOCUS_SIGNAL_KEY = "driver_status_focus_signal";
const DRIVER_STATUS_FOCUS_WINDOW_MS = 120000;
const DRIVER_PROFILE_CACHE_KEY = "driver_profile_cache";
const DASHBOARD_UI_CACHE_KEY = ["driver", "dashboard", "ui-state"];

// Full-screen skeleton should only appear on the first visit to this screen.
let hasVisitedDriverDashboardScreen = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const isValidLocation = (location) => {
  if (!location) return false;
  const { latitude, longitude } = location;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
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

const loadAvailableCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(AVAILABLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;
    return {
      isFresh: Date.now() - parsed.timestamp < AVAILABLE_CACHE_EXPIRY,
      data: parsed.data,
    };
  } catch (e) {
    return null;
  }
};

const saveAvailableCache = async (payload) => {
  try {
    await AsyncStorage.setItem(
      AVAILABLE_CACHE_KEY,
      JSON.stringify({ data: payload, timestamp: Date.now() }),
    );
  } catch (e) {
    // no-op
  }
};

const loadDashboardAsyncCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_ASYNC_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;
    return {
      isFresh: Date.now() - parsed.timestamp < DASHBOARD_ASYNC_CACHE_EXPIRY,
      data: parsed.data,
    };
  } catch (e) {
    return null;
  }
};

const saveDashboardAsyncCache = async (payload) => {
  try {
    await AsyncStorage.setItem(
      DASHBOARD_ASYNC_CACHE_KEY,
      JSON.stringify({ data: payload, timestamp: Date.now() }),
    );
  } catch (e) {
    // no-op
  }
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardScreen({ navigation }) {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { on, off } = useSocket();
  const { logout } = useAuth();
  const initialUiState = queryClient.getQueryData(DASHBOARD_UI_CACHE_KEY);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof initialUiState?.isOnline === "boolean") {
      return initialUiState.isOnline;
    }
    return false;
  });
  const [statusInfo, setStatusInfo] = useState(null);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayDeliveries: 0,
  });
  const [balanceToReceive, setBalanceToReceive] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState({
    earnings: 0,
    deliveries: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [availableDeliveries, setAvailableDeliveries] = useState([]);
  const [nearbyVisibleCount, setNearbyVisibleCount] =
    useState(NEARBY_PAGE_SIZE);
  const [isNearbySyncing, setIsNearbySyncing] = useState(false);
  const [hasNearbyInitialSyncCompleted, setHasNearbyInitialSyncCompleted] =
    useState(false);
  const [nearbySyncError, setNearbySyncError] = useState(null);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverProfile, setDriverProfile] = useState(
    () => initialUiState?.driverProfile || null,
  );
  const [driverLocation, setDriverLocation] = useState(null);
  const [acceptingOrder, setAcceptingOrder] = useState(null);
  const [withinWorkingHours, setWithinWorkingHours] = useState(
    typeof initialUiState?.withinWorkingHours === "boolean"
      ? initialUiState.withinWorkingHours
      : true,
  );
  const [manualOverrideActive, setManualOverrideActive] = useState(
    Boolean(initialUiState?.manualOverrideActive),
  );
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [hasDashboardSnapshot, setHasDashboardSnapshot] = useState(false);
  const [alert, setAlert] = useState({
    visible: false,
    type: "info",
    message: "",
  });
  const statusToastAnim = useRef(new Animated.Value(0)).current;
  const dashboardContentFadeAnim = useRef(new Animated.Value(1)).current;

  // Driver notification context - to sync online status
  const { setDriverOnline } = useDriverDeliveryNotifications();

  const workingHoursCheckRef = useRef(null);
  const driverLocationRef = useRef(null);
  const nearbyLastSyncLocationRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const nearbySyncInFlightRef = useRef(false);

  const isFullTimeDriver = useMemo(() => {
    const workingTime = String(
      driverProfile?.working_time || statusInfo?.working_time || "",
    )
      .trim()
      .toLowerCase();
    return workingTime === "full_time";
  }, [driverProfile?.working_time, statusInfo?.working_time]);

  const writeDashboardUiState = useCallback(
    (patch) => {
      queryClient.setQueryData(DASHBOARD_UI_CACHE_KEY, (prev) => ({
        ...(prev || {}),
        ...(patch || {}),
      }));
    },
    [queryClient],
  );

  const applyDashboardSnapshot = useCallback((snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;

    setStats(snapshot.stats || { todayEarnings: 0, todayDeliveries: 0 });
    setMonthlyStats(snapshot.monthlyStats || { earnings: 0, deliveries: 0 });
    setRecentDeliveries(snapshot.recentDeliveries || []);
    setActiveDeliveries(snapshot.activeDeliveries || []);
    setBalanceToReceive(Number(snapshot.balanceToReceive || 0));
    setHasDashboardSnapshot(true);
  }, []);

  const consumeStatusFocusSignal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRIVER_STATUS_FOCUS_SIGNAL_KEY);
      if (!raw) return null;

      await AsyncStorage.removeItem(DRIVER_STATUS_FOCUS_SIGNAL_KEY);
      const parsed = JSON.parse(raw);
      const timestamp = Number(parsed?.timestamp || 0);
      if (
        !timestamp ||
        Date.now() - timestamp > DRIVER_STATUS_FOCUS_WINDOW_MS
      ) {
        return null;
      }

      const status = String(parsed?.status || "")
        .trim()
        .toLowerCase();
      if (!status) return null;

      return {
        status,
        delivery_id: parsed?.delivery_id || null,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const applySnapshot = (snapshot) => {
      if (!snapshot || !Array.isArray(snapshot.deliveries)) return;

      const next = snapshot.deliveries.filter(hasValidDeliveryCoordinates);
      setAvailableDeliveries(next);
      setHasNearbyInitialSyncCompleted(true);
    };

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const query = event?.query;
      if (!query) return;

      const key = query.queryKey;
      if (!Array.isArray(key)) return;
      if (key[0] !== "driver" || key[1] !== "available-deliveries") return;

      const data = query.state?.data;
      if (!data) return;
      applySnapshot(data);
    });

    const existing = queryClient.getQueriesData({
      queryKey: ["driver", "available-deliveries"],
    });
    for (let i = existing.length - 1; i >= 0; i -= 1) {
      const snapshot = existing[i]?.[1];
      if (snapshot?.deliveries) {
        applySnapshot(snapshot);
        break;
      }
    }

    return () => unsubscribe();
  }, [queryClient]);

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
    writeDashboardUiState({ isOnline });
  }, [isOnline, setDriverOnline, writeDashboardUiState]);

  // ============================================================================
  // RESTORE ONLINE STATUS ON MOUNT
  // 1. Immediately restore from AsyncStorage (fast, cached)
  // 2. Then fetch from server (authoritative, may override)
  // ============================================================================

  useEffect(() => {
    (async () => {
      try {
        const cachedProfileRaw = await AsyncStorage.getItem(
          DRIVER_PROFILE_CACHE_KEY,
        );
        if (cachedProfileRaw) {
          const cachedProfile = JSON.parse(cachedProfileRaw);
          if (cachedProfile && typeof cachedProfile === "object") {
            setDriverProfile((prev) => prev || cachedProfile);
            writeDashboardUiState({
              driverProfile: cachedProfile,
              withinWorkingHours:
                cachedProfile?.working_time === "full_time"
                  ? true
                  : withinWorkingHours,
            });
          }
        }

        // Step 1: Restore cached status instantly so UI doesn't flash offline
        const savedStatus = await AsyncStorage.getItem("driver_is_online");
        if (savedStatus !== null) {
          const restored = JSON.parse(savedStatus);
          setIsOnline(restored);
          setDriverOnline(restored);
          writeDashboardUiState({ isOnline: restored });
        }
      } catch (e) {
        console.error("Failed to restore driver status:", e);
      } finally {
        // Step 2: Mark initialized so sync effect can start working
        hasInitializedRef.current = true;
      }
    })();
  }, [setDriverOnline, withinWorkingHours, writeDashboardUiState]);

  // ============================================================================
  // FETCH STATUS INFO (matches web version)
  // ============================================================================

  const fetchStatusInfo = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        return;
      }

      const res = await rateLimitedFetch(
        `${API_URL}${DRIVER_STATUS_ENDPOINT}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();

        const normalizedStatus = String(
          data?.currentStatus || data?.driver_status || data?.status || "",
        )
          .trim()
          .toLowerCase();

        const isFullTime =
          String(data?.working_time || "")
            .trim()
            .toLowerCase() === "full_time";

        const withinHoursValue = isFullTime
          ? true
          : typeof data?.within_working_hours === "boolean"
            ? data.within_working_hours
            : typeof data?.shouldBeActive === "boolean"
              ? data.shouldBeActive
              : false;

        const shouldBeActive = isFullTime
          ? normalizedStatus === "active"
          : typeof data?.shouldBeActive === "boolean"
            ? data.shouldBeActive
            : withinHoursValue || Boolean(data?.manual_override);

        const canToggleToActive = isFullTime
          ? true
          : typeof data?.canToggleToActive === "boolean"
            ? data.canToggleToActive
            : shouldBeActive;

        const canToggleToInactive = isFullTime
          ? true
          : typeof data?.canToggleToInactive === "boolean"
            ? data.canToggleToInactive
            : true;

        setStatusInfo({
          ...data,
          currentStatus: normalizedStatus,
          shouldBeActive,
          canToggleToActive,
          canToggleToInactive,
        });

        if (normalizedStatus === "active" || normalizedStatus === "inactive") {
          const serverOnline = normalizedStatus === "active";
          setIsOnline(serverOnline);
          // Sync server truth to storage & notification context
          AsyncStorage.setItem(
            "driver_is_online",
            JSON.stringify(serverOnline),
          );
          setDriverOnline(serverOnline);
          writeDashboardUiState({ isOnline: serverOnline });
        }

        setWithinWorkingHours(withinHoursValue);
        writeDashboardUiState({ withinWorkingHours: withinHoursValue });
      }
    } catch (error) {
      console.error("Status info fetch error:", error);
    }
  }, [setDriverOnline, writeDashboardUiState]);

  // ============================================================================
  // FETCH DRIVER PROFILE
  // ============================================================================

  const fetchDriverProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        // Keep current session state during transient storage read issues.
        return;
      }

      const res = await rateLimitedFetch(`${API_URL}/driver/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        await logout();
        return;
      }

      if (res.status === 404 || res.status === 429) {
        console.warn("Driver profile fetch skipped", { status: res.status });
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setDriverProfile(data.driver);
        // Don't set isOnline here anymore - use working-hours-status endpoint
        const isFullTime = data?.driver?.working_time === "full_time";
        setManualOverrideActive(
          isFullTime ? false : data.driver.manual_status_override || false,
        );
        setWithinWorkingHours(
          isFullTime
            ? true
            : typeof data?.driver?.within_working_hours === "boolean"
              ? data.driver.within_working_hours
              : withinWorkingHours,
        );

        await AsyncStorage.setItem(
          DRIVER_PROFILE_CACHE_KEY,
          JSON.stringify(data.driver),
        );
        writeDashboardUiState({
          driverProfile: data.driver,
          manualOverrideActive: isFullTime
            ? false
            : data.driver.manual_status_override || false,
          withinWorkingHours: isFullTime
            ? true
            : typeof data?.driver?.within_working_hours === "boolean"
              ? data.driver.within_working_hours
              : withinWorkingHours,
        });
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
    }
  }, [logout, withinWorkingHours, writeDashboardUiState]);

  // ============================================================================
  // CHECK WORKING HOURS STATUS
  // ============================================================================

  const checkWorkingHoursStatus = useCallback(async () => {
    try {
      if (isFullTimeDriver) {
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        return;
      }
      const res = await rateLimitedFetch(
        `${API_URL}/driver/working-hours-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();

        const normalizedStatus = String(
          data?.currentStatus || data?.driver_status || data?.status || "",
        )
          .trim()
          .toLowerCase();

        const withinHoursValue =
          typeof data?.within_working_hours === "boolean"
            ? data.within_working_hours
            : typeof data?.shouldBeActive === "boolean"
              ? data.shouldBeActive
              : false;

        const shouldBeActive =
          typeof data?.shouldBeActive === "boolean"
            ? data.shouldBeActive
            : withinHoursValue || Boolean(data?.manual_override);

        setStatusInfo((prev) => ({
          ...(prev || {}),
          ...data,
          currentStatus: normalizedStatus,
          shouldBeActive,
          canToggleToActive:
            typeof data?.canToggleToActive === "boolean"
              ? data.canToggleToActive
              : shouldBeActive,
          canToggleToInactive:
            typeof data?.canToggleToInactive === "boolean"
              ? data.canToggleToInactive
              : true,
        }));

        setWithinWorkingHours(withinHoursValue);
        setManualOverrideActive(Boolean(data.manual_override));
        writeDashboardUiState({
          withinWorkingHours: withinHoursValue,
          manualOverrideActive: Boolean(data.manual_override),
        });

        if (data.auto_updated) {
          setIsOnline(normalizedStatus === "active");
          writeDashboardUiState({ isOnline: normalizedStatus === "active" });
          setStatusMessage(
            data.message || "Status changed due to working hours",
          );
          setTimeout(() => setStatusMessage(""), 5000);
        }
      }
    } catch (error) {
      console.error("Working hours check error:", error);
    }
  }, [isFullTimeDriver, writeDashboardUiState]);

  // ============================================================================
  // FETCH DASHBOARD DATA
  // ============================================================================

  const resolveVerifiedDriverLocation = useCallback(
    async (forceFresh = false) => {
      if (!forceFresh && isValidLocation(driverLocationRef.current)) {
        return driverLocationRef.current;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return null;
      }

      for (let attempt = 1; attempt <= LOCATION_MAX_RETRIES; attempt += 1) {
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

        if (
          isValidLocation(candidate) &&
          accuracy <= LOCATION_MAX_ACCURACY_METERS
        ) {
          return candidate;
        }

        if (attempt < LOCATION_MAX_RETRIES) {
          await sleep(LOCATION_RETRY_DELAY_MS);
        }
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 10000,
        requiredAccuracy: LOCATION_MAX_ACCURACY_METERS,
      });

      if (lastKnown) {
        const fallback = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        if (isValidLocation(fallback)) {
          return fallback;
        }
      }

      return null;
    },
    [],
  );

  const syncAvailableDeliveriesInBackground = useCallback(
    async (token, reason = "dashboard_open", options = {}) => {
      if (nearbySyncInFlightRef.current) return;

      const forceSync = Boolean(options?.forceSync);
      const forceFreshLocation = Boolean(options?.forceFreshLocation);

      const forceReasons = new Set([
        "new_delivery",
        "tip_updated",
        "delivery_accepted",
      ]);

      const currentLocation =
        await resolveVerifiedDriverLocation(forceFreshLocation);
      if (!isValidLocation(currentLocation)) {
        setNearbySyncError("Unable to confirm your location.");
        return;
      }

      const movedDistance = nearbyLastSyncLocationRef.current
        ? approximateDistanceMeters(
            nearbyLastSyncLocationRef.current,
            currentLocation,
          )
        : Infinity;

      const shouldSync =
        forceSync ||
        forceReasons.has(reason) ||
        !hasNearbyInitialSyncCompleted ||
        movedDistance >= AVAILABLE_SYNC_MOVEMENT_THRESHOLD;

      if (!shouldSync) {
        return;
      }

      nearbySyncInFlightRef.current = true;
      setIsNearbySyncing(true);
      setNearbySyncError(null);

      try {
        driverLocationRef.current = currentLocation;
        setDriverLocation(currentLocation);

        const availableRes = await rateLimitedFetch(
          `${API_URL}/driver/deliveries/available/v2?driver_latitude=${currentLocation.latitude}&driver_longitude=${currentLocation.longitude}&trigger_reason=${encodeURIComponent(reason)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!availableRes.ok) {
          throw new Error(
            `Available deliveries sync failed (${availableRes.status})`,
          );
        }

        const deliveriesData = await availableRes.json();
        const nextAvailableRaw =
          deliveriesData.available_deliveries ||
          deliveriesData.deliveries ||
          [];
        const nextAvailable = nextAvailableRaw.filter(
          hasValidDeliveryCoordinates,
        );

        setAvailableDeliveries(nextAvailable);

        const payload = {
          deliveries: nextAvailable,
          currentRoute: deliveriesData.current_route || {
            total_stops: 0,
            active_deliveries: 0,
          },
          driverLocation: currentLocation,
        };

        await saveAvailableCache(payload);
        queryClient.setQueriesData(
          { queryKey: ["driver", "available-deliveries"] },
          payload,
        );
        setHasNearbyInitialSyncCompleted(true);
        nearbyLastSyncLocationRef.current = currentLocation;
      } catch (error) {
        console.error("Available deliveries background sync error:", error);
        setNearbySyncError(error.message || "Failed to update nearby requests");
      } finally {
        setIsNearbySyncing(false);
        nearbySyncInFlightRef.current = false;
      }
    },
    [queryClient, resolveVerifiedDriverLocation, hasNearbyInitialSyncCompleted],
  );

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        // Do not force logout on transient token read issues.
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const statusFocusSignal = await consumeStatusFocusSignal();

      const cachedDashboard = queryClient.getQueryData(DASHBOARD_CACHE_KEY);
      if (cachedDashboard) {
        applyDashboardSnapshot(cachedDashboard);
        setLoading(false);
      } else {
        const dashboardAsyncCache = await loadDashboardAsyncCache();
        if (dashboardAsyncCache?.data) {
          applyDashboardSnapshot(dashboardAsyncCache.data);
          setLoading(false);
        }
      }

      const cachedAvailable = await loadAvailableCache();
      if (Array.isArray(cachedAvailable?.data?.deliveries)) {
        const cachedDeliveries = (cachedAvailable.data.deliveries || []).filter(
          hasValidDeliveryCoordinates,
        );
        setAvailableDeliveries(cachedDeliveries);
        setHasNearbyInitialSyncCompleted(true);
      }

      const headers = { Authorization: `Bearer ${token}` };
      let nextStats = cachedDashboard?.stats || {
        todayEarnings: 0,
        todayDeliveries: 0,
      };
      let nextMonthlyStats = cachedDashboard?.monthlyStats || {
        earnings: 0,
        deliveries: 0,
      };
      let nextRecentDeliveries = cachedDashboard?.recentDeliveries || [];
      let nextActiveDeliveries = cachedDashboard?.activeDeliveries || [];
      let nextBalanceToReceive = Number(cachedDashboard?.balanceToReceive || 0);

      // Batch all dashboard API calls in parallel
      const [
        statsRes,
        monthlyStatsRes,
        recentRes,
        activeDeliveriesRes,
        withdrawalsSummaryRes,
      ] = await Promise.all([
        rateLimitedFetch(`${API_URL}/driver/stats/today`, { headers }),
        rateLimitedFetch(`${API_URL}/driver/stats/monthly`, { headers }),
        rateLimitedFetch(`${API_URL}/driver/deliveries/recent?limit=5`, {
          headers,
        }),
        rateLimitedFetch(`${API_URL}/driver/deliveries/active`, { headers }),
        rateLimitedFetch(`${API_URL}/driver/withdrawals/my/summary`, {
          headers,
        }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        nextStats = {
          todayEarnings: statsData.earnings || 0,
          todayDeliveries: statsData.deliveries || 0,
        };
        setStats(nextStats);
      }

      if (monthlyStatsRes.ok) {
        const monthlyData = await monthlyStatsRes.json();
        nextMonthlyStats = {
          earnings: monthlyData.earnings || 0,
          deliveries: monthlyData.deliveries || 0,
        };
        setMonthlyStats(nextMonthlyStats);
      }

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        nextRecentDeliveries = recentData.deliveries || [];
        setRecentDeliveries(nextRecentDeliveries);
      }

      if (activeDeliveriesRes.ok) {
        const activeDeliveriesData = await activeDeliveriesRes.json();
        nextActiveDeliveries = activeDeliveriesData.deliveries || [];
        setActiveDeliveries(nextActiveDeliveries);
      }

      if (
        statusFocusSignal?.status === "picked_up" ||
        statusFocusSignal?.status === "delivered"
      ) {
        // Swipe-driven status changes should prioritize active workflow freshness first.
        setHasNearbyInitialSyncCompleted(true);
      } else {
        syncAvailableDeliveriesInBackground(token, "dashboard_open");
      }

      if (withdrawalsSummaryRes.ok) {
        const withdrawalsSummaryData = await withdrawalsSummaryRes.json();
        nextBalanceToReceive = Number(
          withdrawalsSummaryData?.summary?.remaining_balance || 0,
        );
        setBalanceToReceive(nextBalanceToReceive);
      }

      queryClient.setQueryData(DASHBOARD_CACHE_KEY, {
        stats: nextStats,
        monthlyStats: nextMonthlyStats,
        recentDeliveries: nextRecentDeliveries,
        activeDeliveries: nextActiveDeliveries,
        balanceToReceive: nextBalanceToReceive,
      });

      saveDashboardAsyncCache({
        stats: nextStats,
        monthlyStats: nextMonthlyStats,
        recentDeliveries: nextRecentDeliveries,
        activeDeliveries: nextActiveDeliveries,
        balanceToReceive: nextBalanceToReceive,
      }).catch(() => {});
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      hasVisitedDriverDashboardScreen = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    navigation,
    queryClient,
    syncAvailableDeliveriesInBackground,
    applyDashboardSnapshot,
    consumeStatusFocusSignal,
  ]);

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

  useEffect(() => {
    if (!isFocused) return;

    fetchStatusInfo();
    fetchDashboardData();
  }, [isFocused, fetchStatusInfo, fetchDashboardData]);

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

  useEffect(() => {
    if (!isFocused) return;

    const interval = setInterval(async () => {
      const token = await getAccessToken();
      if (!token) return;

      syncAvailableDeliveriesInBackground(token, "live_location_tick", {
        forceSync: true,
        forceFreshLocation: true,
      });
    }, LIVE_LOCATION_NEARBY_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isFocused, syncAvailableDeliveriesInBackground]);

  useEffect(() => {
    if (!on || !off) return;

    const handleNewDelivery = async () => {
      if (!isFocused) return;
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      syncAvailableDeliveriesInBackground(token, "new_delivery");
    };

    const handleTipUpdated = async () => {
      if (!isFocused) return;
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      syncAvailableDeliveriesInBackground(token, "tip_updated");
    };

    const handleDeliveryTaken = (payload) => {
      const deliveryId = payload?.delivery_id;
      if (!deliveryId) return;

      setAvailableDeliveries((prev) => {
        const next = prev.filter((d) => d.delivery_id !== deliveryId);
        const cachedSnapshots = queryClient.getQueriesData({
          queryKey: ["driver", "available-deliveries"],
        });
        const latestSnapshot =
          cachedSnapshots?.[cachedSnapshots.length - 1]?.[1];

        const payloadForCache = {
          deliveries: next,
          currentRoute: latestSnapshot?.currentRoute || {
            total_stops: 0,
            active_deliveries: 0,
          },
          driverLocation: driverLocationRef.current,
        };

        queryClient.setQueriesData(
          { queryKey: ["driver", "available-deliveries"] },
          payloadForCache,
        );
        saveAvailableCache(payloadForCache).catch(() => {});
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
  }, [on, off, isFocused, queryClient, syncAvailableDeliveriesInBackground]);

  // ============================================================================
  // WORKING HOURS CHECK (every minute)
  // ============================================================================

  useEffect(() => {
    workingHoursCheckRef.current = setInterval(() => {
      if (isFocused && !isFullTimeDriver) checkWorkingHoursStatus();
    }, 120000); // Every 2 minutes (was 1 minute)
    return () => {
      if (workingHoursCheckRef.current) {
        clearInterval(workingHoursCheckRef.current);
      }
    };
  }, [checkWorkingHoursStatus, isFullTimeDriver, isFocused]);

  // ============================================================================
  // TOGGLE ONLINE STATUS (Enhanced to match web version)
  // ============================================================================

  const handleToggleOnline = async (manualOverride = false) => {
    const newStatus = !isOnline;

    // Check if toggle is allowed using status info
    if (statusInfo) {
      const canToggle = isFullTimeDriver
        ? true
        : newStatus
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
      if (!token) {
        showError("Session unavailable. Please wait and try again.");
        return;
      }

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
        writeDashboardUiState({ isOnline: data.status === "active" });
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
    if (isNearbySyncing) {
      showError("Requests are updating. Please wait a moment.");
      return;
    }

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
        syncAvailableDeliveriesInBackground(token, "delivery_accepted");
        navigation.navigate("DriverMap", { deliveryId });
      } else {
        const data = await res.json();
        if (data?.driver_status === "suspended") {
          Alert.alert(
            "Account Suspended",
            data.message ||
              "Deposit the collected money to the Meezo platform before accepting new deliveries.",
          );
        }
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

  const openActiveMap = () => {
    navigation.navigate("DriverMap");
  };

  const isFirstDeliveryRequest = useCallback((delivery) => {
    const routeImpact = delivery?.route_impact || {};

    if (routeImpact.is_first_delivery === true) return true;
    if (routeImpact.is_first_delivery === false) return false;

    const sequence = Number(
      routeImpact.delivery_sequence ?? delivery?.delivery_sequence ?? 1,
    );

    if (Number.isFinite(sequence)) {
      return sequence <= 1;
    }

    return true;
  }, []);

  const getDeliveryEarnings = (delivery) => {
    const isFirst = isFirstDeliveryRequest(delivery);
    const routeImpact = delivery.route_impact || {};
    const pricing = delivery.pricing || {};

    const baseAmount = Number(
      routeImpact.base_amount ||
        pricing.base_amount ||
        routeImpact.total_trip_earnings ||
        pricing.total_trip_earnings ||
        pricing.driver_earnings ||
        delivery.delivery_fee ||
        0,
    );
    const extraAmount = Number(routeImpact.extra_earnings || 0);
    const bonusAmount = Number(routeImpact.bonus_amount || 0);
    const tipAmount = Number(pricing.tip_amount || 0);

    return (
      isFirst ? baseAmount + tipAmount : extraAmount + bonusAmount + tipAmount
    ).toFixed(2);
  };

  const getEarningsBreakdown = (delivery) => {
    const isFirst = isFirstDeliveryRequest(delivery);
    const routeImpact = delivery.route_impact || {};
    const pricing = delivery.pricing || {};

    const baseAmount = parseFloat(
      routeImpact.base_amount ||
        pricing.base_amount ||
        pricing.total_trip_earnings ||
        routeImpact.total_trip_earnings ||
        0,
    );
    const extraEarnings = parseFloat(
      routeImpact.extra_earnings || pricing.extra_earnings || 0,
    );
    const bonusAmount = parseFloat(
      routeImpact.bonus_amount || pricing.bonus_amount || 0,
    );
    const tipAmount = parseFloat(pricing.tip_amount || 0);

    const primaryEarning = isFirst ? baseAmount : extraEarnings;
    const totalEarnings = isFirst
      ? baseAmount + tipAmount
      : extraEarnings + bonusAmount + tipAmount;

    return {
      isFirst,
      baseAmount,
      extraEarnings,
      bonusAmount,
      tipAmount,
      primaryEarning,
      totalEarnings,
    };
  };

  const getDistanceAndTimeSummary = (delivery) => {
    const isFirstDelivery = isFirstDeliveryRequest(delivery);
    const routeImpact = delivery.route_impact || {};

    const totalDistance = Number(
      delivery.total_delivery_distance_km ||
        routeImpact.total_distance_km ||
        routeImpact.r1_distance_km ||
        delivery.distance_km ||
        0,
    );
    const extraDistance = Number(routeImpact.extra_distance_km || 0);
    const totalMinutes = Number(
      routeImpact.estimated_time_minutes ||
        routeImpact.estimated_time ||
        delivery.estimated_time_minutes ||
        delivery.estimated_time ||
        0,
    );
    const extraMinutes = Number(routeImpact.extra_time_minutes || 0);

    const primaryDistance = isFirstDelivery
      ? totalDistance > 0
        ? totalDistance
        : extraDistance
      : extraDistance;

    const primaryMinutes = isFirstDelivery
      ? totalMinutes > 0
        ? totalMinutes
        : primaryDistance > 0
          ? Math.round(primaryDistance * 2)
          : 0
      : extraMinutes;

    return {
      isFirstDelivery,
      totalDistance: Number.isFinite(totalDistance) ? totalDistance : 0,
      extraDistance: Number.isFinite(extraDistance) ? extraDistance : 0,
      totalMinutes: Number.isFinite(totalMinutes) ? totalMinutes : 0,
      extraMinutes: Number.isFinite(extraMinutes) ? extraMinutes : 0,
      primaryDistance: Number.isFinite(primaryDistance) ? primaryDistance : 0,
      primaryMinutes: Number.isFinite(primaryMinutes) ? primaryMinutes : 0,
    };
  };

  const getPickupRestaurantWithCity = (delivery) => {
    const name =
      delivery?.restaurant?.name ||
      delivery?.orders?.restaurant_name ||
      delivery?.restaurant_name ||
      "Restaurant";
    const city =
      delivery?.restaurant?.city ||
      delivery?.orders?.restaurant_city ||
      delivery?.delivery?.city ||
      delivery?.customer?.city ||
      delivery?.orders?.delivery_city ||
      null;
    return city ? `${name}, ${city}` : name;
  };

  const getPickupAddress = (delivery) => {
    return (
      delivery?.restaurant?.address ||
      delivery?.orders?.restaurant_address ||
      delivery?.restaurant_address ||
      "Pickup address unavailable"
    );
  };

  const getDropoffAddress = (delivery) => {
    return (
      delivery?.delivery?.address ||
      delivery?.customer?.address ||
      delivery?.orders?.delivery_address ||
      delivery?.delivery_address ||
      "Drop-off address unavailable"
    );
  };

  const nearbyDeliveries = useMemo(() => {
    const seen = new Set();
    const unique = [];

    for (const delivery of availableDeliveries || []) {
      const id = delivery?.delivery_id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(delivery);
    }

    return unique;
  }, [availableDeliveries]);

  const visibleNearbyDeliveries = useMemo(
    () => nearbyDeliveries.slice(0, nearbyVisibleCount),
    [nearbyDeliveries, nearbyVisibleCount],
  );

  const remainingNearbyCount = Math.max(
    0,
    nearbyDeliveries.length - visibleNearbyDeliveries.length,
  );

  useEffect(() => {
    setNearbyVisibleCount((prev) => {
      const minimumVisible = Math.min(
        NEARBY_PAGE_SIZE,
        nearbyDeliveries.length,
      );
      if (prev < minimumVisible) return minimumVisible;
      return Math.min(prev, nearbyDeliveries.length);
    });
  }, [nearbyDeliveries.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchDriverProfile(),
      fetchStatusInfo(),
      fetchDashboardData(),
    ]);
  }, [fetchDashboardData, fetchDriverProfile, fetchStatusInfo]);

  useEffect(() => {
    if (!statusMessage) {
      statusToastAnim.setValue(0);
      return;
    }

    Animated.timing(statusToastAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [statusMessage, statusToastAnim]);

  useEffect(() => {
    if (!isFocused) return;

    dashboardContentFadeAnim.setValue(0);
    Animated.timing(dashboardContentFadeAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [isFocused, dashboardContentFadeAnim]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !hasDashboardSnapshot && !hasVisitedDriverDashboardScreen) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View
        style={[
          styles.pageAnimationWrap,
          {
            opacity: dashboardContentFadeAnim,
            transform: [
              {
                translateY: dashboardContentFadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 0],
                }),
              },
            ],
          },
        ]}
      >
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
                  {WORKING_TIME_LABELS[driverProfile?.working_time] ||
                    "Unknown"}
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
          <Animated.View
            style={[
              styles.statusToast,
              {
                opacity: statusToastAnim,
                transform: [
                  {
                    translateY: statusToastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="information-circle" size={20} color="#f59e0b" />
            <Text style={styles.statusToastText}>{statusMessage}</Text>
          </Animated.View>
        ) : null}

        <DriverScreenSection
          screenKey="DriverDashboard"
          sectionIndex={0}
          style={{ flex: 1 }}
        >
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
                    <OptimizedImage
                      uri={driverProfile.profile_picture}
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
                    {driverProfile?.full_name || "Driver"}
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
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color="#64748b"
                />
                <View style={styles.notificationBadge} />
              </TouchableOpacity>
            </View>

            {/* Online/Offline Toggle */}
            <View style={[styles.section, styles.statusSection]}>
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
                {!isFullTimeDriver &&
                  statusInfo &&
                  !statusInfo.shouldBeActive && (
                    <View style={styles.statusMessageBanner}>
                      <Ionicons name="time-outline" size={16} color="#d97706" />
                      <Text style={styles.statusMessageText}>
                        ⏰ You are currently outside your working hours. You'll
                        be able to accept deliveries during your scheduled time.
                      </Text>
                    </View>
                  )}

                {!isFullTimeDriver &&
                  statusInfo &&
                  statusInfo.shouldBeActive &&
                  !isOnline && (
                    <View
                      style={[
                        styles.statusMessageBanner,
                        styles.statusMessageInfo,
                      ]}
                    >
                      <Ionicons name="bulb-outline" size={16} color="#3b82f6" />
                      <Text
                        style={[
                          styles.statusMessageText,
                          styles.statusMessageTextInfo,
                        ]}
                      >
                        💡 You're within your working hours. Activate your
                        status to start receiving delivery requests.
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
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#06C168"
                    />
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
                          withinWorkingHours
                            ? "checkmark-circle"
                            : "time-outline"
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
                      {new Date(
                        statusInfo.nextStatusChange,
                      ).toLocaleTimeString()}
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
                <Text style={styles.statValueBlack}>
                  {stats.todayDeliveries}
                </Text>
              </View>
            </View>

            <View style={styles.balanceToReceiveCardWrap}>
              <View style={styles.balanceToReceiveCard}>
                <Text style={styles.balanceToReceiveLabel}>
                  Balance to Receive
                </Text>
                <Text style={styles.balanceToReceiveValue}>
                  Rs. {balanceToReceive.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Active Deliveries Section */}
            {activeDeliveries.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Active Deliveries ({activeDeliveries.length})
                  </Text>
                  <TouchableOpacity onPress={openActiveMap}>
                    <Text style={styles.sectionLink}>View All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.section}>
                  {activeDeliveries.slice(0, 3).map((delivery) => (
                    <TouchableOpacity
                      key={String(delivery.delivery_id || delivery.id)}
                      style={styles.activeDeliveryCard}
                      onPress={openActiveMap}
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
                          {["picked_up", "on_the_way", "at_customer"].includes(
                            delivery.status,
                          )
                            ? delivery.order?.delivery?.address ||
                              delivery.orders?.delivery_address ||
                              "Customer Address"
                            : delivery.order?.restaurant?.name ||
                              delivery.orders?.restaurant_name ||
                              "Restaurant"}
                        </Text>
                        <Text style={styles.activeDeliveryOrder}>
                          Order #
                          {delivery.order?.order_number ||
                            delivery.orders?.order_number ||
                            "N/A"}
                        </Text>
                        <Text style={styles.activeDeliveryStatus}>
                          {delivery.status?.replace(/_/g, " ")}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#cbd5e1"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {!isOnline && activeDeliveries.length > 0 && (
                  <View style={styles.warningBanner}>
                    <Ionicons
                      name="information-circle"
                      size={18}
                      color="#d97706"
                    />
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
                Nearby Requests ({nearbyDeliveries.length})
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
                    <Ionicons
                      name="hourglass-outline"
                      size={56}
                      color="#f59e0b"
                    />
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
              ) : !hasNearbyInitialSyncCompleted ? (
                <View style={styles.nearbySkeletonWrap}>
                  <View style={styles.nearbySyncBanner}>
                    <ActivityIndicator size="small" color="#06C168" />
                    <Text style={styles.nearbySyncBannerText}>
                      Updating nearby requests with latest available
                      deliveries...
                    </Text>
                  </View>
                  {[1, 2, 3].map((item) => (
                    <View key={item} style={styles.nearbySkeletonCard}>
                      <View style={styles.nearbySkeletonLineLg} />
                      <View style={styles.nearbySkeletonLineSm} />
                      <View style={styles.nearbySkeletonRow}>
                        <View style={styles.nearbySkeletonChip} />
                        <View style={styles.nearbySkeletonChip} />
                      </View>
                      <View style={styles.nearbySkeletonButton} />
                    </View>
                  ))}
                </View>
              ) : nearbySyncError && nearbyDeliveries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="warning-outline" size={52} color="#f59e0b" />
                  <Text style={styles.emptyStateTitle}>
                    Unable to update requests
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {nearbySyncError}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryNearbyButton}
                    onPress={() => fetchDashboardData()}
                  >
                    <Text style={styles.retryNearbyButtonText}>
                      Retry update
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : nearbyDeliveries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
                  <Text style={styles.emptyStateTitle}>No requests nearby</Text>
                  <Text style={styles.emptyStateSubtext}>
                    New orders will appear here
                  </Text>
                </View>
              ) : (
                visibleNearbyDeliveries.map((delivery, index) => {
                  const breakdown = getEarningsBreakdown(delivery);
                  const tripSummary = getDistanceAndTimeSummary(delivery);
                  const chips = breakdown.isFirst
                    ? [
                        `Delivery Rs. ${breakdown.baseAmount.toFixed(0)}`,
                        breakdown.tipAmount > 0
                          ? `Tip Rs. ${breakdown.tipAmount.toFixed(0)}`
                          : null,
                      ].filter(Boolean)
                    : [
                        `Delivery Rs. ${breakdown.extraEarnings.toFixed(0)}`,
                        breakdown.bonusAmount > 0
                          ? `Bonus Rs. ${breakdown.bonusAmount.toFixed(0)}`
                          : null,
                        breakdown.tipAmount > 0
                          ? `Tip Rs. ${breakdown.tipAmount.toFixed(0)}`
                          : null,
                      ].filter(Boolean);

                  return (
                    <View
                      key={delivery.delivery_id}
                      style={styles.deliveryCard}
                    >
                      <View style={styles.deliveryHeader}>
                        <View style={styles.deliveryHeaderLeft}>
                          <View style={styles.deliveryBadges}>
                            {index === 0 && (
                              <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>
                                  NEW ORDER
                                </Text>
                              </View>
                            )}
                            {delivery.orders?.length > 1 && (
                              <View style={styles.bulkBadge}>
                                <Text style={styles.bulkBadgeText}>
                                  BULK ORDER
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.earningsAmount}>
                            Rs. {getDeliveryEarnings(delivery)}
                          </Text>
                          {chips.length > 0 && (
                            <Text style={styles.breakdownText}>
                              {chips.join(" • ")}
                            </Text>
                          )}

                          <View style={styles.metricsRow}>
                            <View style={styles.metricItem}>
                              <Ionicons
                                name="navigate-outline"
                                size={14}
                                color="#64748b"
                              />
                              <Text style={styles.metricText}>
                                {tripSummary.primaryDistance > 0
                                  ? `${breakdown.isFirst ? "" : "+"}${tripSummary.primaryDistance.toFixed(1)} km`
                                  : "0"}
                              </Text>
                            </View>
                            <View style={styles.metricItem}>
                              <Ionicons
                                name="time-outline"
                                size={14}
                                color="#64748b"
                              />
                              <Text style={styles.metricText}>
                                {tripSummary.primaryMinutes > 0
                                  ? `${breakdown.isFirst ? "" : "+"}${Math.round(tripSummary.primaryMinutes)} min`
                                  : "0"}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.restaurantInfo}>
                            <Ionicons
                              name="storefront"
                              size={18}
                              color="#64748b"
                            />
                            <Text style={styles.restaurantName}>
                              {getPickupRestaurantWithCity(delivery)}
                            </Text>
                          </View>
                          <Text style={styles.estimatedTime} numberOfLines={1}>
                            Drop-off: {getDropoffAddress(delivery)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.acceptButton,
                          (acceptingOrder === delivery.delivery_id ||
                            isNearbySyncing) &&
                            styles.acceptButtonDisabled,
                        ]}
                        onPress={() =>
                          handleAcceptDelivery(delivery.delivery_id)
                        }
                        disabled={
                          acceptingOrder === delivery.delivery_id ||
                          isNearbySyncing
                        }
                      >
                        {acceptingOrder === delivery.delivery_id ? (
                          <>
                            <ActivityIndicator size="small" color="#fff" />
                            <Text style={styles.acceptButtonText}>
                              Accepting...
                            </Text>
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
                  );
                })
              )}
              {remainingNearbyCount > 0 && (
                <TouchableOpacity
                  style={styles.showMoreNearbyButton}
                  onPress={() =>
                    setNearbyVisibleCount((prev) =>
                      Math.min(
                        prev + NEARBY_PAGE_SIZE,
                        nearbyDeliveries.length,
                      ),
                    )
                  }
                >
                  <Text style={styles.showMoreNearbyText}>
                    Show More (+
                    {Math.min(NEARBY_PAGE_SIZE, remainingNearbyCount)})
                  </Text>
                </TouchableOpacity>
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
                          Rs.{" "}
                          {parseFloat(delivery.driver_earnings || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.recentDeliveryTime}>
                        <Text style={styles.recentDeliveryDate}>
                          {delivery.delivered_at
                            ? new Date(
                                delivery.delivered_at,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </Text>
                        <Text style={styles.recentDeliveryTimeText}>
                          {delivery.delivered_at
                            ? new Date(
                                delivery.delivered_at,
                              ).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
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
        </DriverScreenSection>
      </Animated.View>
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
  pageAnimationWrap: {
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
  statusSection: {
    marginTop: 8,
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
  balanceToReceiveCardWrap: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  balanceToReceiveCard: {
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
  balanceToReceiveLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  balanceToReceiveValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ea580c",
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
  breakdownText: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  estimatedTime: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
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
    textAlign: "center",
    paddingHorizontal: 16,
  },
  retryNearbyButton: {
    marginTop: 16,
    backgroundColor: "#06C168",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryNearbyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  showMoreNearbyButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#06C168",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#ecfdf3",
  },
  showMoreNearbyText: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },
  nearbySkeletonWrap: {
    gap: 12,
  },
  nearbySyncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ecfdf3",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#b8f0d0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nearbySyncBannerText: {
    flex: 1,
    color: "#046b4d",
    fontSize: 12,
    fontWeight: "600",
  },
  nearbySkeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 16,
    gap: 10,
  },
  nearbySkeletonLineLg: {
    width: "52%",
    height: 18,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  nearbySkeletonLineSm: {
    width: "40%",
    height: 14,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  nearbySkeletonRow: {
    flexDirection: "row",
    gap: 8,
  },
  nearbySkeletonChip: {
    width: 90,
    height: 12,
    borderRadius: 8,
    backgroundColor: "#cbd5e1",
  },
  nearbySkeletonButton: {
    marginTop: 6,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#d1fae5",
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
