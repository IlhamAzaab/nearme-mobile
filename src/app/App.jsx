import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import UrgentNotificationModal from "../components/common/UrgentNotificationModal";
import { API_URL } from "../config/env";
import { CustomAlertProvider } from "../context/CustomAlertContext";
import { OrderProvider } from "../context/OrderContext";
import { initializeApiAuthFetch } from "../lib/apiAuthFetch";
import {
  getAccessToken,
  getAuthStorageDiagnostics,
  initializeAuthStorage,
} from "../lib/authStorage";
import { mobileQueryClient } from "../lib/queryClient";
import RootNavigator from "../navigation/RootNavigator";
import orderTrackingService from "../services/orderTrackingService";
import pushNotificationService from "../services/pushNotificationService";
import { AuthProvider } from "./providers/AuthProvider";
import { NotificationProvider } from "./providers/NotificationProvider";
import { ThemeProvider } from "./providers/ThemeProvider";

initializeAuthStorage();
initializeApiAuthFetch();

// Safe import — requires native rebuild to work
let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch {}

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    const diagnostics = getAuthStorageDiagnostics();

    if (diagnostics.secureStoreAvailable) {
      console.log("[AuthStorage] SecureStore is available in this build.");
      return;
    }

    console.warn(
      "[AuthStorage] SecureStore is NOT available in this native build.",
      {
        secureStoreAvailabilityChecked:
          diagnostics.secureStoreAvailabilityChecked,
        authStorageShimInstalled: diagnostics.authStorageShimInstalled,
        reason: diagnostics.secureStoreInitErrorMessage,
        action:
          "Rebuild native app/dev-client after adding expo-secure-store plugin.",
      },
    );
  }, []);

  // Force Android system navigation bar to black with white icons
  useEffect(() => {
    if (Platform.OS === "android" && NavigationBar) {
      NavigationBar.setBackgroundColorAsync?.("#000000");
      NavigationBar.setButtonStyleAsync?.("light");
    }
  }, []);

  // Urgent notification modal state
  const [urgentNotification, setUrgentNotification] = useState(null);

  // Handle accept action from urgent notification modal
  const handleAcceptUrgent = useCallback(async (data) => {
    await pushNotificationService.stopAlarm();
    setUrgentNotification(null);

    // Mark order as handled (remove from displayed tracking)
    if (data?.orderId) {
      await orderTrackingService.markAsHandled(data.orderId);
      await orderTrackingService.markAsHandled(
        `order_reminder:${data.orderId}`,
      );
    }

    const token = await getAccessToken();
    if (!token) return;

    try {
      if (
        (data?.type === "new_order" || data?.type === "order_reminder") &&
        data?.orderId
      ) {
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
      await orderTrackingService.markAsHandled(
        `order_reminder:${data.orderId}`,
      );
    }

    if (
      (data?.type === "new_order" || data?.type === "order_reminder") &&
      data?.orderId
    ) {
      const token = await getAccessToken();
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
        const trackingKey =
          notification.data?.type === "order_reminder"
            ? `order_reminder:${notification.data.orderId}`
            : String(notification.data.orderId);

        const alreadyDisplayed =
          await orderTrackingService.hasBeenDisplayed(trackingKey);
        if (alreadyDisplayed) {
          console.log(
            `[App] Urgent notification already displayed for key ${trackingKey}, skipping`,
          );
          return;
        }
        // Mark as displayed
        await orderTrackingService.markAsDisplayed(trackingKey);
      }

      setUrgentNotification(notification);
    });

    const initPushOnStart = async () => {
      const token = await getAccessToken();
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
              const waitingMinutes = Math.max(
                0,
                Math.floor(
                  (Date.now() -
                    new Date(
                      order.placed_at || order.created_at || Date.now(),
                    ).getTime()) /
                    60000,
                ),
              );
              const localType =
                waitingMinutes >= 10 ? "order_reminder" : "new_order";
              const trackingKey =
                localType === "order_reminder"
                  ? `order_reminder:${String(order.id)}`
                  : String(order.id);

              const alreadyDisplayed =
                await orderTrackingService.hasBeenDisplayed(trackingKey);
              if (!alreadyDisplayed) {
                order.__localUrgentType = localType;
                order.__localWaitingMinutes = waitingMinutes;
                pendingOrder = order;
                break;
              }
            }
          }

          if (pendingOrder) {
            // Mark as displayed
            const pendingType = pendingOrder.__localUrgentType || "new_order";
            const pendingKey =
              pendingType === "order_reminder"
                ? `order_reminder:${String(pendingOrder.id)}`
                : String(pendingOrder.id);

            await orderTrackingService.markAsDisplayed(pendingKey);

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
            const orderDate = new Date(
              pendingOrder.placed_at || pendingOrder.created_at,
            );
            const formattedDate = orderDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const formattedTime = orderDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });

            setUrgentNotification({
              title:
                pendingType === "order_reminder"
                  ? "⏰ Order Waiting Alert"
                  : "🔔 New Order Received",
              body: `Order #${pendingOrder.order_number || pendingOrder.id?.slice(-6)} · Rs. ${parseFloat(pendingOrder.subtotal || 0).toFixed(2)} · ${items.length} item(s)`,
              data: {
                type: pendingType,
                orderId: String(pendingOrder.id),
                orderNumber: pendingOrder.order_number,
                itemsSummary,
                itemsCount: String(items.length),
                orderDate: formattedDate,
                orderTime: formattedTime,
                waitingMinutes: String(pendingOrder.__localWaitingMinutes || 0),
              },
            });
            pushNotificationService.startAlarm(
              pendingType === "order_reminder"
                ? "⏰ Order Reminder"
                : "🔔 New Order",
              `Order #${pendingOrder.order_number}`,
              { type: pendingType },
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
    const appStateSubscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "active") {
          // App came to foreground - check for pending orders
          const token = await getAccessToken();
          const role = await AsyncStorage.getItem("role");
          if (token && role === "admin") {
            console.log(
              "[App] App became active, checking for pending orders...",
            );
            checkPendingOrders(token);
          }
        }
      },
    );

    return () => {
      clearTimeout(timer);
      appStateSubscription?.remove();
      pushNotificationService.cleanup();
    };
  }, []);

  return (
    <QueryClientProvider client={mobileQueryClient}>
      <SafeAreaProvider>
        <CustomAlertProvider>
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
        </CustomAlertProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
