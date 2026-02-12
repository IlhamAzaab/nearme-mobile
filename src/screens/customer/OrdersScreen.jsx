/**
 * Customer Orders Screen
 *
 * Features:
 * - View all customer orders
 * - Real-time order status updates via Supabase Realtime
 * - Toast notifications when order status changes
 * - Order details with timeline
 * - Pull to refresh
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import supabase from "../../services/supabaseClient";

const { width } = Dimensions.get("window");

// Status configuration
const STATUS_CONFIG = {
  placed: { color: "#FEF3C7", textColor: "#D97706", icon: "🕐", label: "Placed" },
  accepted: { color: "#DBEAFE", textColor: "#2563EB", icon: "✅", label: "Accepted" },
  preparing: { color: "#F3E8FF", textColor: "#9333EA", icon: "👨‍🍳", label: "Preparing" },
  ready: { color: "#E0E7FF", textColor: "#4F46E5", icon: "📦", label: "Ready" },
  picked_up: { color: "#CFFAFE", textColor: "#0891B2", icon: "🚗", label: "Picked Up" },
  on_the_way: { color: "#CFFAFE", textColor: "#0891B2", icon: "🛵", label: "On the Way" },
  delivered: { color: "#D1FAE5", textColor: "#059669", icon: "🎉", label: "Delivered" },
  cancelled: { color: "#FEE2E2", textColor: "#DC2626", icon: "❌", label: "Cancelled" },
  rejected: { color: "#FEE2E2", textColor: "#DC2626", icon: "❌", label: "Rejected" },
};

const STATUS_STEPS = [
  { key: "placed", label: "Placed", icon: "🕐" },
  { key: "accepted", label: "Accepted", icon: "✅" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
  { key: "ready", label: "Ready", icon: "📦" },
  { key: "picked_up", label: "Picked Up", icon: "🚗" },
  { key: "on_the_way", label: "On the Way", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "🎉" },
];

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [customerId, setCustomerId] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Animation refs for notifications
  const notificationAnims = useRef({});

  // ============================================================================
  // AUTH CHECK
  // ============================================================================

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const role = await AsyncStorage.getItem("role");
        const userId = await AsyncStorage.getItem("userId");

        if (token && role === "customer") {
          setIsLoggedIn(true);
          setCustomerId(userId);
        } else {
          setIsLoggedIn(false);
          setLoading(false);
        }
      } catch (error) {
        console.log("Auth check error:", error);
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // ============================================================================
  // FETCH ORDERS
  // ============================================================================

  const fetchOrders = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        console.log("Failed to fetch orders:", data.message);
      }
    } catch (error) {
      console.log("Fetch orders error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchOrders();
    }
  }, [isLoggedIn, fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  // ============================================================================
  // SUPABASE REALTIME SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (!supabase || !customerId) return;

    const channel = supabase
      .channel("customer-orders")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          console.log("Order updated:", payload);
          handleOrderUpdate(payload.new, payload.old);
        }
      )
      .subscribe((status) => {
        console.log("Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  // ============================================================================
  // HANDLE ORDER UPDATE (REALTIME)
  // ============================================================================

  const handleOrderUpdate = (newOrder, oldOrder) => {
    // Update orders list
    setOrders((prev) =>
      prev.map((order) =>
        order.id === newOrder.id ? { ...order, ...newOrder } : order
      )
    );

    // Update selected order if viewing
    if (selectedOrder?.id === newOrder.id) {
      setSelectedOrder((prev) => ({ ...prev, ...newOrder }));
    }

    // Show notification if status changed
    if (oldOrder.status !== newOrder.status) {
      showStatusNotification(newOrder);
    }
  };

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  const showStatusNotification = (order) => {
    const statusMessages = {
      accepted: "Your order has been accepted! 🎉",
      preparing: "Your food is being prepared! 👨‍🍳",
      ready: "Your order is ready for pickup! 📦",
      picked_up: "Driver has picked up your order! 🚗",
      on_the_way: "Your order is on the way! 🛵",
      delivered: "Your order has been delivered! ✅",
      cancelled: "Your order was cancelled 😔",
      rejected: "Restaurant couldn't accept your order 😔",
    };

    const id = Date.now();
    const notification = {
      id,
      orderNumber: order.order_number,
      message: statusMessages[order.status] || `Status: ${order.status}`,
      status: order.status,
    };

    // Create animation value
    notificationAnims.current[id] = new Animated.Value(0);

    setNotifications((prev) => [notification, ...prev]);

    // Animate in
    Animated.spring(notificationAnims.current[id], {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id) => {
    if (notificationAnims.current[id]) {
      Animated.timing(notificationAnims.current[id], {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        delete notificationAnims.current[id];
      });
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getStatusIndex = (status) => {
    return STATUS_STEPS.findIndex((s) => s.key === status);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "--";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(timestamp);
  };

  // ============================================================================
  // RENDER ORDER CARD
  // ============================================================================

  const renderOrderCard = ({ item: order }) => {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed;
    const currentIndex = getStatusIndex(order.status);
    const isActiveOrder = !["delivered", "cancelled", "rejected"].includes(order.status);

    return (
      <Pressable
        onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
        style={({ pressed }) => [
          styles.orderCard,
          pressed && styles.orderCardPressed,
        ]}
      >
        {/* Header Row */}
        <View style={styles.orderHeader}>
          <View style={styles.orderIconWrap}>
            <Text style={styles.orderIcon}>{statusConfig.icon}</Text>
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
          </View>
          <View style={styles.orderPriceWrap}>
            <Text style={styles.orderPrice}>
              Rs. {parseFloat(order.total_amount).toFixed(2)}
            </Text>
            <Text style={styles.orderItems}>
              {order.order_items?.length || 0} items
            </Text>
          </View>
        </View>

        {/* Status Badge and Time */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
              {statusConfig.label.toUpperCase()}
            </Text>
          </View>
          <View style={styles.timeWrap}>
            <Text style={styles.timeIcon}>🕐</Text>
            <Text style={styles.timeText}>{getTimeAgo(order.placed_at)}</Text>
          </View>
        </View>

        {/* Progress Bar for Active Orders */}
        {isActiveOrder && (
          <View style={styles.progressContainer}>
            <View style={styles.progressLine} />
            <View
              style={[
                styles.progressLineActive,
                { width: `${Math.min((currentIndex / 4) * 100, 100)}%` },
              ]}
            />
            <View style={styles.stepsRow}>
              {STATUS_STEPS.slice(0, 5).map((step, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        isCompleted && styles.stepCircleCompleted,
                        isCurrent && styles.stepCircleCurrent,
                      ]}
                    >
                      {isCompleted ? (
                        <Text style={styles.stepCheck}>✓</Text>
                      ) : (
                        <Text style={styles.stepIconSmall}>{step.icon}</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        (isCompleted || isCurrent) && styles.stepLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Arrow indicator */}
        <View style={styles.arrowWrap}>
          <Text style={styles.arrow}>›</Text>
        </View>
      </Pressable>
    );
  };

  // ============================================================================
  // RENDER EMPTY STATE
  // ============================================================================

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyCircle}>
          <Text style={styles.emptyMainEmoji}>📋</Text>
        </View>
        <View style={styles.floatingEmoji1}>
          <Text style={styles.floatingText}>📦</Text>
        </View>
        <View style={styles.floatingEmoji2}>
          <Text style={styles.floatingText}>🛵</Text>
        </View>
        <View style={styles.floatingEmoji3}>
          <Text style={styles.floatingText}>🍕</Text>
        </View>
      </View>

      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your order history will appear here.{"\n"}Let's find something delicious!
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.browseButton,
          pressed && styles.browseButtonPressed,
        ]}
        onPress={() => navigation.navigate("Home")}
      >
        <Text style={styles.browseButtonText}>🔍 Browse Restaurants</Text>
      </Pressable>

      <Pressable
        style={styles.homeLink}
        onPress={() => navigation.navigate("Home")}
      >
        <Text style={styles.homeLinkText}>← Go to Home</Text>
      </Pressable>
    </View>
  );

  // ============================================================================
  // RENDER NOT LOGGED IN STATE
  // ============================================================================

  const renderNotLoggedIn = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyCircle}>
        <Text style={styles.emptyMainEmoji}>👤</Text>
      </View>
      <Text style={styles.emptyTitle}>Please login to view your orders</Text>
      <Text style={styles.emptySubtitle}>
        Sign in to track your orders and order history
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.browseButton,
          pressed && styles.browseButtonPressed,
        ]}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.browseButtonText}>Login</Text>
      </Pressable>
    </View>
  );

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF7A00" />
      <Text style={styles.loadingText}>Loading your orders...</Text>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Track your orders in real-time</Text>
          </View>
        </View>
        <Pressable
          onPress={onRefresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.refreshButtonPressed,
          ]}
        >
          <Text style={styles.refreshIcon}>🔄</Text>
        </Pressable>
      </View>

      {/* Notification Toasts */}
      <View style={styles.notificationsContainer}>
        {notifications.map((notification) => {
          const animValue = notificationAnims.current[notification.id];
          const statusConfig = STATUS_CONFIG[notification.status] || STATUS_CONFIG.placed;
          
          return (
            <Animated.View
              key={notification.id}
              style={[
                styles.toastCard,
                {
                  borderLeftColor: statusConfig.textColor,
                  opacity: animValue || 1,
                  transform: [
                    {
                      translateX: animValue
                        ? animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [300, 0],
                          })
                        : 0,
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.toastIcon}>{statusConfig.icon}</Text>
              <View style={styles.toastContent}>
                <Text style={styles.toastOrderNumber}>
                  {notification.orderNumber}
                </Text>
                <Text style={styles.toastMessage}>{notification.message}</Text>
              </View>
              <Pressable onPress={() => removeNotification(notification.id)}>
                <Text style={styles.toastClose}>✕</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* Main Content */}
      {!isLoggedIn ? (
        renderNotLoggedIn()
      ) : loading ? (
        renderLoading()
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderCard}
          contentContainerStyle={[
            styles.listContent,
            orders.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF7A00"
              colors={["#FF7A00"]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    backgroundColor: "#FF7A00",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitleWrap: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  refreshButton: {
    width: 40,
    height: 40,
    backgroundColor: "#FFF7ED",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonPressed: {
    backgroundColor: "#FFEDD5",
  },
  refreshIcon: {
    fontSize: 18,
  },

  // Notifications
  notificationsContainer: {
    position: "absolute",
    top: 120,
    right: 16,
    zIndex: 100,
    gap: 8,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: width - 32,
    gap: 10,
  },
  toastIcon: {
    fontSize: 24,
  },
  toastContent: {
    flex: 1,
  },
  toastOrderNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  toastMessage: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  toastClose: {
    fontSize: 16,
    color: "#9CA3AF",
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Order Card
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardPressed: {
    backgroundColor: "#FAFAFA",
    transform: [{ scale: 0.98 }],
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  orderIcon: {
    fontSize: 24,
  },
  orderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  restaurantName: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  orderPriceWrap: {
    alignItems: "flex-end",
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FF7A00",
  },
  orderItems: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // Status Row
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginLeft: 60,
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeIcon: {
    fontSize: 12,
  },
  timeText: {
    fontSize: 11,
    color: "#9CA3AF",
  },

  // Progress
  progressContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  progressLine: {
    position: "absolute",
    top: 36,
    left: 30,
    right: 30,
    height: 2,
    backgroundColor: "#E5E7EB",
    borderRadius: 1,
  },
  progressLineActive: {
    position: "absolute",
    top: 36,
    left: 30,
    height: 2,
    backgroundColor: "#FF7A00",
    borderRadius: 1,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepItem: {
    alignItems: "center",
    width: "20%",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleCompleted: {
    backgroundColor: "#FF7A00",
    borderColor: "#FF7A00",
  },
  stepCircleCurrent: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#FF7A00",
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  stepCheck: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
  },
  stepIconSmall: {
    fontSize: 12,
  },
  stepLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    marginTop: 6,
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#111827",
    fontWeight: "600",
  },

  // Arrow
  arrowWrap: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -10,
  },
  arrow: {
    fontSize: 24,
    color: "#D1D5DB",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyIllustration: {
    width: 180,
    height: 180,
    marginBottom: 24,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMainEmoji: {
    fontSize: 64,
  },
  floatingEmoji1: {
    position: "absolute",
    top: 0,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingEmoji2: {
    position: "absolute",
    bottom: 10,
    left: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingEmoji3: {
    position: "absolute",
    top: 40,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingText: {
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: "#FF7A00",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  browseButtonPressed: {
    backgroundColor: "#E56D00",
    transform: [{ scale: 0.97 }],
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  homeLink: {
    marginTop: 16,
    padding: 8,
  },
  homeLinkText: {
    color: "#FF7A00",
    fontSize: 14,
    fontWeight: "600",
  },
});
