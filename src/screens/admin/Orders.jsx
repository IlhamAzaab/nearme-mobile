import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import supabaseClient from "../../services/supabaseClient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Orders() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    accepted: 0,
    delivered: 0,
  });
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [rejectModal, setRejectModal] = useState({
    open: false,
    orderId: null,
  });
  const [rejectReason, setRejectReason] = useState("");

  // Animation for modal
  const slideAnim = useRef(new Animated.Value(400)).current;

  // Normalize deliveries to always be an array
  const normalizeDeliveries = (deliveries) => {
    if (!deliveries) return [];
    if (Array.isArray(deliveries)) return deliveries;
    return [deliveries];
  };

  const getDeliveryStatus = (order) => {
    // Always rely on deliveries.status as the ONLY source of truth
    const dels = normalizeDeliveries(order?.deliveries);
    return dels[0]?.status || "placed";
  };

  const getDriver = (order) => {
    const dels = normalizeDeliveries(order?.deliveries);
    return dels[0]?.drivers || null;
  };

  const computeCounts = (list) => {
    const allOrders = list || [];
    const pending = allOrders.filter(
      (o) => getDeliveryStatus(o) === "placed",
    ).length;
    const accepted = allOrders.filter((o) => {
      const s = getDeliveryStatus(o);
      return s === "pending" || s === "accepted";
    }).length;
    const delivered = allOrders.filter((o) => {
      const s = getDeliveryStatus(o);
      return (
        s === "picked_up" ||
        s === "on_the_way" ||
        s === "at_customer" ||
        s === "delivered"
      );
    }).length;

    return {
      all: allOrders.length,
      pending,
      accepted,
      delivered,
    };
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("Missing auth token. Please sign in again.");
        if (!silent) setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/orders/restaurant/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to fetch orders");
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setCounts(computeCounts(data.orders));
    } catch (err) {
      console.error("Failed to fetch orders", err);
      if (!silent) setError(err.message || "Failed to fetch orders");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Ref to always have the latest fetchOrders available in subscriptions
  const fetchOrdersRef = useRef(fetchOrders);
  fetchOrdersRef.current = fetchOrders;

  useEffect(() => {
    // Fetch restaurant info
    const fetchRestaurant = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_URL}/admin/restaurant`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRestaurant(data.restaurant);
        }
      } catch (err) {
        console.error("Failed to fetch restaurant", err);
      }
    };

    fetchRestaurant();
    fetchOrders();

    // Set up real-time subscription for new deliveries
    const subscription = supabaseClient
      .channel("deliveries:new-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deliveries",
        },
        (payload) => {
          console.log("New delivery created:", payload);
          setNewOrderNotification({
            message: "New order received! 🔔",
            timestamp: new Date(),
          });
          setTimeout(() => setNewOrderNotification(null), 5000);
          fetchOrdersRef.current?.(true);
        },
      )
      .subscribe();

    // Subscribe to delivery status changes
    const statusSubscription = supabaseClient
      .channel("deliveries:status-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
        },
        (payload) => {
          const updatedDelivery = payload.new;
          console.log(
            "Delivery status updated:",
            updatedDelivery?.status,
            "delivery_id:",
            updatedDelivery?.id,
          );

          // Immediately update local state for instant UI feedback
          setOrders((prevOrders) => {
            const newOrders = prevOrders.map((order) => {
              const dels = normalizeDeliveries(order.deliveries);
              if (dels.some((d) => d.id === updatedDelivery.id)) {
                return {
                  ...order,
                  deliveries: dels.map((d) =>
                    d.id === updatedDelivery.id
                      ? {
                          ...d,
                          status: updatedDelivery.status,
                          driver_id: updatedDelivery.driver_id,
                        }
                      : d,
                  ),
                };
              }
              return order;
            });
            setCounts(computeCounts(newOrders));
            return newOrders;
          });

          fetchOrdersRef.current?.(true);
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedOrder || rejectModal.open) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [selectedOrder, rejectModal.open]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const filteredOrders = orders.filter((order) => {
    const deliveryStatus = getDeliveryStatus(order);
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return deliveryStatus === "placed";
    if (statusFilter === "accepted")
      return deliveryStatus === "pending" || deliveryStatus === "accepted";
    if (statusFilter === "delivered")
      return (
        deliveryStatus === "picked_up" ||
        deliveryStatus === "on_the_way" ||
        deliveryStatus === "at_customer" ||
        deliveryStatus === "delivered"
      );
    return true;
  });

  const handleAcceptOrder = async (orderId) => {
    setProcessingOrderId(orderId);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Missing auth token. Please sign in again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/orders/restaurant/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "accepted" }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to accept order");
      }

      Alert.alert("Success", "Order accepted!");
      fetchOrders();
    } catch (err) {
      console.error("Failed to accept order", err);
      Alert.alert("Error", err.message || "Failed to accept order");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectOrder = (orderId) => {
    setRejectModal({ open: true, orderId });
    setRejectReason("");
  };

  const handleConfirmReject = async () => {
    const orderId = rejectModal.orderId;
    if (!orderId) return;
    if (!rejectReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection");
      return;
    }

    setRejectModal({ open: false, orderId: null });
    setProcessingOrderId(orderId);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Missing auth token. Please sign in again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/orders/restaurant/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "failed",
            reason: rejectReason.trim(),
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to reject order");
      }

      // Optimistically update the UI immediately - update deliveries table only
      setOrders((prevOrders) => {
        const newOrders = prevOrders.map((order) => {
          if (order.id === orderId) {
            const dels = normalizeDeliveries(order.deliveries);
            return {
              ...order,
              deliveries: dels.map((d) => ({
                ...d,
                status: "failed",
                rejection_reason: rejectReason.trim(),
              })),
            };
          }
          return order;
        });
        setCounts(computeCounts(newOrders));
        return newOrders;
      });

      Alert.alert("Success", "Order rejected");
      fetchOrders();
    } catch (err) {
      console.error("Failed to reject order", err);
      Alert.alert("Error", err.message || "Failed to reject order");
    } finally {
      setProcessingOrderId(null);
      setRejectReason("");
    }
  };

  const formatTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";

    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) + `, ${timeStr}`
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "placed":
        return {
          label: "New Order",
          bg: "#fef3c7",
          text: "#d97706",
          icon: "🆕",
        };
      case "pending":
        return {
          label: "Pending",
          bg: "#dbeafe",
          text: "#2563eb",
          icon: "⏳",
        };
      case "accepted":
        return {
          label: "Accepted",
          bg: "#d1fae5",
          text: "#059669",
          icon: "✓",
        };
      case "picked_up":
        return {
          label: "Picked Up",
          bg: "#f3e8ff",
          text: "#9333ea",
          icon: "📦",
        };
      case "on_the_way":
        return {
          label: "On The Way",
          bg: "#e0f2fe",
          text: "#0284c7",
          icon: "🚗",
        };
      case "at_customer":
        return {
          label: "Arriving",
          bg: "#e0e7ff",
          text: "#4f46e5",
          icon: "📍",
        };
      case "delivered":
        return {
          label: "Delivered",
          bg: "#dcfce7",
          text: "#16a34a",
          icon: "✅",
        };
      case "cancelled":
      case "failed":
        return {
          label: status === "cancelled" ? "Cancelled" : "Rejected",
          bg: "#fee2e2",
          text: "#dc2626",
          icon: "❌",
        };
      default:
        return {
          label: status,
          bg: "#f3f4f6",
          text: "#6b7280",
          icon: "•",
        };
    }
  };

  const calculateTodayRevenue = () => {
    const today = new Date().toDateString();
    const pickedUpStatuses = [
      "picked_up",
      "on_the_way",
      "at_customer",
      "delivered",
    ];
    return orders
      .filter((o) => {
        const placedToday = new Date(o.placed_at).toDateString() === today;
        const deliveryStatus = getDeliveryStatus(o);
        return placedToday && pickedUpStatuses.includes(deliveryStatus);
      })
      .reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0);
  };

  const getTodayOrdersCount = () => {
    const today = new Date().toDateString();
    const pickedUpStatuses = [
      "picked_up",
      "on_the_way",
      "at_customer",
      "delivered",
    ];
    return orders.filter((o) => {
      const placedToday = new Date(o.placed_at).toDateString() === today;
      const deliveryStatus = getDeliveryStatus(o);
      return placedToday && pickedUpStatuses.includes(deliveryStatus);
    }).length;
  };

  const filterTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "pending", label: "New", count: counts.pending },
    { key: "accepted", label: "Active", count: counts.accepted },
    { key: "delivered", label: "Done", count: counts.delivered },
  ];

  // Loading Skeleton
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Stats Header Skeleton */}
        <View style={styles.statsHeader}>
          <View style={styles.statsHeaderTop}>
            <View>
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 80, height: 20, marginBottom: 4 },
                ]}
              />
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 120, height: 12 },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeleton,
                styles.skeletonLight,
                { width: 40, height: 40, borderRadius: 20 },
              ]}
            />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCardSkeleton}>
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 80, height: 10, marginBottom: 8 },
                ]}
              />
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 50, height: 28 },
                ]}
              />
            </View>
            <View style={styles.statCardSkeleton}>
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 80, height: 10, marginBottom: 8 },
                ]}
              />
              <View
                style={[
                  styles.skeleton,
                  styles.skeletonLight,
                  { width: 80, height: 28 },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Filter Tabs Skeleton */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterTabs}
          >
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.skeleton,
                  { width: 70, height: 36, borderRadius: 18, marginRight: 8 },
                ]}
              />
            ))}
          </ScrollView>

          {/* Orders Skeleton */}
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonOrderCard}>
              <View style={styles.skeletonOrderHeader}>
                <View>
                  <View
                    style={[
                      styles.skeleton,
                      { width: 100, height: 16, marginBottom: 6 },
                    ]}
                  />
                  <View style={[styles.skeleton, { width: 130, height: 12 }]} />
                </View>
                <View
                  style={[
                    styles.skeleton,
                    { width: 70, height: 24, borderRadius: 12 },
                  ]}
                />
              </View>
              <View style={styles.skeletonOrderCustomer}>
                <View
                  style={[
                    styles.skeleton,
                    { width: 40, height: 40, borderRadius: 20 },
                  ]}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View
                    style={[
                      styles.skeleton,
                      { width: "60%", height: 14, marginBottom: 6 },
                    ]}
                  />
                  <View
                    style={[styles.skeleton, { width: "40%", height: 12 }]}
                  />
                </View>
                <View style={[styles.skeleton, { width: 60, height: 20 }]} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statsHeaderTop}>
          <View>
            <Text style={styles.headerTitle}>Orders</Text>
            <Text style={styles.headerSubtitle}>Order Management</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY'S ORDERS</Text>
            <Text style={styles.statValue}>{getTodayOrdersCount()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY'S REVENUE</Text>
            <Text style={styles.statValue}>
              Rs.{calculateTodayRevenue().toFixed(0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabs}
        >
          {filterTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                statusFilter === tab.key && styles.filterTabActive,
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  statusFilter === tab.key && styles.filterTabTextActive,
                ]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section Header */}
        <Text style={styles.sectionTitle}>
          {statusFilter === "all"
            ? "Recent Orders"
            : statusFilter === "pending"
              ? "New Orders"
              : statusFilter === "accepted"
                ? "Active Orders"
                : "Completed Orders"}
        </Text>

        {/* Orders List */}
        <ScrollView
          style={styles.ordersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#22c55e"]}
            />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>📄</Text>
              </View>
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter === "all"
                  ? "Orders will appear here"
                  : `No ${statusFilter} orders`}
              </Text>
            </View>
          ) : (
            <>
              {filteredOrders.map((order) => {
                const deliveryStatus = getDeliveryStatus(order);
                const statusConfig = getStatusConfig(deliveryStatus);
                const driver = getDriver(order);
                const items = order.order_items || [];

                return (
                  <View key={order.id} style={styles.orderCard}>
                    {/* Order Header */}
                    <View style={styles.orderHeader}>
                      <View>
                        <View style={styles.orderIdRow}>
                          <Text style={styles.orderId}>
                            Order #{order.order_number || order.id?.slice(-6)}
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusConfig.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: statusConfig.text },
                              ]}
                            >
                              {statusConfig.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.orderTime}>
                          {formatTime(order.placed_at || order.created_at)}
                        </Text>
                      </View>
                      <Text style={styles.orderAmount}>
                        Rs.
                        {parseFloat(
                          order.subtotal || order.total_amount || 0,
                        ).toFixed(0)}
                      </Text>
                    </View>

                    {/* Customer Info */}
                    <View style={styles.customerRow}>
                      <View style={styles.customerInfo}>
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerAvatarIcon}>👤</Text>
                        </View>
                        <View>
                          <Text style={styles.customerName}>
                            {order.customer_name || "Customer"}
                          </Text>
                          <Text style={styles.customerPhone}>
                            {order.customer_phone || "-"}
                          </Text>
                        </View>
                      </View>
                      {order.customer_phone && (
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() =>
                            Linking.openURL(`tel:${order.customer_phone}`)
                          }
                        >
                          <Text style={styles.callIcon}>📞</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Food Items Preview */}
                    {items.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.itemsPreview}
                      >
                        {items.slice(0, 4).map((item, idx) => (
                          <View key={idx} style={styles.itemPreviewCard}>
                            {item.food_image_url ? (
                              <Image
                                source={{ uri: item.food_image_url }}
                                style={styles.itemImage}
                              />
                            ) : (
                              <View style={styles.itemImagePlaceholder}>
                                <Text style={styles.itemImageEmoji}>🍽️</Text>
                              </View>
                            )}
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.quantity}x{" "}
                              {item.food_name?.length > 12
                                ? item.food_name.slice(0, 12) + "..."
                                : item.food_name}
                            </Text>
                            {item.size && item.size !== "regular" && (
                              <Text style={styles.itemSize}>{item.size}</Text>
                            )}
                          </View>
                        ))}
                        {items.length > 4 && (
                          <View style={styles.moreItemsCard}>
                            <Text style={styles.moreItemsText}>
                              +{items.length - 4} more
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    )}

                    <View style={styles.divider} />

                    {/* Driver Info or Actions */}
                    {driver ? (
                      <View style={styles.driverRow}>
                        <View style={styles.driverInfo}>
                          <Text style={styles.driverLabel}>Driver</Text>
                          <View style={styles.driverBadge}>
                            <View style={styles.driverInitials}>
                              <Text style={styles.driverInitialsText}>
                                {driver.full_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2) || "D"}
                              </Text>
                            </View>
                            <Text style={styles.driverName}>
                              {driver.full_name || "Driver"}
                            </Text>
                          </View>
                        </View>
                        {driver.phone && (
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(`tel:${driver.phone}`)
                            }
                          >
                            <Text style={styles.driverCallIcon}>📞</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : deliveryStatus === "placed" ? (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAcceptOrder(order.id)}
                          disabled={processingOrderId === order.id}
                        >
                          <Text style={styles.acceptButtonText}>
                            {processingOrderId === order.id
                              ? "Processing..."
                              : "Accept Order"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectOrder(order.id)}
                          disabled={processingOrderId === order.id}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.statusRow}>
                        <Text style={styles.statusText}>
                          {deliveryStatus === "pending" ||
                          deliveryStatus === "accepted"
                            ? "Waiting for driver"
                            : deliveryStatus === "delivered"
                              ? "Order completed"
                              : deliveryStatus === "failed"
                                ? `Rejected: ${normalizeDeliveries(order.deliveries)[0]?.rejection_reason || "No reason provided"}`
                                : deliveryStatus === "cancelled"
                                  ? "Order cancelled"
                                  : "In progress"}
                        </Text>
                        <TouchableOpacity
                          style={styles.viewDetailsButton}
                          onPress={() => setSelectedOrder(order)}
                        >
                          <Text style={styles.viewDetailsText}>
                            View Details
                          </Text>
                          <Text style={styles.viewDetailsArrow}>›</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* End of list indicator */}
              <View style={styles.endOfList}>
                <Text style={styles.endOfListIcon}>✓</Text>
                <Text style={styles.endOfListText}>That's all for now</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Reject Reason Modal */}
      <Modal
        visible={rejectModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRejectModal({ open: false, orderId: null });
          setRejectReason("");
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setRejectModal({ open: false, orderId: null });
            setRejectReason("");
          }}
        >
          <Animated.View
            style={[
              styles.rejectModalContent,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.rejectModalHeader}>
                <Text style={styles.rejectModalTitle}>⚠️ Reject Order</Text>
                <Text style={styles.rejectModalSubtitle}>
                  This will notify the customer via message
                </Text>
              </View>
              <View style={styles.rejectModalBody}>
                <Text style={styles.rejectLabel}>
                  Reason for rejection <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.rejectInput}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="e.g. Out of stock, Restaurant closing soon..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.rejectModalButtons}>
                  <TouchableOpacity
                    style={styles.cancelRejectButton}
                    onPress={() => {
                      setRejectModal({ open: false, orderId: null });
                      setRejectReason("");
                    }}
                  >
                    <Text style={styles.cancelRejectText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmRejectButton,
                      !rejectReason.trim() && styles.buttonDisabled,
                    ]}
                    onPress={handleConfirmReject}
                    disabled={!rejectReason.trim()}
                  >
                    <Text style={styles.confirmRejectText}>
                      Confirm Rejection
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          getStatusConfig={getStatusConfig}
          getDeliveryStatus={getDeliveryStatus}
          getDriver={getDriver}
        />
      )}
    </SafeAreaView>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  getStatusConfig,
  getDeliveryStatus,
  getDriver,
}) {
  const deliveryStatus = getDeliveryStatus(order);
  const statusConfig = getStatusConfig(deliveryStatus);
  const driver = getDriver(order);
  const items = order.order_items || [];

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.detailsModalContent}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={styles.modalHandle}>
              <View style={styles.modalHandleBar} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.detailsHeader}>
                <View>
                  <Text style={styles.detailsOrderId}>
                    Order #{order.order_number || order.id?.slice(-6)}
                  </Text>
                  <Text style={styles.detailsTime}>
                    {formatDateTime(order.placed_at || order.created_at)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusConfig.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusConfig.text },
                    ]}
                  >
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              {/* Customer Info */}
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionLabel}>CUSTOMER</Text>
                <View style={styles.detailsCustomerCard}>
                  <View style={styles.detailsCustomerInfo}>
                    <View style={styles.detailsCustomerAvatar}>
                      <Text style={styles.detailsCustomerAvatarIcon}>👤</Text>
                    </View>
                    <View>
                      <Text style={styles.detailsCustomerName}>
                        {order.customer_name || "Customer"}
                      </Text>
                      <Text style={styles.detailsCustomerPhone}>
                        {order.customer_phone || "-"}
                      </Text>
                    </View>
                  </View>
                  {order.customer_phone && (
                    <TouchableOpacity
                      style={styles.detailsCallButton}
                      onPress={() =>
                        Linking.openURL(`tel:${order.customer_phone}`)
                      }
                    >
                      <Text style={styles.detailsCallIcon}>📞</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {order.delivery_address && (
                  <View style={styles.addressBox}>
                    <Text style={styles.addressLabel}>Delivery Address</Text>
                    <Text style={styles.addressText}>
                      {order.delivery_address}
                    </Text>
                  </View>
                )}
              </View>

              {/* Driver Info */}
              {driver && (
                <View style={styles.detailsSection}>
                  <Text
                    style={[styles.detailsSectionLabel, { color: "#15803d" }]}
                  >
                    ASSIGNED DRIVER
                  </Text>
                  <View style={styles.detailsDriverCard}>
                    <View style={styles.detailsDriverInfo}>
                      <View style={styles.detailsDriverAvatar}>
                        <Text style={styles.detailsDriverInitials}>
                          {driver.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2) || "D"}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.detailsDriverName}>
                          {driver.full_name || "Driver"}
                        </Text>
                        <Text style={styles.detailsDriverPhone}>
                          {driver.phone || "-"}
                        </Text>
                      </View>
                    </View>
                    {driver.phone && (
                      <TouchableOpacity
                        style={styles.detailsCallButton}
                        onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                      >
                        <Text style={styles.detailsCallIcon}>📞</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Order Items */}
              <View style={styles.detailsSection}>
                <Text style={styles.detailsSectionLabel}>ORDER ITEMS</Text>
                <View style={styles.itemsList}>
                  {items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      {item.food_image_url ? (
                        <Image
                          source={{ uri: item.food_image_url }}
                          style={styles.itemImageLarge}
                        />
                      ) : (
                        <View style={styles.itemImageLargePlaceholder}>
                          <Text style={styles.itemImageLargeEmoji}>🍽️</Text>
                        </View>
                      )}
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemNameLarge}>
                          {item.food_name}
                        </Text>
                        <Text style={styles.itemMeta}>
                          {item.size &&
                            item.size !== "regular" &&
                            `${item.size} • `}
                          Qty: {item.quantity}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>
                        Rs.
                        {parseFloat(
                          item.total_price || item.unit_price * item.quantity,
                        ).toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Order Summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Admin Total</Text>
                <Text style={styles.summaryAmount}>
                  Rs.{parseFloat(order.subtotal || 0).toFixed(0)}
                </Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  // Stats Header
  statsHeader: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  statsHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: {
    fontSize: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },

  // Main Content
  mainContent: {
    flex: 1,
    marginTop: -56,
    paddingHorizontal: 16,
  },

  // Notification Banner
  notificationBanner: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#166534",
  },
  notificationTime: {
    fontSize: 12,
    color: "#16a34a",
  },
  notificationClose: {
    fontSize: 18,
    color: "#16a34a",
    padding: 4,
  },

  // Filter Tabs
  filterTabs: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: "#065f46",
    borderColor: "#065f46",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
  filterTabTextActive: {
    color: "#fff",
  },

  // Section Title
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 10,
  },

  // Orders List
  ordersList: {
    flex: 1,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },

  // Order Card
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orderTime: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#22c55e",
  },

  // Customer Row
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarIcon: {
    fontSize: 18,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },
  customerPhone: {
    fontSize: 12,
    color: "#6b7280",
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  callIcon: {
    fontSize: 16,
  },

  // Items Preview
  itemsPreview: {
    marginVertical: 8,
  },
  itemPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginRight: 8,
    gap: 8,
  },
  itemImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  itemImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImageEmoji: {
    fontSize: 14,
  },
  itemName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  itemSize: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9ca3af",
    textTransform: "capitalize",
  },
  moreItemsCard: {
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    justifyContent: "center",
  },
  moreItemsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },

  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 12,
  },

  // Driver Row
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  driverLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  driverBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 6,
  },
  driverInitials: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitialsText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  driverName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#15803d",
  },
  driverCallIcon: {
    fontSize: 18,
    color: "#22c55e",
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  rejectButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    alignItems: "center",
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },

  // Status Row
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#16a34a",
  },
  viewDetailsArrow: {
    fontSize: 18,
    color: "#16a34a",
  },

  // End of List
  endOfList: {
    alignItems: "center",
    paddingVertical: 32,
    opacity: 0.4,
  },
  endOfListIcon: {
    fontSize: 32,
    color: "#9ca3af",
    marginBottom: 8,
  },
  endOfListText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  // Reject Modal
  rejectModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  rejectModalHeader: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  rejectModalSubtitle: {
    fontSize: 14,
    color: "#ef4444",
    marginTop: 4,
  },
  rejectModalBody: {
    padding: 20,
  },
  rejectLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
    minHeight: 80,
  },
  rejectModalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  cancelRejectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  cancelRejectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
  confirmRejectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  confirmRejectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Details Modal
  detailsModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailsOrderId: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  detailsTime: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailsSectionLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  detailsCustomerCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsCustomerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailsCustomerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCustomerAvatarIcon: {
    fontSize: 20,
  },
  detailsCustomerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  detailsCustomerPhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  detailsCallButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCallIcon: {
    fontSize: 18,
  },
  addressBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  addressLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  detailsDriverCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsDriverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailsDriverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsDriverInitials: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  detailsDriverName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  detailsDriverPhone: {
    fontSize: 14,
    color: "#6b7280",
  },

  // Items List
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  itemImageLarge: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  itemImageLargePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImageLargeEmoji: {
    fontSize: 24,
  },
  itemDetails: {
    flex: 1,
  },
  itemNameLarge: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  itemMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },

  // Summary
  summaryCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#16a34a",
  },

  // Close Button
  closeButton: {
    backgroundColor: "#f3f4f6",
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  // Skeleton Styles
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonLight: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  statCardSkeleton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  skeletonOrderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  skeletonOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  skeletonOrderCustomer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
