import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import {
  ACTIVE_STATUSES,
  PAST_STATUSES,
  getOrderStatus,
  useOrders,
} from "../../context/OrderContext";
import { formatETAClockTime } from "../../utils/etaFormatter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIMARY = "#06C168";
const PRIMARY_DARK = "#06C168";
const TEXT_DARK = "#111812";
const TEXT_MUTED = "#64748B";
const TEXT_GRAY = "#6B7280";
const BORDER = "#F1F5F9";
const BG = "#FFFFFF";
const ORDER_TOTAL_CACHE_KEY = "@order_display_totals";

const getCachedOrderDisplayTotal = async (orderId) => {
  if (!orderId) return NaN;

  try {
    const raw = await AsyncStorage.getItem(ORDER_TOTAL_CACHE_KEY);
    if (!raw) return NaN;
    const map = JSON.parse(raw);
    const n = Number(map?.[String(orderId)]);
    return Number.isFinite(n) ? n : NaN;
  } catch {
    return NaN;
  }
};

const resolveOrderDisplayTotal = (orderLike, fallback = 0) => {
  const candidates = [
    orderLike?.grand_total,
    orderLike?.final_total,
    orderLike?.payable_amount,
    orderLike?.total_amount,
    orderLike?.total,
    fallback,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const n = Number(candidates[i]);
    if (Number.isFinite(n)) return n;
  }

  return 0;
};

const STATUS_CONFIG = {
  placed: { bg: "rgba(217,119,6,0.1)", color: "#D97706", label: "PLACED" },
  pending: { bg: "rgba(234,88,12,0.1)", color: "#EA580C", label: "PENDING" },
  accepted: {
    bg: "rgba(37,99,235,0.1)",
    color: "#2563EB",
    label: "DRIVER ASSIGNED",
  },
  driver_accepted: {
    bg: "rgba(37,99,235,0.1)",
    color: "#2563EB",
    label: "DRIVER ASSIGNED",
  },
  driver_assigned: {
    bg: "rgba(37,99,235,0.1)",
    color: "#2563EB",
    label: "DRIVER ASSIGNED",
  },
  received: {
    bg: "rgba(147,51,234,0.1)",
    color: "#9333EA",
    label: "PREPARING",
  },
  preparing: {
    bg: "rgba(147,51,234,0.1)",
    color: "#9333EA",
    label: "PREPARING",
  },
  ready: { bg: "rgba(79,70,229,0.1)", color: "#4F46E5", label: "READY" },
  picked_up: {
    bg: "rgba(8,145,178,0.1)",
    color: "#0891B2",
    label: "PICKED UP",
  },
  on_the_way: {
    bg: "rgba(5,150,105,0.1)",
    color: "#06C168",
    label: "ON THE WAY",
  },
  delivered: {
    bg: "rgba(5,150,105,0.1)",
    color: "#06C168",
    label: "DELIVERED",
  },
  cancelled: {
    bg: "rgba(220,38,38,0.1)",
    color: "#DC2626",
    label: "CANCELLED",
  },
  rejected: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", label: "REJECTED" },
  // Uppercase variants
  PLACED: { bg: "rgba(217,119,6,0.1)", color: "#D97706", label: "PLACED" },
  DRIVER_ACCEPTED: {
    bg: "rgba(37,99,235,0.1)",
    color: "#2563EB",
    label: "DRIVER ASSIGNED",
  },
  RECEIVED: {
    bg: "rgba(147,51,234,0.1)",
    color: "#9333EA",
    label: "PREPARING",
  },
  PICKED_UP: {
    bg: "rgba(8,145,178,0.1)",
    color: "#0891B2",
    label: "PICKED UP",
  },
  ON_THE_WAY: {
    bg: "rgba(5,150,105,0.1)",
    color: "#06C168",
    label: "ON THE WAY",
  },
  DELIVERED: {
    bg: "rgba(5,150,105,0.1)",
    color: "#06C168",
    label: "DELIVERED",
  },
  CANCELLED: {
    bg: "rgba(220,38,38,0.1)",
    color: "#DC2626",
    label: "CANCELLED",
  },
  REJECTED: { bg: "rgba(220,38,38,0.1)", color: "#DC2626", label: "REJECTED" },
};

