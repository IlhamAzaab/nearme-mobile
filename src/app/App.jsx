import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  DeviceEventEmitter,
  LogBox,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppErrorBoundary from "../components/common/AppErrorBoundary";
import UrgentNotificationModal from "../components/common/UrgentNotificationModal";
import DeliveryNotificationOverlay from "../components/driver/DeliveryNotificationOverlay";
import ManagerNotificationOverlay from "../components/manager/ManagerNotificationOverlay";
import ManagerSocketConnector from "../components/manager/ManagerSocketConnector";
import { API_URL } from "../config/env";
import { CustomAlertProvider } from "../context/CustomAlertContext";
import {
  DriverDeliveryNotificationProvider,
  useDriverDeliveryNotifications,
} from "../context/DriverDeliveryNotificationContext";
import {
  ManagerNotificationProvider,
  useManagerNotifications,
} from "../context/ManagerNotificationContext";
import { OrderProvider } from "../context/OrderContext";
import { SocketProvider } from "../context/SocketContext";
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
import {
  DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
  getCurrentDriverScopedCacheKey,
} from "../utils/driverRequestCache";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { NotificationProvider } from "./providers/NotificationProvider";
import { ThemeProvider } from "./providers/ThemeProvider";

initializeAuthStorage();
initializeApiAuthFetch();

LogBox.ignoreLogs([
  "[expo-av]: Expo AV has been deprecated",
  "setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.",
]);

const ADMIN_ORDER_STATUS_EVENT = "admin:order_status_changed";
const DRIVER_DELIVERY_ACTION_EVENT = "driver:delivery_notification_action";
const DRIVER_POPUP_SOUND_SECONDS = 30;
const DISABLE_DRIVER_DELIVERY_POPUP = true;

const normalizeDeliveries = (deliveries) => {
  if (!deliveries) return [];
  if (Array.isArray(deliveries)) return deliveries;
  return [deliveries];
};

const normalizeAdminOrderStatus = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized === "accepted") return "pending";
  if (normalized === "rejected") return "failed";
  return normalized;
};

const sanitizeOrderItemName = (name) => {
  const raw = String(name || "").trim();
  if (!raw) return "Item";
  return raw.replace(/^\s*\d+\s*x\s*/i, "").trim() || "Item";
};

const patchAdminOrdersCache = (orderId, status, reason) => {
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedStatus = normalizeAdminOrderStatus(status);

  if (!normalizedOrderId || !normalizedStatus) return;

  if (typeof mobileQueryClient.setQueriesData === "function") {
    mobileQueryClient.setQueriesData(
      { queryKey: ["admin", "orders"] },
      (existing) => {
        if (!Array.isArray(existing)) return existing;

        return existing.map((order) => {
          if (String(order?.id) !== normalizedOrderId) return order;

          const deliveries = normalizeDeliveries(order?.deliveries);
          if (deliveries.length === 0) return order;

          return {
            ...order,
            deliveries: deliveries.map((delivery) => ({
              ...delivery,
              status: normalizedStatus,
              rejection_reason:
                normalizedStatus === "failed"
                  ? reason || delivery?.rejection_reason || null
                  : delivery?.rejection_reason || null,
            })),
          };
        });
      },
    );
  }

  mobileQueryClient
    .invalidateQueries({ queryKey: ["admin", "orders"] })
    .catch(() => {});
};

const refreshDriverDeliveryCaches = () => {
  mobileQueryClient
    .invalidateQueries({ queryKey: ["driver", "available-deliveries"] })
    .catch(() => {});
  mobileQueryClient
    .invalidateQueries({ queryKey: ["driver", "active-deliveries"] })
    .catch(() => {});
};

const isOrderUrgentType = (type) =>
  type === "new_order" || type === "order_reminder";

// Safe import G�� requires native rebuild to work
let NavigationBar = null;
try {
  NavigationBar = require("expo-navigation-bar");
} catch {}

