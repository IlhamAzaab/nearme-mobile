import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import { useSocket } from "../../context/SocketContext";
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";
import { getAccessToken } from "../../lib/authStorage";
import supabaseClient from "../../services/supabaseClient";

const ADMIN_ORDER_STATUS_EVENT = "admin:order_status_changed";

const PERIOD_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  all: "All Time",
};

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "New" },
  { key: "accepted", label: "Active" },
  { key: "delivered", label: "Done" },
];

const SUCCESS_EARNING_STATUSES = new Set([
  "picked_up",
  "on_the_way",
  "at_customer",
  "delivered",
]);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SRI_LANKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getSriLankaDateString = (date = new Date()) =>
  new Date(date.getTime() + SRI_LANKA_OFFSET_MS).toISOString().split("T")[0];

const getSriLankaDayStartMs = (dateStr) =>
  new Date(`${dateStr}T00:00:00+05:30`).getTime();

const getPeriodRangeMs = (period) => {
  if (period === "all") return null;

  const todayDateStr = getSriLankaDateString(new Date());
  const todayStart = getSriLankaDayStartMs(todayDateStr);

  switch (period) {
    case "today":
      return { start: todayStart, end: todayStart + ONE_DAY_MS };
    case "yesterday":
      return { start: todayStart - ONE_DAY_MS, end: todayStart };
    case "last7":
      return {
        start: todayStart - 6 * ONE_DAY_MS,
        end: todayStart + ONE_DAY_MS,
      };
    case "last30":
      return {
        start: todayStart - 29 * ONE_DAY_MS,
        end: todayStart + ONE_DAY_MS,
      };
    default:
      return null;
  }
};

const fetchRestaurantOrders = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing auth token. Please sign in again.");

  const response = await fetch(`${API_URL}/orders/restaurant/orders`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch orders");
  }

  return data.orders || [];
};

const fetchAdminRestaurant = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing auth token. Please sign in again.");

  const response = await fetch(`${API_URL}/admin/restaurant`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Failed to fetch restaurant");
  }

  return data.restaurant || null;
};

