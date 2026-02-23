import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import supabase from "../../services/supabaseClient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIMARY = "#10B981";
const PRIMARY_SOFT = "#F0FDF4";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#64748B";
const BORDER = "#F1F5F9";
const BG = "#FFFFFF";

const STATUS_CONFIG = {
  placed: { color: "#FEF3C7", textColor: "#D97706", label: "Order Placed", icon: "time-outline" },
  accepted: { color: "#DBEAFE", textColor: "#2563EB", label: "Accepted", icon: "checkmark-circle-outline" },
  preparing: { color: "#F3E8FF", textColor: "#9333EA", label: "Preparing", icon: "restaurant-outline" },
  ready: { color: "#E0E7FF", textColor: "#4F46E5", label: "Ready", icon: "cube-outline" },
  picked_up: { color: "#CFFAFE", textColor: "#0891B2", label: "Picked Up", icon: "car-outline" },
  on_the_way: { color: "#CFFAFE", textColor: "#0891B2", label: "On the Way", icon: "bicycle-outline" },
  delivered: { color: "#D1FAE5", textColor: "#059669", label: "Delivered", icon: "checkmark-done-outline" },
  cancelled: { color: "#FEE2E2", textColor: "#DC2626", label: "Cancelled", icon: "close-circle-outline" },
  rejected: { color: "#FEE2E2", textColor: "#DC2626", label: "Rejected", icon: "close-circle-outline" },
};

const ACTIVE_STATUSES = ["placed", "accepted", "preparing", "ready", "picked_up", "on_the_way"];
const PAST_STATUSES = ["delivered", "cancelled", "rejected"];