function RealtimeProviders({ children }) {
  const { isAuthenticated, userRole, user } = useAuth();
  const [authToken, setAuthToken] = useState(null);
  const normalizedRole = userRole
    ? String(userRole).trim().toLowerCase()
    : null;
  const authUserId = user?.id ? String(user.id) : null;

  const syncToken = useCallback(async () => {
    if (!isAuthenticated || !normalizedRole || !authUserId) {
      setAuthToken(null);
      return;
    }

    try {
      const token = await getAccessToken();
      setAuthToken(token || null);
    } catch {
      setAuthToken(null);
    }
  }, [isAuthenticated, normalizedRole, authUserId]);

  useEffect(() => {
    syncToken();
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncToken();
    });

    return () => appStateSub?.remove();
  }, [syncToken]);

  if (!authToken || !normalizedRole || !authUserId) {
    return children;
  }

  if (normalizedRole === "driver") {
    return (
      <SocketProvider
        key={`${normalizedRole}:${authUserId}`}
        userId={authUserId}
        userRole={normalizedRole}
        authToken={authToken}
      >
        <DriverDeliveryNotificationProvider>
          {children}
        </DriverDeliveryNotificationProvider>
      </SocketProvider>
    );
  }

  return (
    <SocketProvider
      key={`${normalizedRole}:${authUserId}`}
      userId={authUserId}
      userRole={normalizedRole}
      authToken={authToken}
    >
      {children}
    </SocketProvider>
  );
}

function DriverNotificationLayer({ navigationRef }) {
  if (DISABLE_DRIVER_DELIVERY_POPUP) {
    return null;
  }

  const {
    notifications,
    acceptDelivery,
    declineDelivery,
    stopNotificationSound,
    isDriverOnline,
  } = useDriverDeliveryNotifications();
  const [driverLocation, setDriverLocation] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(
    DRIVER_POPUP_SOUND_SECONDS,
  );
  const countdownHandledForIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const readDriverLocation = async () => {
      try {
        const scopedKey = await getCurrentDriverScopedCacheKey(
          DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
        );
        const cachedRaw =
          (await AsyncStorage.getItem(scopedKey)) ||
          (await AsyncStorage.getItem(
            DRIVER_AVAILABLE_DELIVERIES_CACHE_BASE_KEY,
          ));
        if (!cachedRaw || !mounted) return;
        const parsed = JSON.parse(cachedRaw);
        const cachedLocation = parsed?.data?.driverLocation || null;
        if (
          cachedLocation &&
          Number.isFinite(Number(cachedLocation.latitude)) &&
          Number.isFinite(Number(cachedLocation.longitude))
        ) {
          setDriverLocation({
            latitude: Number(cachedLocation.latitude),
            longitude: Number(cachedLocation.longitude),
          });
        }
      } catch {
        // Ignore location hydration issues for popup actions.
      }
    };

    readDriverLocation();
    return () => {
      mounted = false;
    };
  }, [notifications.length]);

  const topNotification = notifications?.[0] || null;
  const topDeliveryId = topNotification?.delivery_id
    ? String(topNotification.delivery_id)
    : null;

  useEffect(() => {
    if (!topDeliveryId) {
      setTimeRemaining(DRIVER_POPUP_SOUND_SECONDS);
      countdownHandledForIdRef.current = null;
      return;
    }

    setTimeRemaining(DRIVER_POPUP_SOUND_SECONDS);
    countdownHandledForIdRef.current = null;

    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [topDeliveryId]);

  useEffect(() => {
    if (!topDeliveryId || timeRemaining > 0) return;
    if (countdownHandledForIdRef.current === topDeliveryId) return;

    countdownHandledForIdRef.current = topDeliveryId;
    stopNotificationSound();
    if (pushNotificationService?.stopAlarm) {
      pushNotificationService.stopAlarm().catch(() => {});
    }
  }, [stopNotificationSound, timeRemaining, topDeliveryId]);

  const handleAccept = useCallback(async () => {
    if (!topNotification?.delivery_id) return;
    const result = await acceptDelivery(
      topNotification.delivery_id,
      driverLocation,
    );

    if (result?.success) {
      DeviceEventEmitter.emit(DRIVER_DELIVERY_ACTION_EVENT, {
        deliveryId: String(topNotification.delivery_id),
        action: "accepted",
        source: "driver_overlay",
      });
      refreshDriverDeliveryCaches();
    }
  }, [acceptDelivery, topNotification, driverLocation]);

  const handleViewDelivery = useCallback(() => {
    const focusDeliveryId = topNotification?.delivery_id
      ? String(topNotification.delivery_id)
      : null;
    if (!focusDeliveryId) return;

    stopNotificationSound();
    declineDelivery(topNotification.delivery_id);

    if (pushNotificationService?.stopAlarm) {
      pushNotificationService.stopAlarm().catch(() => {});
    }

    if (navigationRef.current) {
      navigationRef.current.navigate("DriverTabs", {
        screen: "Available",
        params: {
          focusDeliveryId,
          deliveryId: focusDeliveryId,
          focusSource: "driver_overlay",
          focusRequestedAt: Date.now(),
        },
      });
    }
  }, [declineDelivery, stopNotificationSound, topNotification]);

  if (!isDriverOnline || !topNotification) {
    return null;
  }

  return (
    <DeliveryNotificationOverlay
      visible={true}
      delivery={{
        ...topNotification,
        restaurantName: topNotification.restaurant_name,
        pickupAddress: topNotification.restaurant_address,
        dropoffAddress: topNotification.customer_address,
        distance:
          topNotification.total_distance_km || topNotification.distance_km,
        estimated_time: topNotification.estimated_time,
      }}
      onAccept={handleAccept}
      onViewDelivery={handleViewDelivery}
      timeRemaining={timeRemaining}
    />
  );
}

