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
import { useSocket } from "./SocketContext";

const DriverDeliveryNotificationContext = createContext(null);

export const useDriverDeliveryNotifications = () => {
  const ctx = useContext(DriverDeliveryNotificationContext);
  return (
    ctx || {
      notifications: [],
      acceptDelivery: async () => ({ success: false }),
      declineDelivery: () => {},
      setDriverOnline: () => {},
      isDriverOnline: false,
    }
  );
};

// ============================================================================
// SOUND HELPERS  (expo-av)
// ============================================================================

async function createAlertSound() {
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
  const [notifications, setNotifications] = useState([]);
  const [isDriverOnline, setIsDriverOnlineState] = useState(false);

  const { socket } = useSocket();
  const soundRef = useRef(null);
  const soundPlayingRef = useRef(false);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const isDriverOnlineRef = useRef(isDriverOnline);
  isDriverOnlineRef.current = isDriverOnline;

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
        }
      } catch (e) {
        console.error(
          "[DriverNotification] Failed to restore online state:",
          e,
        );
      }
    })();
  }, []);

  // ──────────────────────────────────────────────
  // Load alert sound on mount
  // ──────────────────────────────────────────────
  useEffect(() => {
    createAlertSound().then((s) => {
      soundRef.current = s;
    });
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // Manage looping sound based on notification count
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (notifications.length > 0) {
      if (!soundPlayingRef.current && soundRef.current) {
        soundRef.current.playAsync().catch(() => {});
        soundPlayingRef.current = true;
      }
    } else {
      if (soundPlayingRef.current && soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundPlayingRef.current = false;
      }
    }
  }, [notifications.length]);

  // ──────────────────────────────────────────────
  // setDriverOnline: clear notifications if going offline
  // ──────────────────────────────────────────────
  const setDriverOnline = useCallback((online) => {
    setIsDriverOnlineState(online);
    if (!online) {
      setNotifications([]);
    }
  }, []);

  // ──────────────────────────────────────────────
  // addNotification – stacking, dedup, tip update
  // ──────────────────────────────────────────────
  const addNotification = useCallback((deliveryData) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.delivery_id === deliveryData.delivery_id)) {
        if (deliveryData.type === "tip_update") {
          return prev.map((n) =>
            n.delivery_id === deliveryData.delivery_id
              ? {
                  ...n,
                  tip_amount: deliveryData.tip_amount,
                  type: "tip_update",
                  updatedAt: Date.now(),
                }
              : n,
          );
        }
        return prev;
      }
      return [{ ...deliveryData, notifiedAt: Date.now() }, ...prev];
    });
    showPushNotification(deliveryData);
  }, []);

  // ──────────────────────────────────────────────
  // declineDelivery – removes from stack immediately
  // ──────────────────────────────────────────────
  const declineDelivery = useCallback((deliveryId) => {
    const remaining = notificationsRef.current.filter(
      (n) => n.delivery_id !== deliveryId,
    );
    if (remaining.length === 0 && soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundPlayingRef.current = false;
    }
    setNotifications(remaining);
  }, []);

  // ──────────────────────────────────────────────
  // acceptDelivery – API call + sound management
  // ──────────────────────────────────────────────
  const acceptDelivery = useCallback(async (deliveryId, driverLocation) => {
    // Stop sound immediately
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundPlayingRef.current = false;
    }

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
      }
      return { success: false, message: "Network error" };
    }
  }, []);

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
    const title = isNew
      ? "🚨 New Delivery Available!"
      : "💰 Tip Added to Delivery!";
    const earnings = isNew
      ? `LKR ${parseFloat(deliveryData.driver_earnings || deliveryData.total_trip_earnings || 0).toFixed(2)}`
      : `Tip: LKR ${parseFloat(deliveryData.tip_amount || 0).toFixed(2)}`;
    const distKm = parseFloat(deliveryData.distance_km || 0);
    const estTime = parseFloat(deliveryData.estimated_time || 0);
    const body = [
      earnings,
      deliveryData.restaurant_name || "Restaurant",
      distKm > 0 ? `${distKm.toFixed(1)} km` : "",
      estTime > 0 ? `~${Math.round(estTime)} min` : "",
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
        tip_amount: data.tip_amount || 0,
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
        tip_amount: data.tip_amount || 0,
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