const updateRestaurantOrderStatus = async ({ orderId, status, reason }) => {
  const token = await getAccessToken();
  if (!token) throw new Error("Missing auth token. Please sign in again.");

  const response = await fetch(
    `${API_URL}/orders/restaurant/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Failed to update order status");
  }

  return data;
};

const normalizeDeliveries = (deliveries) => {
  if (!deliveries) return [];
  if (Array.isArray(deliveries)) return deliveries;
  return [deliveries];
};

const getDeliveryStatus = (order) => {
  const dels = normalizeDeliveries(order?.deliveries);
  return dels[0]?.status || order?.delivery_status || order?.status || "placed";
};

const getDriver = (order) => {
  const dels = normalizeDeliveries(order?.deliveries);
  return dels[0]?.drivers || null;
};

const getOrderPeriodAnchor = (order) => {
  const delivery = normalizeDeliveries(order?.deliveries)[0] || {};
  const status = getDeliveryStatus(order);

  if (SUCCESS_EARNING_STATUSES.has(status)) {
    return delivery.picked_up_at || null;
  }

  return (
    order?.placed_at ||
    delivery.res_accepted_at ||
    delivery.accepted_at ||
    delivery.created_at ||
    order?.created_at
  );
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

const formatTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${timeStr}`;
};

const getStatusConfig = (status) => {
  switch (status) {
    case "placed":
      return { label: "New Order", bg: "#fef3c7", text: "#d97706", icon: "🆕" };
    case "pending":
      return { label: "Pending", bg: "#dbeafe", text: "#2563eb", icon: "⏳" };
    case "accepted":
      return { label: "Accepted", bg: "#B8F0D0", text: "#06C168", icon: "✓" };
    case "picked_up":
      return { label: "Picked Up", bg: "#f3e8ff", text: "#9333ea", icon: "📦" };
    case "on_the_way":
      return {
        label: "On The Way",
        bg: "#e0f2fe",
        text: "#0284c7",
        icon: "🚗",
      };
    case "at_customer":
      return { label: "Arriving", bg: "#e0e7ff", text: "#4f46e5", icon: "📍" };
    case "delivered":
      return { label: "Delivered", bg: "#dcfce7", text: "#06C168", icon: "✅" };
    case "cancelled":
    case "rejected":
    case "failed":
      return {
        label: status === "cancelled" ? "Cancelled" : "Rejected",
        bg: "#fee2e2",
        text: "#dc2626",
        icon: "❌",
      };
    default:
      return {
        label: status || "Unknown",
        bg: "#f3f4f6",
        text: "#6b7280",
        icon: "•",
      };
  }
};

export default function Orders() {
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { on, off } = useSocket();

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const [rejectModal, setRejectModal] = useState({
    open: false,
    orderId: null,
  });
  const [rejectReason, setRejectReason] = useState("");
  const [period, setPeriod] = useState("today");
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [banner, setBanner] = useState(null);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const pageEnterStyle = usePageEnterAnimation();

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 2600);
  };

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", "restaurant"],
    queryFn: fetchRestaurantOrders,
    staleTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const restaurantQuery = useQuery({
    queryKey: ["admin", "restaurant"],
    queryFn: fetchAdminRestaurant,
    staleTime: 2 * 60 * 1000,
  });

  const acceptOrderMutation = useMutation({
    mutationFn: (orderId) =>
      updateRestaurantOrderStatus({
        orderId,
        status: "accepted",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });

  const rejectOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }) =>
      updateRestaurantOrderStatus({
        orderId,
        status: "rejected",
        reason,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });

  const loading =
    (ordersQuery.isLoading && !ordersQuery.data) ||
    (restaurantQuery.isLoading && !restaurantQuery.data);

  const error =
    ordersQuery.error?.message || restaurantQuery.error?.message || null;

  useEffect(() => {
    if (!ordersQuery.data) return;
    setOrders(ordersQuery.data);
  }, [ordersQuery.data]);

  useEffect(() => {
    setRefreshing(ordersQuery.isFetching || restaurantQuery.isFetching);
  }, [ordersQuery.isFetching, restaurantQuery.isFetching]);

  useEffect(() => {
    const requestedFilter = route.params?.statusFilter;
    const requestedOrderId = route.params?.orderId;

    if (!requestedFilter && !requestedOrderId) return;

    if (
      requestedFilter &&
      ["all", "pending", "accepted", "delivered"].includes(requestedFilter)
    ) {
      setStatusFilter(requestedFilter);
    }

    if (requestedOrderId && orders.length > 0) {
      const targetOrder = orders.find(
        (order) => String(order.id) === String(requestedOrderId),
      );
      if (targetOrder) {
        setSelectedOrder(targetOrder);
      }
    }

    navigation.setParams({
      statusFilter: undefined,
      orderId: undefined,
    });
  }, [navigation, orders, route.params?.orderId, route.params?.statusFilter]);

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
  }, [rejectModal.open, selectedOrder, slideAnim]);

  const bottomSafeSpacing = insets.bottom + 12;

  const applyLocalOrderStatusUpdate = useCallback(
    ({ orderId, deliveryId, status, reason }) => {
      const normalizedStatusRaw = String(status || "")
        .trim()
        .toLowerCase();

      if (!normalizedStatusRaw) return;

      const normalizedStatus =
        normalizedStatusRaw === "accepted"
          ? "pending"
          : normalizedStatusRaw === "rejected"
            ? "failed"
            : normalizedStatusRaw;

      const normalizedOrderId = orderId != null ? String(orderId) : null;
      const normalizedDeliveryId =
        deliveryId != null ? String(deliveryId) : null;

      console.log("[Orders] Applying status update:", {
        orderId: normalizedOrderId,
        deliveryId: normalizedDeliveryId,
        status: normalizedStatus,
      });

      setOrders((prevOrders) => {
        // When order is cancelled (no deliveryId specified), mark the entire order as cancelled
        if (normalizedStatus === "cancelled" && !normalizedDeliveryId) {
          return prevOrders.map((order) => {
            if (normalizedOrderId && String(order?.id) === normalizedOrderId) {
              // Mark all deliveries as cancelled
              const deliveries = normalizeDeliveries(order?.deliveries);
              const updatedDeliveries = deliveries.map((delivery) => ({
                ...delivery,
                status: "cancelled",
                rejection_reason: reason || delivery?.rejection_reason || null,
              }));
              return {
                ...order,
                status: "cancelled",
                deliveries: updatedDeliveries,
              };
            }
            return order;
          });
        }

        // Handle delivery-level status updates
        return prevOrders.map((order) => {
          const isOrderMatch =
            normalizedOrderId && String(order?.id) === normalizedOrderId;

          const deliveries = normalizeDeliveries(order?.deliveries);
          const hasMatchingDelivery =
            normalizedDeliveryId &&
            deliveries.some(
              (delivery) => String(delivery?.id) === normalizedDeliveryId,
            );

          if (!isOrderMatch && !hasMatchingDelivery) {
            return order;
          }

          const updatedDeliveries = deliveries.map((delivery) => {
            const shouldUpdate = normalizedDeliveryId
              ? String(delivery?.id) === normalizedDeliveryId
              : true;

            if (!shouldUpdate) return delivery;

            return {
              ...delivery,
              status: normalizedStatus,
              rejection_reason:
                normalizedStatus === "failed" || normalizedStatus === "cancelled"
                  ? reason || delivery?.rejection_reason || null
                  : delivery?.rejection_reason || null,
            };
          });

          return {
            ...order,
            deliveries: updatedDeliveries,
          };
        });
      });
    },
    [],
  );

  const fetchOrdersRef = useRef(async () => {});

  fetchOrdersRef.current = async (silent = false) => {
    try {
      if (!silent) setManualRefreshing(true);
      await Promise.all([ordersQuery.refetch(), restaurantQuery.refetch()]);
    } catch (err) {
      console.error("Failed to refresh orders", err);
    } finally {
      if (!silent) setManualRefreshing(false);
    }
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      ADMIN_ORDER_STATUS_EVENT,
      (payload) => {
        if (
          payload?.source === "orders_screen" ||
          payload?.source === "orders_socket"
        ) {
          return;
        }

        const orderId = payload?.orderId;
        const deliveryId = payload?.deliveryId;
        const status = payload?.status;

        if (!status) return;

        applyLocalOrderStatusUpdate({
          orderId,
          deliveryId,
          status,
          reason: payload?.reason || null,
        });

        fetchOrdersRef.current?.(true);
      },
    );

    return () => {
      subscription?.remove();
    };
  }, [applyLocalOrderStatusUpdate]);

  useEffect(() => {
    if (!on || !off) return;

    const handleOrderStatusChanged = (payload) => {
      const orderId = payload?.order_id || payload?.orderId;
      const deliveryId = payload?.delivery_id || payload?.deliveryId;
      const status = payload?.status;

      if (!status) return;

      applyLocalOrderStatusUpdate({
        orderId,
        deliveryId,
        status,
        reason: payload?.reason || payload?.rejection_reason || null,
      });

      if (orderId != null) {
        DeviceEventEmitter.emit(ADMIN_ORDER_STATUS_EVENT, {
          orderId: String(orderId),
          deliveryId: deliveryId != null ? String(deliveryId) : null,
          status,
          reason: payload?.reason || payload?.rejection_reason || null,
          source: "orders_socket",
        });
      }

      fetchOrdersRef.current?.(true);
    };

    on("order:status_changed", handleOrderStatusChanged);

    return () => {
      off("order:status_changed", handleOrderStatusChanged);
    };
  }, [applyLocalOrderStatusUpdate, off, on]);

  useEffect(() => {
    const newDeliverySubscription = supabaseClient
      .channel("deliveries:new-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deliveries",
        },
        () => {
          setNewOrderNotification({
            message: "New order received",
            timestamp: new Date(),
          });
          setTimeout(() => setNewOrderNotification(null), 5000);
          fetchOrdersRef.current?.(true);
        },
      )
      .subscribe();

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

            return newOrders;
          });

          fetchOrdersRef.current?.(true);
        },
      )
      .subscribe();

    return () => {
      newDeliverySubscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, []);

  const isInPeriod = (dateStr) => {
    if (period === "all") return true;
    if (!dateStr) return false;

    const ts = new Date(dateStr).getTime();
    if (Number.isNaN(ts)) return false;

    const range = getPeriodRangeMs(period);
    if (!range) return true;

    return ts >= range.start && ts < range.end;
  };

  const periodOrders = useMemo(
    () =>
      orders.filter((o) => {
        const relevantDate = getOrderPeriodAnchor(o);

        if (isInPeriod(relevantDate)) return true;

        // Keep carry-over unaccepted orders in today view.
        if (period === "today" && getDeliveryStatus(o) === "placed") {
          return true;
        }

        return false;
      }),
    [orders, period],
  );

  const periodCounts = useMemo(
    () => computeCounts(periodOrders),
    [periodOrders],
  );

  const filteredOrders = useMemo(
    () =>
      periodOrders.filter((order) => {
        const deliveryStatus = getDeliveryStatus(order);
        
        // Hide cancelled orders from all filtered views
        if (deliveryStatus === "cancelled") {
          return statusFilter === "all";
        }
        
        if (statusFilter === "all") return true;
        if (statusFilter === "pending") return deliveryStatus === "placed";
        if (statusFilter === "accepted") {
          return deliveryStatus === "pending" || deliveryStatus === "accepted";
        }
        if (statusFilter === "delivered") {
          return (
            deliveryStatus === "picked_up" ||
            deliveryStatus === "on_the_way" ||
            deliveryStatus === "at_customer" ||
            deliveryStatus === "delivered"
          );
        }
        return true;
      }),
    [periodOrders, statusFilter],
  );

  const getPeriodRevenue = () => {
    return periodOrders
      .filter((o) => SUCCESS_EARNING_STATUSES.has(getDeliveryStatus(o)))
      .reduce(
        (sum, o) =>
          sum +
          Number.parseFloat(
            o.admin_total ?? o.admin_subtotal ?? o.subtotal ?? 0,
          ),
        0,
      );
  };

  const getPeriodOrdersCount = () => {
    return periodOrders.filter((o) =>
      SUCCESS_EARNING_STATUSES.has(getDeliveryStatus(o)),
    ).length;
  };

  const handleAcceptOrder = async (orderId) => {
    setProcessingOrderId(orderId);

    try {
      await acceptOrderMutation.mutateAsync(orderId);

      applyLocalOrderStatusUpdate({
        orderId,
        status: "pending",
      });

      DeviceEventEmitter.emit(ADMIN_ORDER_STATUS_EVENT, {
        orderId: String(orderId),
        status: "pending",
        source: "orders_screen",
      });

      showBanner("success", "Order accepted!");
    } catch (err) {
      console.error("Failed to accept order", err);
      showBanner("error", err.message || "Failed to accept order");
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
      showBanner("error", "Please provide a reason for rejection");
      return;
    }

    setRejectModal({ open: false, orderId: null });
    setProcessingOrderId(orderId);

    try {
      await rejectOrderMutation.mutateAsync({
        orderId,
        reason: rejectReason.trim(),
      });

      applyLocalOrderStatusUpdate({
        orderId,
        status: "failed",
        reason: rejectReason.trim(),
      });

      DeviceEventEmitter.emit(ADMIN_ORDER_STATUS_EVENT, {
        orderId: String(orderId),
        status: "failed",
        reason: rejectReason.trim(),
        source: "orders_screen",
      });

      showBanner("success", "Order rejected");
    } catch (err) {
      console.error("Failed to reject order", err);
      showBanner("error", err.message || "Failed to reject order");
    } finally {
      setProcessingOrderId(null);
      setRejectReason("");
    }
  };

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient
          colors={["#24e68c", "#06c16a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsHeader}
        >
          <View style={styles.statsHeaderTop}>
            <View>
              <View
                style={[
                  styles.skeletonLight,
                  { width: 90, height: 24, marginBottom: 6 },
                ]}
              />
              <View
                style={[styles.skeletonLight, { width: 120, height: 12 }]}
              />
            </View>
            <View
              style={[
                styles.skeletonLight,
                { width: 36, height: 36, borderRadius: 18 },
              ]}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCardSkeleton} />
            <View style={styles.statCardSkeleton} />
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          <View style={styles.filtersRow}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={styles.filterSkeleton} />
            ))}
          </View>

          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.orderSkeletonCard} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Modal
        visible={showPeriodDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPeriodDropdown(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setShowPeriodDropdown(false)}
        >
          <View style={styles.periodDropdown}>
            {Object.entries(PERIOD_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.periodOption,
                  period === key ? styles.periodOptionActive : null,
                ]}
                onPress={() => {
                  setPeriod(key);
                  setShowPeriodDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    period === key ? styles.periodOptionTextActive : null,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <LinearGradient
        colors={["#24e68c", "#06c16a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statsHeader}
      >
        <View style={styles.statsHeaderTop}>
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>Orders</Text>
            <View style={styles.titleUnderline} />
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.periodPickerButton}
              onPress={() => setShowPeriodDropdown(true)}
            >
              <Text style={styles.periodPickerText}>
                {PERIOD_LABELS[period]}
              </Text>
              <Feather name="chevron-down" size={14} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roundRefreshButton}
              onPress={() => fetchOrdersRef.current(false)}
            >
              <Ionicons name="refresh" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            {/* Orders */}
            <Text style={styles.statLabel}>ORDERS</Text>
            <Text style={styles.statValue}>{getPeriodOrdersCount()}</Text>
          </View>

          <View style={styles.statCard}>
            {/* Revenue */}
            <Text style={styles.statLabel}>REVENUE</Text>
            <Text style={styles.statValue}>
              Rs.{getPeriodRevenue().toFixed(0)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Animated.View style={[styles.mainContentFloating, pageEnterStyle]}>
        {banner ? (
          <View
            style={[
              styles.actionBanner,
              banner.type === "success"
                ? styles.actionBannerSuccess
                : styles.actionBannerError,
            ]}
          >
            <Text
              style={[
                styles.actionBannerText,
                banner.type === "success"
                  ? styles.actionBannerTextSuccess
                  : styles.actionBannerTextError,
              ]}
            >
              {banner.message}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {newOrderNotification ? (
          <View style={styles.notificationBanner}>
            <View style={styles.notificationLeft}>
              <MaterialCommunityIcons
                name="bell-ring"
                size={20}
                color="#15803d"
              />
              <View>
                <Text style={styles.notificationTitle}>
                  {newOrderNotification.message}
                </Text>
                <Text style={styles.notificationTime}>Just now</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setNewOrderNotification(null)}>
              <Feather name="x" size={16} color="#16a34a" />
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersRow}
          contentContainerStyle={styles.filtersRowContent}
        >
          {STATUS_FILTERS.map((tab) => {
            const tabCount = periodCounts[tab.key] || 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  statusFilter === tab.key ? styles.filterTabActive : null,
                ]}
                onPress={() => setStatusFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    statusFilter === tab.key
                      ? styles.filterTabTextActive
                      : null,
                  ]}
                >
                  {tab.label} ({tabCount})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>
          {statusFilter === "all"
            ? "Recent Orders"
            : statusFilter === "pending"
              ? "New Orders"
              : statusFilter === "accepted"
                ? "Active Orders"
                : "Completed Orders"}
        </Text>

        <ScrollView
          style={styles.ordersList}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={manualRefreshing}
              onRefresh={() => fetchOrdersRef.current(false)}
              colors={["#06C168"]}
              tintColor="#06C168"
            />
          }
        >
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="file-text" size={30} color="#9ca3af" />
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
                const showDriverContact =
                  !!driver &&
                  [
                    "accepted",
                    "picked_up",
                    "on_the_way",
                    "at_customer",
                    "delivered",
                  ].includes(deliveryStatus);

                const fullDeliveryAddress = [
                  order.delivery_address,
                  order.delivery_city || order.city || order.customer_city,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    activeOpacity={0.92}
                    onPress={() => setSelectedOrder(order)}
                  >
                    <View style={styles.orderHeaderRow}>
                      <View style={styles.orderHeaderLeft}>
                        <View style={styles.orderIdBadgeRow}>
                          <Text style={styles.orderIdText}>
                            Order #
                            {order.order_number ||
                              String(order.id || "").slice(-6)}
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
                        <Text style={styles.orderTimeText}>
                          {formatTime(order.placed_at || order.created_at)}
                        </Text>
                      </View>

                      <Text style={styles.orderAmountText}>
                        Rs.
                        {Number.parseFloat(
                          order.subtotal || order.total_amount || 0,
                        ).toFixed(0)}
                      </Text>
                    </View>

                    <View style={styles.customerRow}>
                      <View style={styles.customerLeft}>
                        <View style={styles.customerAvatar}>
                          <Feather name="user" size={16} color="#9ca3af" />
                        </View>
                        <View style={styles.customerTextWrap}>
                          <Text style={styles.customerName}>
                            {order.customer_name || "Customer"}
                          </Text>
                          {fullDeliveryAddress ? (
                            <Text style={styles.customerAddress}>
                              {fullDeliveryAddress}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {items.length > 0 ? (
                      <View style={styles.itemsListWrap}>
                        {items.map((item, idx) => (
                          <View
                            key={`${order.id}-item-${idx}`}
                            style={styles.itemRowCard}
                          >
                            {item.food_image_url ? (
                              <Image
                                source={{ uri: item.food_image_url }}
                                style={styles.itemImage}
                              />
                            ) : (
                              <View style={styles.itemImageFallback}>
                                <Text style={styles.itemImageEmoji}>🍽️</Text>
                              </View>
                            )}

                            <View style={styles.itemInfoCol}>
                              <View style={styles.itemTopRow}>
                                <Text style={styles.itemNameText}>
                                  {item.quantity}x{" "}
                                  {item.food_name || "Food item"}
                                </Text>
                                <Text style={styles.itemLineAmount}>
                                  Rs.
                                  {Number.parseFloat(
                                    item.total_price ||
                                      item.unit_price * item.quantity ||
                                      0,
                                  ).toFixed(0)}
                                </Text>
                              </View>

                              {item.size ? (
                                <Text style={styles.itemSizePill}>
                                  {item.size}
                                </Text>
                              ) : null}

                              <Text style={styles.itemUnitPrice}>
                                Rs.
                                {Number.parseFloat(
                                  item.unit_price || 0,
                                ).toFixed(0)}{" "}
                                each
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.cardDivider} />

                    {driver ? (
                      <View style={styles.driverRow}>
                        <View style={styles.driverLeft}>
                          <Text style={styles.driverLabel}>Driver</Text>
                          <View style={styles.driverBadge}>
                            <View style={styles.driverInitialsCircle}>
                              <Text style={styles.driverInitialsText}>
                                {driver.full_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2) || "D"}
                              </Text>
                            </View>
                            <Text style={styles.driverNameText}>
                              {driver.full_name || "Driver"}
                            </Text>
                            {showDriverContact && driver.phone ? (
                              <Text style={styles.driverPhoneInline}>
                                {driver.phone}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {showDriverContact && driver.phone ? (
                          <TouchableOpacity
                            onPress={() =>
                              Linking.openURL(`tel:${driver.phone}`)
                            }
                          >
                            <Feather name="phone" size={18} color="#06C168" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : deliveryStatus === "placed" ? (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          disabled={processingOrderId === order.id}
                          onPress={() => handleAcceptOrder(order.id)}
                        >
                          <Text style={styles.acceptButtonText}>
                            {processingOrderId === order.id
                              ? "Processing..."
                              : "Accept Order"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.rejectButton}
                          disabled={processingOrderId === order.id}
                          onPress={() => handleRejectOrder(order.id)}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.statusFooterRow}>
                        <Text style={styles.statusFooterText}>
                          {deliveryStatus === "pending" ||
                          deliveryStatus === "accepted"
                            ? "Waiting for driver"
                            : deliveryStatus === "delivered"
                              ? "Order completed"
                              : deliveryStatus === "failed" ||
                                  deliveryStatus === "rejected"
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
                          <Feather
                            name="chevron-right"
                            size={14}
                            color="#06C168"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.endListWrap}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={34}
                  color="#9ca3af"
                />
                <Text style={styles.endListText}>That is all for now</Text>
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>

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
          style={styles.rejectModalOverlay}
          onPress={() => {
            setRejectModal({ open: false, orderId: null });
            setRejectReason("");
          }}
        >
          <View style={styles.rejectModalShell}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.rejectModalHeader}>
                <Text style={styles.rejectModalTitle}>Reject Order</Text>
                <Text style={styles.rejectModalSubtitle}>
                  This will notify the customer via message
                </Text>
              </View>

              <View style={styles.rejectModalBody}>
                <Text style={styles.rejectLabel}>Reason for rejection *</Text>
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

                <View style={styles.rejectButtonsRow}>
                  <TouchableOpacity
                    style={styles.rejectCancelButton}
                    onPress={() => {
                      setRejectModal({ open: false, orderId: null });
                      setRejectReason("");
                    }}
                  >
                    <Text style={styles.rejectCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.rejectConfirmButton,
                      !rejectReason.trim() ? styles.buttonDisabled : null,
                    ]}
                    disabled={!rejectReason.trim()}
                    onPress={handleConfirmReject}
                  >
                    <Text style={styles.rejectConfirmText}>
                      Confirm Rejection
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {selectedOrder ? (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          getStatusConfig={getStatusConfig}
          getDeliveryStatus={getDeliveryStatus}
          getDriver={getDriver}
          onAccept={handleAcceptOrder}
          onReject={handleRejectOrder}
          processingOrderId={processingOrderId}
          bottomSafeSpacing={bottomSafeSpacing}
        />
      ) : null}
    </SafeAreaView>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  getStatusConfig,
  getDeliveryStatus,
  getDriver,
  onAccept,
  onReject,
  processingOrderId,
  bottomSafeSpacing,
}) {
  const deliveryStatus = getDeliveryStatus(order);
  const statusConfig = getStatusConfig(deliveryStatus);
  const driver = getDriver(order);
  const items = order.order_items || [];

  const showDriverContact =
    !!driver &&
    [
      "accepted",
      "picked_up",
      "on_the_way",
      "at_customer",
      "delivered",
    ].includes(deliveryStatus);

  const fullDeliveryAddress = [
    order.delivery_address,
    order.delivery_city || order.city || order.customer_city,
  ]
    .filter(Boolean)
    .join(", ");

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.detailsModalSheet}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandleBar} />
            </View>

            <ScrollView
              style={styles.detailsScroll}
              contentContainerStyle={{ paddingBottom: bottomSafeSpacing }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailsHeader}>
                <View>
                  <Text style={styles.detailsOrderId}>
                    Order #
                    {order.order_number || String(order.id || "").slice(-6)}
                  </Text>
                  <Text style={styles.detailsTime}>
                    {formatDateTime(order.placed_at || order.created_at)}
                  </Text>
                </View>

                <View style={styles.detailsHeaderRight}>
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
                  <TouchableOpacity
                    style={styles.closeIconButton}
                    onPress={onClose}
                  >
                    <Feather name="x" size={15} color="#4b5563" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailSectionCard}>
                <Text style={styles.detailSectionLabel}>CUSTOMER</Text>
                <View style={styles.detailCustomerRow}>
                  <View style={styles.detailCustomerLeft}>
                    <View style={styles.detailAvatarCircle}>
                      <Feather name="user" size={17} color="#9ca3af" />
                    </View>
                    <Text style={styles.detailCustomerName}>
                      {order.customer_name || "Customer"}
                    </Text>
                  </View>
                </View>

                {fullDeliveryAddress ? (
                  <View style={styles.addressBlock}>
                    <Text style={styles.addressLabel}>Delivery Address</Text>
                    <Text style={styles.addressText}>
                      {fullDeliveryAddress}
                    </Text>
                  </View>
                ) : null}
              </View>

              {driver ? (
                <View style={styles.detailDriverCard}>
                  <Text
                    style={[styles.detailSectionLabel, { color: "#15803d" }]}
                  >
                    ASSIGNED DRIVER
                  </Text>
                  <View style={styles.detailDriverRow}>
                    <View style={styles.detailDriverLeft}>
                      <View style={styles.detailDriverAvatar}>
                        <Text style={styles.detailDriverInitials}>
                          {driver.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2) || "D"}
                        </Text>
                      </View>

                      <View>
                        <Text style={styles.detailDriverName}>
                          {driver.full_name || "Driver"}
                        </Text>
                        {showDriverContact && driver.phone ? (
                          <Text style={styles.detailDriverPhone}>
                            {driver.phone}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {showDriverContact && driver.phone ? (
                      <TouchableOpacity
                        style={styles.driverCallRound}
                        onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                      >
                        <Feather name="phone" size={15} color="#ffffff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.detailItemsSection}>
                <Text style={styles.detailSectionLabel}>
                  ORDER ITEMS ({items.length})
                </Text>
                <View style={styles.detailItemsList}>
                  {items.map((item, index) => (
                    <View
                      key={`${order.id}-details-item-${index}`}
                      style={styles.detailItemCard}
                    >
                      {item.food_image_url ? (
                        <Image
                          source={{ uri: item.food_image_url }}
                          style={styles.detailItemImage}
                        />
                      ) : (
                        <View style={styles.detailItemImageFallback}>
                          <Text style={styles.detailItemEmoji}>🍽️</Text>
                        </View>
                      )}

                      <View style={styles.detailItemInfo}>
                        <Text style={styles.detailItemName} numberOfLines={1}>
                          {item.food_name}
                        </Text>

                        <View style={styles.detailItemMetaRow}>
                          {item.size ? (
                            <Text style={styles.detailItemSize}>
                              {item.size}
                            </Text>
                          ) : null}
                          <Text style={styles.detailItemQty}>
                            x{item.quantity}
                          </Text>
                        </View>

                        <Text style={styles.detailItemUnitPrice}>
                          Rs.
                          {Number.parseFloat(item.unit_price || 0).toFixed(
                            0,
                          )}{" "}
                          each
                        </Text>
                      </View>

                      <Text style={styles.detailItemTotal}>
                        Rs.
                        {Number.parseFloat(
                          item.total_price ||
                            item.unit_price * item.quantity ||
                            0,
                        ).toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Admin Total</Text>
                <Text style={styles.summaryAmount}>
                  Rs.{Number.parseFloat(order.subtotal || 0).toFixed(0)}
                </Text>
              </View>

              {deliveryStatus === "placed" ? (
                <View style={styles.detailsActionRow}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    disabled={processingOrderId === order.id}
                    onPress={() => {
                      onAccept(order.id);
                      onClose();
                    }}
                  >
                    <Text style={styles.acceptButtonText}>
                      {processingOrderId === order.id
                        ? "Processing..."
                        : "Accept Order"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    disabled={processingOrderId === order.id}
                    onPress={() => {
                      onReject(order.id);
                      onClose();
                    }}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={onClose}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
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
    backgroundColor: "#f8fafc",
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 96,
    paddingRight: 16,
  },
  periodDropdown: {
    width: 170,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    overflow: "hidden",
  },
  periodOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  periodOptionActive: {
    backgroundColor: "#ecfdf5",
  },
  periodOptionText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  periodOptionTextActive: {
    color: "#16a34a",
    fontWeight: "700",
  },

  statsHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 54,
  },
  statsHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  titleWrap: {
    alignItems: "flex-end",
    paddingRight: 6,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "500",
    color: "#111827",
    lineHeight: 35,
  },
  titleUnderline: {
    marginTop: 3,
    width: 44,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  periodPickerText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  roundRefreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  statLabel: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  statValue: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 2,
  },

  mainContentFloating: {
    flex: 1,
    marginTop: -36,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  actionBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  actionBannerSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
  actionBannerError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  actionBannerText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionBannerTextSuccess: {
    color: "#047857",
  },
  actionBannerTextError: {
    color: "#b91c1c",
  },

  notificationBanner: {
    backgroundColor: "#dcfce7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#9EEBBE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "700",
  },
  notificationTime: {
    marginTop: 1,
    color: "#16a34a",
    fontSize: 11,
  },

  filtersRow: {
    marginBottom: 11,
    maxHeight: 38,
    flexGrow: 0,
    alignSelf: "flex-start",
  },
  filtersRowContent: {
    paddingRight: 8,
    alignItems: "center",
  },
  filterTab: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#ffffff",
    borderWidth: 0.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  filterTabActive: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  filterTabText: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#ffffff",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 10,
  },

  ordersList: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
  },
  emptyIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 4,
    color: "#9ca3af",
    fontSize: 13,
  },

  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 12,
    marginBottom: 10,
  },
  orderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  orderHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderIdBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  orderIdText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  orderTimeText: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  orderAmountText: {
    color: "#4ade80",
    fontSize: 16,
    fontWeight: "800",
  },

  customerRow: {
    paddingVertical: 2,
  },
  customerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  customerTextWrap: {
    flex: 1,
  },
  customerName: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
  },
  customerAddress: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },

  itemsListWrap: {
    marginTop: 8,
    gap: 6,
  },
  itemRowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 8,
  },
  itemImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  itemImageFallback: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImageEmoji: {
    fontSize: 14,
  },
  itemInfoCol: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemNameText: {
    flex: 1,
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  itemLineAmount: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },
  itemSizePill: {
    marginTop: 2,
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    textTransform: "uppercase",
  },
  itemUnitPrice: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
  },

  cardDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 9,
  },

  driverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  driverLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  driverLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  driverBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E6F9F1",
    borderWidth: 1,
    borderColor: "#B8F0D0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
  },
  driverInitialsCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitialsText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  driverNameText: {
    color: "#15803d",
    fontSize: 11,
    fontWeight: "800",
  },
  driverPhoneInline: {
    color: "#15803d",
    fontSize: 11,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  acceptButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  rejectButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButtonText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "800",
  },

  statusFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusFooterText: {
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    flex: 1,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewDetailsText: {
    color: "#06C168",
    fontSize: 12,
    fontWeight: "800",
  },

  endListWrap: {
    alignItems: "center",
    paddingVertical: 24,
    opacity: 0.45,
    gap: 6,
  },
  endListText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },

  rejectModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  rejectModalShell: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  rejectModalHeader: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rejectModalTitle: {
    color: "#991b1b",
    fontSize: 18,
    fontWeight: "800",
  },
  rejectModalSubtitle: {
    marginTop: 3,
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
  rejectModalBody: {
    padding: 16,
  },
  rejectLabel: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  rejectInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
  },
  rejectButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  rejectCancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  rejectCancelText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
  },
  rejectConfirmButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  rejectConfirmText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  detailsModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
  },
  modalHandleWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
  },
  detailsScroll: {
    maxHeight: "100%",
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailsOrderId: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "800",
  },
  detailsTime: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  detailsHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  detailSectionCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
  },
  detailSectionLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailCustomerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  detailCustomerName: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "800",
  },
  addressBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  addressLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  addressText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },

  detailDriverCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#E6F9F1",
    borderWidth: 1,
    borderColor: "#B8F0D0",
    borderRadius: 12,
    padding: 12,
  },
  detailDriverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailDriverLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailDriverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  detailDriverInitials: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  detailDriverName: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
  },
  detailDriverPhone: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  driverCallRound: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },

  detailItemsSection: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  detailItemsList: {
    gap: 8,
  },
  detailItemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 10,
    padding: 10,
  },
  detailItemImage: {
    width: 54,
    height: 54,
    borderRadius: 8,
  },
  detailItemImageFallback: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  detailItemEmoji: {
    fontSize: 24,
  },
  detailItemInfo: {
    flex: 1,
  },
  detailItemName: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
  },
  detailItemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  detailItemSize: {
    backgroundColor: "#d1fae5",
    color: "#047857",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailItemQty: {
    backgroundColor: "#e5e7eb",
    color: "#4b5563",
    fontSize: 10,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailItemUnitPrice: {
    marginTop: 2,
    color: "#9ca3af",
    fontSize: 11,
  },
  detailItemTotal: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
  },

  summaryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryAmount: {
    color: "#10b981",
    fontSize: 24,
    fontWeight: "800",
  },

  detailsActionRow: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  modalCloseButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  modalCloseButtonText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },

  skeletonLight: {
    backgroundColor: "rgba(255,255,255,0.32)",
    borderRadius: 8,
  },
  statCardSkeleton: {
    flex: 1,
    height: 78,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  filterSkeleton: {
    width: 82,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
  },
  orderSkeletonCard: {
    height: 152,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
    marginBottom: 10,
  },
});