// ─── Animated Order Card Wrapper ─────────────────────────────────────────────
function AnimatedOrderCard({ children, isNew, delay = 0 }) {
  const fadeAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(isNew ? 30 : 0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isNew]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── 6-Segment Progress Steps ────────────────────────────────────────────────
const ORDER_STEPS = [
  { key: "placed" },
  { key: "pending" },
  { key: "accepted" },
  { key: "picked_up" },
  { key: "on_the_way" },
  { key: "delivered" },
];

const getStepIndex = (status) => {
  switch (status) {
    case "placed":
      return 0;
    case "pending":
    case "received":
    case "preparing":
    case "ready":
      return 1;
    case "accepted":
    case "driver_accepted":
    case "driver_assigned":
      return 2;
    case "picked_up":
      return 3;
    case "on_the_way":
      return 4;
    case "delivered":
      return 5;
    default:
      return 0;
  }
};

const getProgressLabel = (status) => {
  switch (status) {
    case "placed":
      return "Order placed";
    case "pending":
    case "received":
    case "preparing":
      return "Preparing your order";
    case "ready":
      return "Ready for pickup";
    case "accepted":
    case "driver_accepted":
    case "driver_assigned":
      return "Driver assigned";
    case "picked_up":
      return "Order picked up";
    case "on_the_way":
      return "On the way to you";
    case "delivered":
      return "Delivered";
    default:
      return "Order placed";
  }
};

// ─── Animated Segment (matching OrderTracking sweep animation) ───────────────
const AnimatedSeg = React.memo(({ active, done }) => {
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      flow.setValue(0);
      const loop = Animated.loop(
        Animated.timing(flow, {
          toValue: 1,
          duration: 1300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }

    flow.stopAnimation();
    flow.setValue(0);
  }, [active]);

  if (done) {
    return <View style={[styles.segment, styles.segmentFilled]} />;
  }

  if (active) {
    const sweepLead = flow.interpolate({
      inputRange: [0, 1],
      outputRange: [-26, 82],
    });
    const sweepTrail = flow.interpolate({
      inputRange: [0, 1],
      outputRange: [-56, 52],
    });

    return (
      <View style={[styles.segment, styles.segmentActive]}>
        <Animated.View
          style={[
            styles.segmentSweep,
            {
              opacity: 0.95,
              transform: [{ translateX: sweepLead }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.segmentSweep,
            {
              opacity: 0.5,
              transform: [{ translateX: sweepTrail }],
            },
          ]}
        />
      </View>
    );
  }

  return <View style={[styles.segment, styles.segmentEmpty]} />;
});

// ─── 6-Segment Progress Bar Component ────────────────────────────────────────
function SegmentedProgress({ currentStatus }) {
  const stepIndex = getStepIndex(currentStatus);

  return (
    <View style={styles.segmentContainer}>
      <Text style={styles.progressLabel}>
        {getProgressLabel(currentStatus)}
      </Text>
      <View style={styles.segmentRow}>
        {ORDER_STEPS.map((step, i) => (
          <AnimatedSeg
            key={step.key}
            done={i <= stepIndex}
            active={stepIndex < ORDER_STEPS.length - 1 && i === stepIndex + 1}
          />
        ))}
      </View>
    </View>
  );
}

// ─── ETA Helper ──────────────────────────────────────────────────────────────
const getEstimatedTime = (status, order) => {
  // Only show ETA after driver accepts
  const showEtaStatuses = [
    "accepted",
    "driver_accepted",
    "driver_assigned",
    "received",
    "preparing",
    "ready",
    "picked_up",
    "on_the_way",
  ];
  if (!showEtaStatuses.includes(status)) return "";

  const baseMins = order?.estimated_duration_min;
  if (baseMins && baseMins > 0) {
    let factor = 1;
    switch (status) {
      case "accepted":
      case "driver_accepted":
      case "driver_assigned":
        factor = 0.65;
        break;
      case "received":
      case "preparing":
      case "ready":
        factor = 0.5;
        break;
      case "picked_up":
        factor = 0.45;
        break;
      case "on_the_way":
        factor = 0.35;
        break;
      default:
        return "";
    }
    const low = Math.max(1, Math.round(baseMins * factor));
    const high = Math.max(low + 5, Math.round(baseMins * factor * 1.3));
    const isOnTheWay = status === "on_the_way";
    return formatETAClockTime(low, isOnTheWay ? low : high, { isOnTheWay });
  }
  // Fallback static estimates
  const fallbacks = {
    accepted: [10, 15],
    driver_accepted: [10, 15],
    driver_assigned: [10, 15],
    received: [8, 12],
    preparing: [8, 12],
    ready: [5, 10],
    picked_up: [5, 10],
    on_the_way: [5, 5],
  };
  const range = fallbacks[status];
  if (!range) return "";
  const isOnTheWay = status === "on_the_way";
  return formatETAClockTime(range[0], range[1], { isOnTheWay });
};

const getOrderIdentityKey = (order) => {
  if (!order) return "";

  const candidates = [
    order.id,
    order.order_id,
    order.orderId,
    order._identityKey,
    order.order_number,
    order.orderNumber,
  ];

  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }

  return "";
};

const getOrderRenderKey = (order, index = 0) => {
  const identity = getOrderIdentityKey(order);
  if (identity) return identity;

  const createdAt = String(order?.created_at || order?.placed_at || "").trim();
  const restaurant = String(
    order?.restaurant_id || order?.restaurant_name || "",
  ).trim();
  const fallback = `${createdAt}-${restaurant}-${index}`;
  return fallback || `order-${index}`;
};

const getStatusScreenName = (status) => {
  switch (status) {
    case "placed":
      return "PlacingOrder";
    case "pending":
    case "received":
    case "preparing":
    case "ready":
      return "OrderReceived";
    case "accepted":
    case "driver_accepted":
    case "driver_assigned":
      return "DriverAccepted";
    case "picked_up":
      return "OrderPickedUp";
    case "on_the_way":
      return "OrderOnTheWay";
    case "delivered":
      return "OrderDelivered";
    default:
      return "OrderReceived";
  }
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function OrdersScreen({ navigation }) {
  const {
    orders,
    loading,
    refreshing,
    newOrderIds,
    hasNewOrder,
    fetchOrders,
    markOrdersSeen,
  } = useOrders();

  const [activeTab, setActiveTab] = useState("active");
  const [pastFilter, setPastFilter] = useState("all");
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const flatListRef = useRef(null);

  // Fetch on every focus
  const isFirstLoad = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        fetchOrders("initial");
      } else {
        fetchOrders("silent");
      }
      markOrdersSeen();
    }, [fetchOrders, markOrdersSeen]),
  );

  // Auto-switch to Active tab & scroll to top when new order arrives
  useEffect(() => {
    if (hasNewOrder) {
      setActiveTab("active");
      setTimeout(() => {
        flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
      }, 200);
    }
  }, [hasNewOrder]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const formatPrice = (p) => {
    const n = Number(p);
    return Number.isNaN(n) ? "Rs. 0.00" : `Rs. ${n.toFixed(2)}`;
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getPastStatus = (order) => {
    const status = getOrderStatus(order);
    const rawStatus = String(
      order?.status || order?.order_status || order?.delivery_status || "",
    )
      .trim()
      .toLowerCase();

    if (
      status === "cancelled" ||
      status === "rejected" ||
      rawStatus.includes("cancel") ||
      rawStatus.includes("reject")
    ) {
      return "cancelled";
    }
    return "delivered";
  };

  const getPastStatusTime = (order, pastStatus) => {
    if (pastStatus === "cancelled") {
      return (
        order?.cancelled_at ||
        order?.canceled_at ||
        order?.cancelledAt ||
        order?.rejected_at ||
        order?.rejectedAt ||
        order?.updatedAt ||
        order?.createdAt ||
        order?.updated_at ||
        order?.created_at
      );
    }

    return (
      order?.delivered_at ||
      order?.deliveredAt ||
      order?.completed_at ||
      order?.updated_at ||
      order?.created_at
    );
  };

  const navigateToOrder = async (order) => {
    const resolvedStatus = getOrderStatus(order);
    const orderId =
      order?.id ||
      order?.order_id ||
      order?.orderId ||
      getOrderIdentityKey(order);
    const target = getStatusScreenName(resolvedStatus);
    const cachedTotal = await getCachedOrderDisplayTotal(orderId);
    const displayTotal = Number.isFinite(cachedTotal)
      ? cachedTotal
      : resolveOrderDisplayTotal(order);

    navigation.navigate(target, {
      orderId,
      status: resolvedStatus,
      order: order,
      totalAmount: displayTotal,
      restaurantName: order?.restaurant_name,
      restaurantLogoUrl: order?.restaurant_logo_url || order?.restaurant_logo,
      driverName: order?.driver_name,
      statusScreenMode: true,
    });
  };

  const activeOrders = useMemo(
    () =>
      (orders || []).filter((o) => ACTIVE_STATUSES.includes(getOrderStatus(o))),
    [orders],
  );
  const pastOrders = useMemo(
    () =>
      (orders || []).filter((o) => PAST_STATUSES.includes(getOrderStatus(o))),
    [orders],
  );

  // Filter past orders
  const filteredPastOrders = useMemo(() => {
    return pastOrders.filter((order) => {
      const status = getOrderStatus(order);
      if (pastFilter === "all") return true;
      if (pastFilter === "delivered") return status === "delivered";
      if (pastFilter === "cancelled")
        return status === "cancelled" || status === "rejected";
      return true;
    });
  }, [pastOrders, pastFilter]);

  // ─── Active Order Card (matches website design) ─────────────────────────
  const renderActiveCard = (order, index) => {
    const status = getOrderStatus(order);
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.placed;
    const itemCount = order.order_items?.length || order.items_count || 0;
    const isNew = newOrderIds.has(getOrderIdentityKey(order));
    const eta = getEstimatedTime(status, order);
    const orderKey = order?._renderKey || getOrderRenderKey(order, index);

    return (
      <AnimatedOrderCard key={orderKey} isNew={isNew} delay={index * 80}>
        <Pressable
          onPress={() => navigateToOrder(order)}
          style={({ pressed }) => [
            styles.activeCard,
            pressed && { opacity: 0.95 },
          ]}
        >
          {/* Top section: Logo + Info */}
          <View style={styles.activeCardTop}>
            {/* Restaurant Logo - Square rounded */}
            {order.restaurant_logo_url || order.restaurant_logo ? (
              <Image
                source={{
                  uri: order.restaurant_logo_url || order.restaurant_logo,
                }}
                style={styles.activeLogo}
              />
            ) : (
              <View style={[styles.activeLogo, styles.logoFallback]}>
                <Text style={styles.logoFallbackText}>
                  {(order.restaurant_name || "R").charAt(0)}
                </Text>
              </View>
            )}

            {/* Order Info */}
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Restaurant name */}
              <View style={styles.cardRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {order.restaurant_name || "Restaurant"}
                </Text>
              </View>

              {/* Order number & items */}
              <Text style={styles.orderMeta}>
                Order #{order.order_number || "N/A"} • {itemCount} item
                {itemCount !== 1 ? "s" : ""}
              </Text>

              {/* Estimated arrival */}
              {eta ? (
                <View style={styles.etaRow}>
                  <Text style={styles.etaLabel}>Est. arrival: </Text>
                  <Text style={styles.etaTime}>{eta}</Text>
                </View>
              ) : null}

              {/* Track Order Link */}
              <Pressable
                onPress={() => navigateToOrder(order)}
                style={({ pressed }) => [
                  styles.trackLink,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.trackLinkText}>Track Order →</Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom section: 6-Segment Progress */}
          <View style={styles.progressSection}>
            <SegmentedProgress currentStatus={status} />
          </View>
        </Pressable>
      </AnimatedOrderCard>
    );
  };

  // ─── Past Order Card (matches website design) ──────────────────────────
  const renderPastCard = (order, index) => {
    const isNew = newOrderIds.has(getOrderIdentityKey(order));
    const orderKey = order?._renderKey || getOrderRenderKey(order, index);
    const pastStatus = getPastStatus(order);
    const orderTime = getPastStatusTime(order, pastStatus);
    const isCancelled = pastStatus === "cancelled";
    const displayTotal = resolveOrderDisplayTotal(order, NaN);
    const hasDisplayTotal = Number.isFinite(displayTotal) && displayTotal > 0;

    return (
      <AnimatedOrderCard key={orderKey} isNew={isNew} delay={(index || 0) * 60}>
        <View style={styles.pastCard}>
          {/* Card content */}
          <View style={styles.pastCardTop}>
            {/* Restaurant Logo - Square */}
            {order.restaurant_logo_url || order.restaurant_logo ? (
              <Image
                source={{
                  uri: order.restaurant_logo_url || order.restaurant_logo,
                }}
                style={styles.pastLogo}
              />
            ) : (
              <View style={[styles.pastLogo, styles.logoFallback]}>
                <Text style={styles.logoFallbackText}>
                  {(order.restaurant_name || "R").charAt(0)}
                </Text>
              </View>
            )}

            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Restaurant name */}
              <View style={styles.cardRow}>
                <Text style={styles.pastRestaurantName} numberOfLines={1}>
                  {order.restaurant_name || "Restaurant"}
                </Text>
                <View
                  style={[
                    styles.pastStatusBadge,
                    {
                      backgroundColor: isCancelled
                        ? "rgba(220,38,38,0.1)"
                        : "rgba(5,150,105,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pastStatusText,
                      { color: isCancelled ? "#DC2626" : "#06C168" },
                    ]}
                  >
                    {isCancelled ? "Cancelled" : "Delivered"}
                  </Text>
                </View>
              </View>

              {/* Total + date/time */}
              <Text style={styles.pastMeta}>
                <Text style={styles.pastStatusMetaText}>
                  {isCancelled ? "Cancelled" : "Delivered"}
                </Text>
                {" • "}
                {hasDisplayTotal ? (
                  <Text style={styles.pastPrice}>
                    {formatPrice(displayTotal)}
                  </Text>
                ) : null}
                {hasDisplayTotal ? " • " : ""}
                {formatDate(orderTime)}
                {orderTime ? " • " : ""}
                {formatTime(orderTime)}
              </Text>
            </View>
          </View>

          {/* Action button */}
          <View style={styles.pastActions}>
            <Pressable
              onPress={() =>
                navigation.navigate("PastOrderDetails", {
                  orderId:
                    order?.id ||
                    order?.order_id ||
                    order?.orderId ||
                    getOrderIdentityKey(order),
                  status: pastStatus,
                  order,
                })
              }
              style={({ pressed }) => [
                styles.pastActionBtn,
                styles.viewDetailsBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.viewDetailsText}>View Details</Text>
            </Pressable>
          </View>
        </View>
      </AnimatedOrderCard>
    );
  };

  // ─── Empty State ─────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={{ fontSize: 48 }}>
          {activeTab === "active" ? "🛵" : "📦"}
        </Text>
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "active" ? "No Active Orders" : "No Past Orders"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "active"
          ? "You don't have any ongoing orders"
          : "Your order history will appear here"}
      </Text>
      {activeTab === "active" && (
        <Pressable
          onPress={() => navigation.navigate("Home")}
          style={({ pressed }) => [
            styles.browseBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.browseBtnText}>Browse Restaurants</Text>
        </Pressable>
      )}
    </View>
  );

  // ─── Not Logged In ──────────────────────────────────────────────────────
  const renderNotLoggedIn = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Text style={{ fontSize: 48 }}>🍽️</Text>
      </View>
      <Text style={styles.emptyTitle}>Please Log In</Text>
      <Text style={styles.emptySubtitle}>
        Sign in to view your orders and track deliveries
      </Text>
      <Pressable
        onPress={() => navigation.navigate("Login")}
        style={({ pressed }) => [
          styles.browseBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.browseBtnText}>Log In</Text>
      </Pressable>
    </View>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && { backgroundColor: "#F1F5F9" },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={styles.headerBtn} />
        </View>
        {renderNotLoggedIn()}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      {/* ── Header (matches website) ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && { backgroundColor: "#F1F5F9" },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* ── Tabs (pill toggle like Home page) ── */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setActiveTab("active")}
            style={({ pressed }) => [
              styles.toggleBtn,
              activeTab === "active" && styles.toggleActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={
                activeTab === "active"
                  ? styles.toggleTextActive
                  : styles.toggleTextIdle
              }
            >
              Active
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("past")}
            style={({ pressed }) => [
              styles.toggleBtn,
              activeTab === "past" && styles.toggleActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={
                activeTab === "past"
                  ? styles.toggleTextActive
                  : styles.toggleTextIdle
              }
            >
              Past
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={{ padding: 16, gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: "#F1F5F9",
              }}
            >
              <View style={{ flexDirection: "row", gap: 14 }}>
                <SkeletonBlock width={64} height={64} borderRadius={12} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <SkeletonBlock width="55%" height={16} borderRadius={6} />
                    <SkeletonBlock width={60} height={20} borderRadius={4} />
                  </View>
                  <SkeletonBlock width="70%" height={12} borderRadius={6} />
                  <SkeletonBlock width="50%" height={12} borderRadius={6} />
                  <SkeletonBlock width={100} height={14} borderRadius={6} />
                </View>
              </View>
              <View style={{ marginTop: 14, gap: 6 }}>
                <SkeletonBlock width="30%" height={10} borderRadius={4} />
                <SkeletonBlock width="100%" height={6} borderRadius={3} />
              </View>
            </View>
          ))}
        </View>
      ) : activeTab === "active" ? (
        /* ── Active Orders ── */
        <FlatList
          ref={flatListRef}
          data={activeOrders}
          keyExtractor={(item, index) =>
            `${getOrderRenderKey(item, index)}-${index}`
          }
          renderItem={({ item, index }) => renderActiveCard(item, index)}
          contentContainerStyle={[
            styles.listContent,
            activeOrders.length === 0 && { flex: 1 },
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders("refresh")}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        /* ── Past Orders ── */
        <FlatList
          data={filteredPastOrders}
          keyExtractor={(item, index) =>
            `${getOrderRenderKey(item, index)}-${index}`
          }
          renderItem={({ item, index }) => renderPastCard(item, index)}
          contentContainerStyle={[
            styles.listContent,
            filteredPastOrders.length === 0 && { flex: 1 },
          ]}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            filteredPastOrders.length > 0 ? (
              <View style={styles.pastFooter}>
                <Text style={styles.pastFooterText}>
                  Showing orders from the last 6 months
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders("refresh")}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles (matches website design) ─────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_DARK,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Toggle Tabs (pill style like Home page) ──
  toggleWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: BG,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleTextActive: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  toggleTextIdle: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 14,
  },

  // ── Filter Chips ──
  filterChipsContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BG,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#fff",
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // ── Active Order Card ──
  activeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  activeCardTop: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  activeLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },

  // ── Card Shared ──
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  logoFallbackText: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_GRAY,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },

  // ── Status Badge ──
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── Order Meta ──
  orderMeta: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 4,
  },

  // ── ETA Row ──
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  etaLabel: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  etaTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  // ── Track Order Link ──
  trackLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(6,193,104,0.1)",
  },
  trackLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.2,
  },

  // ── Progress Section ──
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  progressLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginBottom: 8,
  },
  segmentContainer: {},
  segmentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 4,
    marginHorizontal: 2,
    overflow: "hidden",
  },
  segmentFilled: {
    backgroundColor: "#06C168",
  },
  segmentActive: {
    backgroundColor: "#B8F0D0",
  },
  segmentEmpty: {
    backgroundColor: "#e0e0e0",
  },
  segmentSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 24,
    borderRadius: 4,
    backgroundColor: "#06C168",
  },

  // ── Past Order Card ──
  pastCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    overflow: "hidden",
  },
  pastCardTop: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  pastLogo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  pastRestaurantName: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
    flex: 1,
    marginRight: 8,
  },
  pastStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pastStatusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pastStatusMetaText: {
    fontWeight: "700",
  },
  pastMeta: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  pastPrice: {
    fontWeight: "600",
    color: "#111827",
  },
  pastItemsList: {
    marginTop: 8,
    gap: 2,
  },
  pastItemRow: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },

  // ── Past Action Buttons ──
  pastActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F9FAFB",
    padding: 12,
    gap: 12,
  },
  pastActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 10,
    gap: 6,
  },
  viewDetailsBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  reorderBtn: {
    backgroundColor: PRIMARY,
  },
  reorderBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ── Past Footer ──
  pastFooter: {
    paddingVertical: 32,
    alignItems: "center",
  },
  pastFooterText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  browseBtn: {
    marginTop: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  browseBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