// ─── Component ───────────────────────────────────────────────────────────────
export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "past"
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for active orders
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // ─── Fetch Orders ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (mode = "initial") => {
    // mode: "initial" (spinner), "refresh" (pull-to-refresh), "silent" (background)
    try {
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "initial") setLoading(true);

      const token = await AsyncStorage.getItem("token");
      if (!token || token === "null") {
        setIsLoggedIn(false);
        return;
      }
      setIsLoggedIn(true);

      const res = await fetch(`${API_BASE_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const list = data.orders || data || [];
        setOrders(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.log("Fetch orders error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Refetch silently when screen gains focus (e.g. after placing order)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      fetchOrders("silent");
    });
    return unsubscribe;
  }, [navigation, fetchOrders]);

  // ─── Supabase Realtime ───────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    const setupRealtime = async () => {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) return;

      const channel = supabase
        .channel(`customer-orders-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            setOrders((prev) =>
              prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          () => fetchOrders()
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then?.((fn) => fn?.());
    };
  }, [fetchOrders]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const formatPrice = (p) => {
    const n = Number(p);
    return Number.isNaN(n) ? "Rs. 0.00" : `Rs. ${n.toFixed(2)}`;
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (diffHours < 48) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => PAST_STATUSES.includes(o.status));

  // ─── Active Order Card ──────────────────────────────────────────────────
  const renderActiveCard = (order) => {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed;
    const itemCount = order.order_items?.length || order.items_count || 0;

    return (
      <Pressable
        key={order.id}
        onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
        style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
      >
        <View style={styles.activeCardInner}>
          {/* Restaurant Logo */}
          {order.restaurant_logo_url ? (
            <Image source={{ uri: order.restaurant_logo_url }} style={styles.activeLogo} />
          ) : (
            <View style={[styles.activeLogo, styles.logoFallback]}>
              <Text style={styles.logoFallbackText}>
                {(order.restaurant_name || "R").charAt(0)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            {/* Name + Price */}
            <View style={styles.cardRow}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {order.restaurant_name || "Restaurant"}
              </Text>
              <Text style={styles.priceActive}>{formatPrice(order.total_amount)}</Text>
            </View>

            {/* Date & Items */}
            <Text style={styles.cardMeta}>
              {formatDate(order.created_at)} • {itemCount} Item{itemCount !== 1 ? "s" : ""}
            </Text>

            {/* Status Badge with pulse */}
            <View style={styles.statusRow}>
              <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
              <View style={[styles.statusBadge, { backgroundColor: `${cfg.textColor}15` }]}>
                <Text style={[styles.statusText, { color: cfg.textColor }]}>{cfg.label}</Text>
              </View>
            </View>

            {/* Track Order Button */}
            <Pressable
              onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
              style={({ pressed }) => [styles.trackBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.trackBtnText}>Track Order</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  // ─── Past Order Card ─────────────────────────────────────────────────────
  const renderPastCard = (order) => {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.delivered;
    const itemCount = order.order_items?.length || order.items_count || 0;

    return (
      <Pressable
        key={order.id}
        onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
        style={({ pressed }) => [styles.pastCard, pressed && { opacity: 0.95 }]}
      >
        <View style={styles.pastCardInner}>
          {/* Logo */}
          {order.restaurant_logo_url ? (
            <Image source={{ uri: order.restaurant_logo_url }} style={styles.pastLogo} />
          ) : (
            <View style={[styles.pastLogo, styles.logoFallback]}>
              <Text style={styles.logoFallbackText}>
                {(order.restaurant_name || "R").charAt(0)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            {/* Name + Price */}
            <View style={styles.cardRow}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {order.restaurant_name || "Restaurant"}
              </Text>
              <Text style={styles.pricePast}>{formatPrice(order.total_amount)}</Text>
            </View>

            {/* Date & Items */}
            <Text style={styles.cardMeta}>
              {formatDate(order.created_at)} • {itemCount} Item{itemCount !== 1 ? "s" : ""}
            </Text>

            {/* Status + Reorder */}
            <View style={[styles.cardRow, { marginTop: 10 }]}>
              <View style={[styles.pastBadge, { backgroundColor: cfg.color }]}>
                <Text style={[styles.pastBadgeText, { color: cfg.textColor }]}>{cfg.label}</Text>
              </View>
              <Pressable
                onPress={() => {
                  // Navigate to restaurant to reorder
                  if (order.restaurant_id) {
                    navigation.navigate("RestaurantFoods", { restaurantId: order.restaurant_id });
                  }
                }}
                style={styles.reorderBtn}
              >
                <Ionicons name="refresh-outline" size={14} color={PRIMARY} />
                <Text style={styles.reorderText}>Reorder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // ─── Empty State ─────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name={activeTab === "active" ? "receipt-outline" : "time-outline"}
          size={48}
          color={PRIMARY}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "active" ? "No active orders" : "No past orders"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "active"
          ? "Hungry? Your delicious journey starts with your first order."
          : "Your completed orders will appear here."}
      </Text>
      {activeTab === "active" && (
        <Pressable
          onPress={() => navigation.navigate("Home")}
          style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
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
        <Ionicons name="log-in-outline" size={48} color={PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>Login Required</Text>
      <Text style={styles.emptySubtitle}>Please login to view your orders.</Text>
      <Pressable
        onPress={() => navigation.navigate("Login")}
        style={({ pressed }) => [styles.browseBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.browseBtnText}>Go to Login</Text>
      </Pressable>
    </View>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        {renderNotLoggedIn()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Pressable
          onPress={() => fetchOrders("refresh")}
          style={({ pressed }) => [styles.headerBtn, pressed && { backgroundColor: "#E2E8F0" }]}
        >
          <Ionicons name="refresh-outline" size={20} color={TEXT_MUTED} />
        </Pressable>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabsContainer}>
          <Pressable
            onPress={() => setActiveTab("active")}
            style={[styles.tab, activeTab === "active" && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>
              Active{activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("past")}
            style={[styles.tab, activeTab === "past" && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === "past" && styles.tabTextActive]}>
              Past Orders{pastOrders.length > 0 ? ` (${pastOrders.length})` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : activeTab === "active" ? (
        /* ── Active Tab: Both ongoing + recent history ── */
        <FlatList
          data={[1]} // single item, we render both sections manually
          keyExtractor={() => "all"}
          renderItem={() => (
            <View>
              {/* ── Ongoing Delivery ── */}
              {activeOrders.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>ONGOING DELIVERY</Text>
                  {activeOrders.map((order) => renderActiveCard(order))}
                </>
              )}

              {/* ── Recent History ── */}
              {pastOrders.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, activeOrders.length > 0 && { marginTop: 20 }]}>
                    RECENT HISTORY
                  </Text>
                  {pastOrders.map((order) => renderPastCard(order))}
                </>
              )}

              {/* Empty state - no orders at all */}
              {activeOrders.length === 0 && pastOrders.length === 0 && renderEmpty()}
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            activeOrders.length === 0 && pastOrders.length === 0 && { flex: 1 },
          ]}
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
        /* ── Past Orders Tab: Only past orders ── */
        <FlatList
          data={pastOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => renderPastCard(item)}
          contentContainerStyle={[
            styles.listContent,
            pastOrders.length === 0 && { flex: 1 },
          ]}
          ListHeaderComponent={
            pastOrders.length > 0 ? (
              <Text style={styles.sectionLabel}>RECENT HISTORY</Text>
            ) : null
          }
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
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_DARK,
    letterSpacing: -0.3,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  // Tabs
  tabsWrap: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    height: 48,
    backgroundColor: "#F1F5F9",
    borderRadius: 24,
    padding: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: PRIMARY,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Active Card
  activeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  activeCardInner: {
    flexDirection: "row",
    gap: 14,
  },
  activeLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Past Card
  pastCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pastCardInner: {
    flexDirection: "row",
    gap: 14,
  },
  pastLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
  },

  // Shared
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
  },
  logoFallbackText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_DARK,
    flex: 1,
    marginRight: 8,
  },
  priceActive: {
    fontSize: 14,
    fontWeight: "800",
    color: PRIMARY,
  },
  pricePast: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  cardMeta: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  // Status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Track button
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    marginTop: 12,
  },
  trackBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  // Past badge & reorder
  pastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pastBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  reorderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reorderText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: PRIMARY_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_DARK,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },
  browseBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  browseBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
});