function ManagerNotificationLayer({ navigationRef }) {
  const { userRole } = useAuth();
  const { notifications, markAsRead } = useManagerNotifications();
  const normalizedRole = userRole
    ? String(userRole).trim().toLowerCase()
    : null;

  if (normalizedRole !== "manager" || notifications.length === 0) {
    return null;
  }

  const activeNotification = notifications[0];
  const handleDismiss = () => {
    if (activeNotification?.id) {
      markAsRead(activeNotification.id);
    }
  };

  const handleViewDetails = () => {
    if (!navigationRef.current) return;
    if (activeNotification?.type === "customer_created") {
      navigationRef.current.navigate("Reports", {
        screen: "CustomerReports",
      });
    }
    handleDismiss();
  };

  const actions = [];
  if (activeNotification?.type === "customer_created") {
    actions.push({ label: "View Customers", primary: true, onPress: handleViewDetails });
  }

  return (
    <ManagerNotificationOverlay
      visible={true}
      title={activeNotification.title || "Manager Alert"}
      message={activeNotification.message || "You have a new notification."}
      type={activeNotification.type || "info"}
      actions={actions}
      onDismiss={handleDismiss}
    />
  );
}

export default function App() {
  const navigationRef = useRef(null);
  const urgentNotificationRef = useRef(null);

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
  const urgentNotificationType = String(urgentNotification?.data?.type || "");
  const shouldShowUrgentModal = isOrderUrgentType(urgentNotificationType);

  useEffect(() => {
    urgentNotificationRef.current = urgentNotification;
  }, [urgentNotification]);

  const publishAdminOrderStatus = useCallback(
    (orderId, status, reason, source) => {
      const normalizedOrderId = String(orderId || "").trim();
      if (!normalizedOrderId) return;

      const normalizedStatus = normalizeAdminOrderStatus(status);

      DeviceEventEmitter.emit(ADMIN_ORDER_STATUS_EVENT, {
        orderId: normalizedOrderId,
        status: normalizedStatus,
        reason: reason || null,
        source: source || "app",
      });

      patchAdminOrdersCache(normalizedOrderId, normalizedStatus, reason);
    },
    [],
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      ADMIN_ORDER_STATUS_EVENT,
      (payload) => {
        const orderId = String(payload?.orderId || "").trim();
        const status = normalizeAdminOrderStatus(payload?.status);
        const reason = payload?.reason || null;

        if (!orderId || !status) return;

        patchAdminOrdersCache(orderId, status, reason);

        const activeOrderId = String(
          urgentNotificationRef.current?.data?.orderId || "",
        ).trim();
        const source = String(payload?.source || "")
          .trim()
          .toLowerCase();
        const resolvedStatus = String(status || "")
          .trim()
          .toLowerCase();
        const shouldForceClearForUserAction =
          source === "orders_screen" || source === "orders_socket";

        if (
          (activeOrderId &&
            activeOrderId === orderId &&
            resolvedStatus !== "placed") ||
          (shouldForceClearForUserAction && resolvedStatus !== "placed")
        ) {
          pushNotificationService.stopAlarm().catch(() => {});
          setUrgentNotification(null);
        }

        Promise.allSettled([
          orderTrackingService.markAsHandled(orderId),
          orderTrackingService.markAsHandled(`order_reminder:${orderId}`),
        ]).catch(() => {});
      },
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // Handle accept action from urgent notification modal
  const handleAcceptUrgent = useCallback(
    async (data) => {
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
            publishAdminOrderStatus(
              data.orderId,
              "pending",
              null,
              "urgent_modal",
            );
          } else {
            const body = await response.json().catch(() => ({}));
            Alert.alert("Error", body.message || "Failed to accept order");
          }
          // Navigate to orders tab
          if (navigationRef.current) {
            navigationRef.current.navigate("AdminMain", { screen: "Orders" });
          }
        }
      } catch (err) {
        console.error("[UrgentModal] Accept error:", err);
        Alert.alert(
          "Network Error",
          "Could not process the action. Please try again.",
        );
      }
    },
    [publishAdminOrderStatus],
  );

  // Handle reject/decline action from urgent notification modal
  // reason is passed from the inline input (only for new_order)
  const handleRejectUrgent = useCallback(
    async (data, reason) => {
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
              publishAdminOrderStatus(
                data.orderId,
                "failed",
                reason,
                "urgent_modal",
              );
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
      }
    },
    [publishAdminOrderStatus],
  );

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

      if (notification?.data?.type === "new_delivery") {
        await pushNotificationService.stopAlarm();
        return;
      }

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
          // Prevent orphan alarm loops when duplicate urgent notifications are ignored.
          await pushNotificationService.stopAlarm();
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
        console.log("=��� App: Auto-initializing push notifications...");
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
                const cleanedName = sanitizeOrderItemName(item.food_name);
                const size =
                  item.size && item.size !== "regular" ? ` (${item.size})` : "";
                return `${item.quantity}x ${cleanedName}${size}`;
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
                  ? "Order Waiting Alert"
                  : "New Order Received",
              body: `Order #${pendingOrder.order_number || pendingOrder.id?.slice(-6)} - Rs. ${parseFloat(pendingOrder.subtotal || 0).toFixed(2)} - ${items.length} item(s)`,
              data: {
                type: pendingType,
                orderId: String(pendingOrder.id),
                orderNumber: pendingOrder.order_number,
                itemsSummary,
                itemsCount: String(items.length),
                orderDate: formattedDate,
                orderTime: formattedTime,
                waitingMinutes:
                  pendingType === "order_reminder"
                    ? String(pendingOrder.__localWaitingMinutes || 0)
                    : undefined,
              },
            });
            pushNotificationService.startAlarm(
              pendingType === "order_reminder" ? "Order Reminder" : "New Order",
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
          // App came to foreground - refresh push token registration.
          const token = await getAccessToken();
          const role = await AsyncStorage.getItem("role");
          if (token) {
            try {
              await pushNotificationService.initialize(token);
            } catch (err) {
              console.warn(
                "[App] Push re-initialize failed on foreground:",
                err,
              );
            }
          }

          // Admin-only pending order modal refresh.
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
              <ManagerNotificationProvider>
                <NotificationProvider>
                  <OrderProvider>
                    <RealtimeProviders>
                      <AppErrorBoundary scope="Navigation tree">
                        <NavigationContainer ref={navigationRef}>
                          <RootNavigator />
                          <ManagerSocketConnector />
                          <ManagerNotificationLayer
                            navigationRef={navigationRef}
                          />
                          <DriverNotificationLayer
                            navigationRef={navigationRef}
                          />
                          {/* Urgent notification modal - renders above everything */}
                          <UrgentNotificationModal
                            visible={shouldShowUrgentModal}
                            title={urgentNotification?.title}
                            body={urgentNotification?.body}
                            data={urgentNotification?.data}
                            onAccept={handleAcceptUrgent}
                            onReject={handleRejectUrgent}
                            onDismiss={handleDismissUrgent}
                          />
                        </NavigationContainer>
                      </AppErrorBoundary>
                    </RealtimeProviders>
                  </OrderProvider>
                </NotificationProvider>
              </ManagerNotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </CustomAlertProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
