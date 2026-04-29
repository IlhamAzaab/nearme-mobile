/**
 * Driver Delivery Notification Context (React Native)
 *
 * Manages delivery notification popups for drivers:
 * - Listens for WebSocket `delivery:new` and `delivery:tip_updated` events via SocketContext
 * - Shows stacking notification popups with alert sound (expo-av)
 * - Sound loops until driver accepts or declines
 * - Works across all pages (global provider)
 * - Uses expo-notifications for push notifications
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "../constants/api";
import {
  DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
  getCurrentDriverScopedCacheKey,
} from "../utils/driverRequestCache";
import { useSocket } from "./SocketContext";

const AVAILABLE_DELIVERIES_CACHE_KEY =
  DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY;
const DRIVER_STATUS_ENDPOINT = "/driver/working-hours-status";
const DRIVER_POPUP_SOUND_AUTO_STOP_MS = 30000;
const ENABLE_DRIVER_NOTIFICATION_SOUND = false;

const DriverDeliveryNotificationContext = createContext(null);

export const useDriverDeliveryNotifications = () => {
  const ctx = useContext(DriverDeliveryNotificationContext);
  return (
    ctx || {
      notifications: [],
      acceptDelivery: async () => ({ success: false }),
      declineDelivery: () => {},
      stopNotificationSound: () => {},
      setDriverOnline: () => {},
      isDriverOnline: false,
    }
  );
};

// ============================================================================
// SOUND HELPERS  (expo-av)
// ============================================================================

async function createAlertSound() {
  if (!ENABLE_DRIVER_NOTIFICATION_SOUND) return null;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/sounds/alarm.mp3"),
      { isLooping: true, volume: 0.8 },
    );
    return sound;
  } catch (e) {
    console.warn("[AlertSound] Could not load sound asset:", e.message);
    return null;
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

export function DriverDeliveryNotificationProvider({ children }) {
  const deriveDriverOnlineState = useCallback((statusPayload) => {
    const normalizedStatus = String(
      statusPayload?.currentStatus ||
        statusPayload?.driver_status ||
        statusPayload?.status ||
        "",
    )
      .trim()
      .toLowerCase();

    if (normalizedStatus === "active") return true;
    if (normalizedStatus === "inactive") return false;

    // Fallback for legacy payloads that only return time-window booleans.
    if (typeof statusPayload?.shouldBeActive === "boolean") {
      return statusPayload.shouldBeActive;
    }

    return null;
  }, []);

  const enrichWithCachedAvailableDelivery = useCallback(
    async (deliveryData) => {
      try {
        const scopedCacheKey = await getCurrentDriverScopedCacheKey(
          AVAILABLE_DELIVERIES_CACHE_KEY,
        );
        const cachedRaw =
          (await AsyncStorage.getItem(scopedCacheKey)) ||
          (await AsyncStorage.getItem(AVAILABLE_DELIVERIES_CACHE_KEY));
        if (!cachedRaw) return deliveryData;

        const parsed = JSON.parse(cachedRaw);
        const deliveries = parsed?.data?.deliveries || [];
        const currentRoute = parsed?.data?.currentRoute || {};

        const match = deliveries.find(
          (d) => String(d?.delivery_id) === String(deliveryData?.delivery_id),
        );

        if (!match) return deliveryData;

        const routeImpact = match.route_impact || {};
        const pricing = match.pricing || {};
        const activeDeliveries = Number(currentRoute.active_deliveries || 0);
        const hasRouteExtraSignals =
          Number(routeImpact.extra_distance_km || 0) > 0 ||
          Number(routeImpact.extra_time_minutes || 0) > 0 ||
          Number(routeImpact.extra_earnings || 0) > 0 ||
          Number(routeImpact.bonus_amount || 0) > 0;

        const stackedByContext =
          routeImpact.is_first_delivery === false ||
          hasRouteExtraSignals ||
          activeDeliveries > 0;

        const inferredSequence =
          Number(routeImpact.delivery_sequence || 0) ||
          (stackedByContext
            ? activeDeliveries + 1 || 2
            : Number(deliveryData?.delivery_sequence || 0) || 1);

        return {
          ...deliveryData,
          delivery_sequence: inferredSequence,
          driver_earnings:
            Number(deliveryData?.driver_earnings || 0) ||
            Number(pricing.total_trip_earnings || 0) ||
            Number(routeImpact.total_trip_earnings || 0),
          total_trip_earnings:
            Number(deliveryData?.total_trip_earnings || 0) ||
            Number(pricing.total_trip_earnings || 0) ||
            Number(routeImpact.total_trip_earnings || 0),
          base_amount:
            Number(deliveryData?.base_amount || 0) ||
            Number(routeImpact.base_amount || 0) ||
            Number(pricing.total_trip_earnings || 0),
          extra_earnings:
            Number(deliveryData?.extra_earnings || 0) ||
            Number(routeImpact.extra_earnings || 0),
          bonus_amount:
            Number(deliveryData?.bonus_amount || 0) ||
            Number(routeImpact.bonus_amount || 0),
          tip_amount:
            Number(deliveryData?.tip_amount || 0) ||
            Number(pricing.tip_amount || 0),
          total_distance_km:
            Number(deliveryData?.total_distance_km || 0) ||
            Number(match.total_delivery_distance_km || 0) ||
            Number(routeImpact.r1_distance_km || 0),
          distance_km:
            Number(deliveryData?.distance_km || 0) ||
            Number(match.total_delivery_distance_km || 0),
          estimated_time:
            Number(deliveryData?.estimated_time || 0) ||
            Number(match.estimated_time_minutes || 0),
          extra_distance_km:
            Number(deliveryData?.extra_distance_km || 0) ||
            Number(routeImpact.extra_distance_km || 0),
          extra_time_minutes:
            Number(deliveryData?.extra_time_minutes || 0) ||
            Number(routeImpact.extra_time_minutes || 0),
        };
      } catch {
        return deliveryData;
      }
    },
    [],
  );

  const [notifications, setNotifications] = useState([]);
  const [isDriverOnline, setIsDriverOnlineState] = useState(false);

  const { socket } = useSocket();
  const soundRef = useRef(null);
  const soundPlayingRef = useRef(false);
  const soundAutoStopTimeoutRef = useRef(null);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const isDriverOnlineRef = useRef(isDriverOnline);
  isDriverOnlineRef.current = isDriverOnline;

  const clearSoundAutoStopTimeout = useCallback(() => {
    if (soundAutoStopTimeoutRef.current) {
      clearTimeout(soundAutoStopTimeoutRef.current);
      soundAutoStopTimeoutRef.current = null;
    }
  }, []);

  const stopNotificationSound = useCallback(() => {
    clearSoundAutoStopTimeout();
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
    }
    soundPlayingRef.current = false;
  }, [clearSoundAutoStopTimeout]);

  const scheduleSoundAutoStop = useCallback(() => {
    clearSoundAutoStopTimeout();
    soundAutoStopTimeoutRef.current = setTimeout(() => {
      if (!soundPlayingRef.current) return;
      if (notificationsRef.current.length === 0) return;

      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
      }
      soundPlayingRef.current = false;
    }, DRIVER_POPUP_SOUND_AUTO_STOP_MS);
  }, [clearSoundAutoStopTimeout]);

  // ──────────────────────────────────────────────
  // Initialize driver online state from storage
  // ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [[, role], [, token], [, savedOnline]] =
          await AsyncStorage.multiGet(["role", "token", "driver_is_online"]);
        if (role === "driver" && token) {
          // Restore the persisted online status (server syncs on mount)
          const online = savedOnline !== null ? JSON.parse(savedOnline) : true;
          setIsDriverOnlineState(online);

          // Pull source-of-truth status from backend to avoid stale local gate.
          try {
            const statusRes = await fetch(
              `${API_BASE_URL}${DRIVER_STATUS_ENDPOINT}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (statusRes.ok) {
              const statusData = await statusRes.json();
              const serverOnline = deriveDriverOnlineState(statusData);
              if (typeof serverOnline === "boolean") {
                setIsDriverOnlineState(serverOnline);
                await AsyncStorage.setItem(
                  "driver_is_online",
                  JSON.stringify(serverOnline),
                );
              }
            }
          } catch (statusErr) {
            console.warn(
              "[DriverNotification] Failed to sync online status from server:",
              statusErr?.message || statusErr,
            );
          }
        }
      } catch (e) {
        console.error(
          "[DriverNotification] Failed to restore online state:",
          e,
        );
      }
    })();
  }, [deriveDriverOnlineState]);

  // ──────────────────────────────────────────────
  // Load alert sound on mount
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!ENABLE_DRIVER_NOTIFICATION_SOUND) return;
    createAlertSound().then((s) => {
      soundRef.current = s;
    });
    return () => {
      clearSoundAutoStopTimeout();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [clearSoundAutoStopTimeout]);

  // ──────────────────────────────────────────────
  // Manage looping sound based on notification count
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!ENABLE_DRIVER_NOTIFICATION_SOUND) return;
    if (notifications.length > 0) {
      if (!soundPlayingRef.current && soundRef.current) {
        soundRef.current.playAsync().catch(() => {});
        soundPlayingRef.current = true;
      }
      if (soundPlayingRef.current) {
        scheduleSoundAutoStop();
      }
    } else {
      stopNotificationSound();
    }
  }, [notifications.length, scheduleSoundAutoStop, stopNotificationSound]);

  // ──────────────────────────────────────────────
  // setDriverOnline: clear notifications if going offline
  // ──────────────────────────────────────────────
  const setDriverOnline = useCallback(
    (online) => {
      setIsDriverOnlineState(online);
      if (!online) {
        stopNotificationSound();
        setNotifications([]);
      }
    },
    [stopNotificationSound],
  );

  // ──────────────────────────────────────────────
  // addNotification – stacking, dedup, tip update
  // ──────────────────────────────────────────────
  const addNotification = useCallback(async (deliveryData) => {
    const enriched = await enrichWithCachedAvailableDelivery(deliveryData);

    setNotifications((prev) => {
      if (prev.some((n) => n.delivery_id === enriched.delivery_id)) {
        if (enriched.type === "tip_update") {
          return prev.map((n) =>
            n.delivery_id === enriched.delivery_id
              ? {
                  ...n,
                  ...enriched,
                  type: "tip_update",
                  updatedAt: Date.now(),
                }
              : n,
          );
        }
        return prev;
      }
      return [{ ...enriched, notifiedAt: Date.now() }, ...prev];
    });
    // Keep delivery events flowing, but skip the in-app popup for now.
    return enriched;
  }, []);

  // ──────────────────────────────────────────────
  // declineDelivery – removes from stack immediately
  // ──────────────────────────────────────────────
  const declineDelivery = useCallback(
    (deliveryId) => {
      const remaining = notificationsRef.current.filter(
        (n) => n.delivery_id !== deliveryId,
      );
      if (remaining.length === 0) {
        stopNotificationSound();
      }
      setNotifications(remaining);
    },
    [stopNotificationSound],
  );

  // ──────────────────────────────────────────────
  // acceptDelivery – API call + sound management
  // ──────────────────────────────────────────────
  const acceptDelivery = useCallback(
    async (deliveryId, driverLocation) => {
      // Stop sound immediately
      stopNotificationSound();

      const remaining = notificationsRef.current.filter(
        (n) => n.delivery_id !== deliveryId,
      );
      const notification = notificationsRef.current.find(
        (n) => n.delivery_id === deliveryId,
      );
      setNotifications(remaining);

      if (!notification)
        return { success: false, message: "Notification not found" };

      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(
          `${API_BASE_URL}/driver/deliveries/${deliveryId}/accept`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              driver_latitude: driverLocation?.latitude,
              driver_longitude: driverLocation?.longitude,
              earnings_data: notification.earnings_data || null,
            }),
          },
        );
        const data = await res.json();

        // Restart sound for remaining notifications
        if (remaining.length > 0 && soundRef.current) {
          soundRef.current.playAsync().catch(() => {});
          soundPlayingRef.current = true;
          scheduleSoundAutoStop();
        }

        return res.ok
          ? { success: true, data }
          : {
              success: false,
              message: data.message || "Failed to accept delivery",
            };
      } catch (e) {
        console.error("[AcceptDelivery] Error:", e);
        if (remaining.length > 0 && soundRef.current) {
          soundRef.current.playAsync().catch(() => {});
          soundPlayingRef.current = true;
          scheduleSoundAutoStop();
        }
        return { success: false, message: "Network error" };
      }
    },
    [scheduleSoundAutoStop, stopNotificationSound],
  );

  // ──────────────────────────────────────────────
  // Push notification (expo-notifications)
  // ──────────────────────────────────────────────
  const showPushNotification = useCallback(async (deliveryData) => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      if (newStatus !== "granted") return;
    }

    const isNew = deliveryData.type !== "tip_update";
    const isStacked =
      Number(deliveryData.delivery_sequence || 1) > 1 ||
      parseFloat(deliveryData.extra_distance_km || 0) > 0 ||
      parseFloat(deliveryData.extra_time_minutes || 0) > 0 ||
      parseFloat(deliveryData.extra_earnings || 0) > 0;
    const title = isNew
      ? "🚨 New Delivery Available!"
      : "💰 Tip Added to Delivery!";
    const distKm = isStacked
      ? parseFloat(deliveryData.extra_distance_km || 0)
      : parseFloat(
          deliveryData.total_distance_km || deliveryData.distance_km || 0,
        );
    const estTime = isStacked
      ? parseFloat(deliveryData.extra_time_minutes || 0)
      : parseFloat(deliveryData.estimated_time || 0);
    const body = [
      deliveryData.restaurant_name || "Restaurant",
      distKm > 0 ? `${isStacked ? "+" : ""}${distKm.toFixed(1)} km` : "",
      estTime > 0 ? `${isStacked ? "+" : ""}${Math.round(estTime)} min` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { deliveryId: deliveryData.delivery_id },
        },
        trigger: null, // fire immediately
      });
    } catch (e) {
      console.warn("[PushNotification] Error:", e);
    }
  }, []);

  // ──────────────────────────────────────────────
  // Request push permission on mount
  // ──────────────────────────────────────────────
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // ──────────────────────────────────────────────
  // WebSocket event listeners
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewDelivery = (data) => {
      console.log("[DeliveryNotification] 🚨 New delivery:", data.delivery_id);
      if (!isDriverOnlineRef.current) return;
      addNotification({
        delivery_id: data.delivery_id,
        order_id: data.order_id,
        order_number: data.order_number,
        type: "new_delivery",
        restaurant_name: data.restaurant?.name || "Restaurant",
        restaurant_address: data.restaurant?.address || "",
        restaurant_latitude: data.restaurant?.latitude,
        restaurant_longitude: data.restaurant?.longitude,
        customer_address: data.customer?.address || "",
        customer_city: data.customer?.city || "",
        customer_latitude: data.customer?.latitude,
        customer_longitude: data.customer?.longitude,
        total_amount: data.total_amount || 0,
        distance_km: data.distance_km || null,
        estimated_time: data.estimated_time || null,
        driver_earnings: data.driver_earnings || 0,
        total_trip_earnings: data.total_trip_earnings || 0,
        extra_earnings: data.extra_earnings || 0,
        bonus_amount: data.bonus_amount || 0,
        base_amount: data.base_amount || 0,
        tip_amount: data.tip_amount || 0,
        total_distance_km: data.total_distance_km || 0,
        extra_distance_km: data.extra_distance_km || 0,
        extra_time_minutes: data.extra_time_minutes || 0,
        delivery_sequence: data.delivery_sequence || 1,
        earnings_data: data.earnings_data || null,
      });
    };

    const handleTipUpdate = (data) => {
      console.log("[DeliveryNotification] 💰 Tip update:", data.delivery_id);
      if (!isDriverOnlineRef.current) return;
      addNotification({
        delivery_id: data.delivery_id,
        order_id: data.order_id,
        order_number: data.order_number,
        type: "tip_update",
        restaurant_name: data.restaurant_name || "Restaurant",
        restaurant_address: data.restaurant_address || "",
        customer_address: data.customer_address || "",
        distance_km: data.distance_km || null,
        estimated_time: data.estimated_time || null,
        driver_earnings: data.driver_earnings || 0,
        total_trip_earnings: data.total_trip_earnings || 0,
        extra_earnings: data.extra_earnings || 0,
        bonus_amount: data.bonus_amount || 0,
        base_amount: data.base_amount || 0,
        tip_amount: data.tip_amount || 0,
        total_distance_km: data.total_distance_km || 0,
        extra_distance_km: data.extra_distance_km || 0,
        extra_time_minutes: data.extra_time_minutes || 0,
        delivery_sequence: data.delivery_sequence || 1,
        earnings_data: data.earnings_data || null,
      });
    };

    const handleDeliveryTaken = (data) => {
      console.log("[DeliveryNotification] Delivery taken:", data.delivery_id);
      setNotifications((prev) =>
        prev.filter((n) => n.delivery_id !== data.delivery_id),
      );
    };

    const handleDriverMilestone = (data) => {
      console.log("[DeliveryNotification] 🎉 Milestone:", data);
      if (!isDriverOnlineRef.current) return;
      // Show push notification for milestone
      Notifications.scheduleNotificationAsync({
        content: {
          title: "🎉 Delivery Milestone!",
          body:
            data.message || `You completed ${data.milestone} deliveries today!`,
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
      // Add as a milestone-type notification
      addNotification({
        delivery_id: `milestone-${Date.now()}`,
        type: "delivery_milestone",
        milestone: data.milestone,
        today_deliveries: data.today_deliveries,
        message: data.message,
      });
    };

    socket.on("delivery:new", handleNewDelivery);
    socket.on("delivery:tip_updated", handleTipUpdate);
    socket.on("delivery:taken", handleDeliveryTaken);
    socket.on("driver:delivery_milestone", handleDriverMilestone);

    return () => {
      socket.off("delivery:new", handleNewDelivery);
      socket.off("delivery:tip_updated", handleTipUpdate);
      socket.off("delivery:taken", handleDeliveryTaken);
      socket.off("driver:delivery_milestone", handleDriverMilestone);
    };
  }, [socket, addNotification]);

  const value = {
    notifications,
    addNotification,
    declineDelivery,
    acceptDelivery,
    stopNotificationSound,
    setDriverOnline,
    isDriverOnline,
  };

  return (
    <DriverDeliveryNotificationContext.Provider value={value}>
      {children}
    </DriverDeliveryNotificationContext.Provider>
  );
}

export default DriverDeliveryNotificationProvider;
