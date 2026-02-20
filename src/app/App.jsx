import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import UrgentNotificationModal from "../components/common/UrgentNotificationModal";
import { API_URL } from "../config/env";
import RootNavigator from "../navigation/RootNavigator";
import pushNotificationService from "../services/pushNotificationService";
import { AuthProvider } from "./providers/AuthProvider";
import { NotificationProvider } from "./providers/NotificationProvider";
import { ThemeProvider } from "./providers/ThemeProvider";

export default function App() {
  const navigationRef = useRef(null);

  // Urgent notification modal state
  const [urgentNotification, setUrgentNotification] = useState(null);

  // Handle accept action from urgent notification modal
  const handleAcceptUrgent = useCallback(async (data) => {
    await pushNotificationService.stopAlarm();
    setUrgentNotification(null);

    const token = await AsyncStorage.getItem("token");
    if (!token) return;

    try {
      if (data?.type === "new_order" && data?.orderId) {
        // Accept order (admin)
        const response = await fetch(
          `${API_URL}/orders/restaurant/orders/${data.orderId}/status`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "accepted" }),
          },
        );
        if (response.ok) {
          Alert.alert("Success", "Order accepted!");
        } else {
          const body = await response.json().catch(() => ({}));
          Alert.alert("Error", body.message || "Failed to accept order");
        }
        // Navigate to orders tab
        if (navigationRef.current) {
          navigationRef.current.navigate("AdminMain", { screen: "Orders" });
        }
      } else if (data?.type === "new_delivery" && data?.deliveryId) {
        // Accept delivery (driver)
        const response = await fetch(
          `${API_URL}/driver/deliveries/${data.deliveryId}/accept`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        if (response.ok) {
          Alert.alert("Success", "Delivery accepted!");
        } else {
          const body = await response.json().catch(() => ({}));
          Alert.alert("Error", body.message || "Failed to accept delivery");
        }
        // Navigate to available deliveries tab
        if (navigationRef.current) {
          navigationRef.current.navigate("DriverTabs", { screen: "Available" });
        }
      }
    } catch (err) {
      console.error("[UrgentModal] Accept error:", err);
      Alert.alert(
        "Network Error",
        "Could not process the action. Please try again.",
      );
    }
  }, []);

  // Handle reject/decline action from urgent notification modal
  // reason is passed from the inline input (only for new_order)
  const handleRejectUrgent = useCallback(async (data, reason) => {
    await pushNotificationService.stopAlarm();
    setUrgentNotification(null);

    if (data?.type === "new_order" && data?.orderId) {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        try {
          const response = await fetch(
            `${API_URL}/orders/restaurant/orders/${data.orderId}/status`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "rejected", reason }),
            },
          );
          if (response.ok) {
            Alert.alert("Order Rejected", "The order has been rejected.");
          } else {
            const body = await response.json().catch(() => ({}));
            Alert.alert("Error", body.message || "Failed to reject order");
          }
        } catch (err) {
          console.error("[UrgentModal] Reject error:", err);
          Alert.alert(
            "Network Error",
            "Could not reject the order. Please try again.",
          );
        }
      }
      // Navigate to orders tab
      if (navigationRef.current) {
        navigationRef.current.navigate("AdminMain", { screen: "Orders" });
      }
    } else if (data?.type === "new_delivery") {
      // Driver just dismisses — no reason needed
      console.log("[UrgentModal] Driver declined delivery:", data?.deliveryId);
    }
  }, []);

  // Handle dismiss (X button) - stop alarm but leave order unchanged
  const handleDismissUrgent = useCallback(async () => {
    await pushNotificationService.stopAlarm();
    setUrgentNotification(null);
  }, []);

  // Initialize push notifications when app starts (if user is logged in)
  useEffect(() => {
    // Register urgent notification callback
    pushNotificationService.onUrgentNotification((notification) => {
      console.log(
        "[App] Urgent notification received:",
        notification.data?.type,
      );
      setUrgentNotification(notification);
    });

    const initPushOnStart = async () => {
      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");
      if (token && navigationRef.current) {
        console.log("🔔 App: Auto-initializing push notifications...");
        pushNotificationService.setNavigationRef(navigationRef.current);
        await pushNotificationService.initialize(token);

        // Auto-show modal for pending orders (admin/driver)
        if (role === "admin") {
          checkPendingOrders(token);
        }
        // TODO: Add driver pending deliveries check if needed
      }
    };

    // Check for pending orders and show modal if any exist
    const checkPendingOrders = async (token) => {
      try {
        const response = await fetch(`${API_URL}/orders/restaurant/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          const data = await response.json();
          const orders = data.orders || [];
          // Find first pending order (status = 'placed' at delivery level)
          const pendingOrder = orders.find((order) => {
            const delivery = Array.isArray(order.deliveries)
              ? order.deliveries[0]
              : order.deliveries;
            return delivery?.status === "placed";
          });

          if (pendingOrder) {
            // Show modal for the first pending order
            const items = pendingOrder.order_items || [];
            const itemsSummary = items
              .map((item) => {
                const size =
                  item.size && item.size !== "regular" ? ` (${item.size})` : "";
                return `${item.quantity}x ${item.food_name}${size}`;
              })
              .join(", ");

            setUrgentNotification({
              title: "🔔 Pending Order",
              body: `Order #${pendingOrder.order_number || pendingOrder.id?.slice(-6)} · Rs. ${parseFloat(pendingOrder.subtotal || 0).toFixed(2)} · ${items.length} item(s)`,
              data: {
                type: "new_order",
                orderId: String(pendingOrder.id),
                orderNumber: pendingOrder.order_number,
                itemsSummary,
                itemsCount: String(items.length),
              },
            });
            pushNotificationService.startAlarm(
              "🔔 Pending Order",
              `Order #${pendingOrder.order_number}`,
              { type: "new_order" },
            );
          }
        }
      } catch (err) {
        console.error("[App] Check pending orders error:", err);
      }
    };

    // Small delay to ensure navigation is ready
    const timer = setTimeout(initPushOnStart, 1500);

    return () => {
      clearTimeout(timer);
      pushNotificationService.cleanup();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              {/* Urgent notification modal - renders above everything */}
              <UrgentNotificationModal
                visible={!!urgentNotification}
                title={urgentNotification?.title}
                body={urgentNotification?.body}
                data={urgentNotification?.data}
                onAccept={handleAcceptUrgent}
                onReject={handleRejectUrgent}
                onDismiss={handleDismissUrgent}
              />
            </NavigationContainer>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
