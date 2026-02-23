import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import UrgentNotificationModal from "../components/common/UrgentNotificationModal";
import { API_URL } from "../config/env";
import RootNavigator from "../navigation/RootNavigator";
import orderTrackingService from "../services/orderTrackingService";
import pushNotificationService from "../services/pushNotificationService";
import { AuthProvider } from "./providers/AuthProvider";
import { NotificationProvider } from "./providers/NotificationProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { OrderProvider } from "../context/OrderContext";

export default function App() {
  const navigationRef = useRef(null);

  // Urgent notification modal state
  const [urgentNotification, setUrgentNotification] = useState(null);

  // Handle accept action from urgent notification modal
  const handleAcceptUrgent = useCallback(async (data) => {
    await pushNotificationService.stopAlarm();
    setUrgentNotification(null);

    // Mark order as handled (remove from displayed tracking)
    if (data?.orderId) {
      await orderTrackingService.markAsHandled(data.orderId);
    }

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

    // Mark order as handled (remove from displayed tracking)
    if (data?.orderId) {
      await orderTrackingService.markAsHandled(data.orderId);
    }

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
    // Initialize order tracking service
    orderTrackingService.initialize();

    // Register urgent notification callback
    pushNotificationService.onUrgentNotification(async (notification) => {
      console.log(
        "[App] Urgent notification received:",
        notification.data?.type,
      );
      
      // Check if this order has already been displayed
      if (notification.data?.orderId) {
        const alreadyDisplayed = await orderTrackingService.hasBeenDisplayed(
          notification.data.orderId
        );
        if (alreadyDisplayed) {
          console.log(`[App] Order ${notification.data.orderId} already displayed, skipping`);
          return;
        }
        // Mark as displayed
        await orderTrackingService.markAsDisplayed(notification.data.orderId);
      }
      
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
          // Find first pending order (status = 'placed' at delivery level) that hasn't been displayed
          let pendingOrder = null;
          for (const order of orders) {
            const delivery = Array.isArray(order.deliveries)
              ? order.deliveries[0]
              : order.deliveries;
            if (delivery?.status === "placed") {
              // Check if already displayed
              const alreadyDisplayed = await orderTrackingService.hasBeenDisplayed(
                String(order.id)
              );
              if (!alreadyDisplayed) {
                pendingOrder = order;
                break;
              }
            }
          }

          if (pendingOrder) {
            // Mark as displayed
            await orderTrackingService.markAsDisplayed(String(pendingOrder.id));
            
            // Show modal for the first pending order
            const items = pendingOrder.order_items || [];
            const itemsSummary = items
              .map((item) => {
                const size =
                  item.size && item.size !== "regular" ? ` (${item.size})` : "";
                return `${item.quantity}x ${item.food_name}${size}`;
              })
              .join(", ");

            // Format date and time
            const orderDate = new Date(pendingOrder.placed_at || pendingOrder.created_at);
            const formattedDate = orderDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const formattedTime = orderDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });

            setUrgentNotification({
              title: "🔔 New Order Received",
              body: `Order #${pendingOrder.order_number || pendingOrder.id?.slice(-6)} · Rs. ${parseFloat(pendingOrder.subtotal || 0).toFixed(2)} · ${items.length} item(s)`,
              data: {
                type: "new_order",
                orderId: String(pendingOrder.id),
                orderNumber: pendingOrder.order_number,
                itemsSummary,
                itemsCount: String(items.length),
                orderDate: formattedDate,
                orderTime: formattedTime,
              },
            });
            pushNotificationService.startAlarm(
              "🔔 New Order",
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

    // Listen for app state changes (foreground/background)
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - check for pending orders
        const token = await AsyncStorage.getItem("token");
        const role = await AsyncStorage.getItem("role");
        if (token && role === "admin") {
          console.log("[App] App became active, checking for pending orders...");
          checkPendingOrders(token);
        }
      }
    });

    return () => {
      clearTimeout(timer);
      appStateSubscription?.remove();
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
            <OrderProvider>
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
            </OrderProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
