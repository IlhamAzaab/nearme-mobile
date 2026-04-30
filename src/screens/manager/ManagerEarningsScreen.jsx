import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const periodLabels = {
  daily: "Today",
  yesterday: "Yesterday",
  weekly: "This Week",
  monthly: "This Month",
  all: "All Time",
};

export default function ManagerEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [period, setPeriod] = useState("daily");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const getPeriodRange = useCallback(() => {
    const now = new Date();
    let from, to;
    if (period === "daily") {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
    } else if (period === "yesterday") {
      from = new Date(now);
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setDate(now.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else if (period === "weekly") {
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
    } else if (period === "monthly") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      return null;
    }
    return { from, to };
  }, [period]);

  const getOrderParams = useCallback(() => {
    const range = getPeriodRange();
    if (!range) return "limit=100";
    return `from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
  }, [getPeriodRange]);

  const getSummaryParams = useCallback(() => {
    const range = getPeriodRange();
    if (!range) return "";
    return `&from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
  }, [getPeriodRange]);

  const fetchEarnings = useCallback(
    async ({ isRefresh } = {}) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage("");
      try {
        const token =
          (await getAccessToken()) || (await AsyncStorage.getItem("token"));
        if (!token) {
          throw new Error("No authentication token");
        }
        const [summaryRes, ordersRes] = await Promise.all([
          fetch(
            `${API_URL}/manager/earnings/summary?period=${period}${getSummaryParams()}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
          fetch(
            `${API_URL}/manager/earnings/orders?${getOrderParams()}&limit=100`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ]);
        const summaryPayload = await summaryRes.json().catch(() => ({}));
        const ordersPayload = await ordersRes.json().catch(() => ({}));
        const summaryOk = summaryRes.ok && summaryPayload?.success !== false;
        const ordersOk = ordersRes.ok && ordersPayload?.success !== false;

        if (summaryOk) {
          setSummary(summaryPayload.summary || null);
        } else {
          setErrorMessage(
            summaryPayload?.message ||
              `Failed to load summary (${summaryRes.status})`,
          );
        }

        if (ordersOk) {
          setOrders(ordersPayload.orders || []);
        } else {
          setErrorMessage(
            (current) =>
              current ||
              ordersPayload?.message ||
              `Failed to load orders (${ordersRes.status})`,
          );
        }
      } catch (err) {
        console.error("Failed to fetch earnings:", err);
        setErrorMessage(err?.message || "Failed to load earnings");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, getOrderParams, getSummaryParams],
  );

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

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
    if (isToday) return `Today, ${timeStr}`;
    return (
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      `, ${timeStr}`
    );
  };

  const fmt = (v) =>
    `Rs.${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Manager Earnings"
        onRefresh={() => fetchEarnings({ isRefresh: true })}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEarnings({ isRefresh: true })}
            colors={["#06C168"]}
          />
        }
      >
        {/* Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodScroll}
        >
          {["daily", "yesterday", "weekly", "monthly", "all"].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodText,
                  period === p && styles.periodTextActive,
                ]}
              >
                {periodLabels[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && !summary && orders.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06C168" />
          </View>
        ) : (
          <>
            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Unable to load earnings</Text>
                <Text style={styles.errorSubtitle}>{errorMessage}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => fetchEarnings({ isRefresh: true })}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {/* Earnings Hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>
                {periodLabels[period]} Earnings
              </Text>
              <Text style={styles.heroAmount}>
                {fmt(summary?.total_earning)}
              </Text>
              <View style={styles.heroStatsRow}>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#E6F9EE", borderColor: "#B8F0D0" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#06C168" }]}>
                    TOTAL DELIVERIES
                  </Text>
                  <Text style={[styles.heroStatValue, { color: "#046B4D" }]}>
                    {summary?.total_orders || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#EFF6FF", borderColor: "#DBEAFE" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#2563EB" }]}>
                    DELIVERED
                  </Text>
                  <Text style={[styles.heroStatValue, { color: "#1D4ED8" }]}>
                    {summary?.delivered_orders || 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Breakdown Cards */}
            <View style={styles.breakdownGrid}>
              {[
                {
                  label: "COLLECTED",
                  value: summary?.total_collected,
                  icon: "wallet-outline",
                  bg: "#F3E8FF",
                  color: "#7C3AED",
                },
                {
                  label: "RESTAURANTS",
                  value: summary?.admin_total,
                  icon: "restaurant-outline",
                  bg: "#FEF3C7",
                  color: "#D97706",
                },
                {
                  label: "DRIVERS",
                  value: summary?.total_driver_earnings,
                  icon: "car-outline",
                  bg: "#E0F2FE",
                  color: "#0284C7",
                },
                {
                  label: "COMMISSION",
                  value: summary?.food_commission,
                  icon: "cash-outline",
                  bg: "#E6F9EE",
                  color: "#06C168",
                },
              ].map((item, i) => (
                <View key={i} style={styles.breakdownCard}>
                  <View style={styles.breakdownHeader}>
                    <View
                      style={[
                        styles.breakdownIcon,
                        { backgroundColor: item.bg },
                      ]}
                    >
                      <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    Rs.{(item.value || 0).toFixed(0)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Formula Card */}
            <View style={styles.formulaCard}>
              <Text style={styles.formulaTitle}>EARNINGS BREAKDOWN</Text>
              <View style={styles.formulaRow}>
                <Text style={styles.formulaKey}>Total Collected</Text>
                <Text style={styles.formulaVal}>
                  Rs.{(summary?.total_collected || 0).toFixed(0)}
                </Text>
              </View>
              <View style={styles.formulaRow}>
                <Text style={[styles.formulaKey, { color: "#FCA5A5" }]}>
                  − Restaurant Payments
                </Text>
                <Text style={[styles.formulaVal, { color: "#FCA5A5" }]}>
                  Rs.{(summary?.admin_total || 0).toFixed(0)}
                </Text>
              </View>
              <View style={styles.formulaRow}>
                <Text style={[styles.formulaKey, { color: "#FCA5A5" }]}>
                  − Driver Earnings
                </Text>
                <Text style={[styles.formulaVal, { color: "#FCA5A5" }]}>
                  Rs.{(summary?.total_driver_earnings || 0).toFixed(0)}
                </Text>
              </View>
              <View style={styles.formulaDivider} />
              <View style={styles.formulaRow}>
                <Text
                  style={[
                    styles.formulaKey,
                    { color: "#13EC80", fontWeight: "700" },
                  ]}
                >
                  = Your Earnings
                </Text>
                <Text
                  style={[
                    styles.formulaVal,
                    { color: "#13EC80", fontSize: 18, fontWeight: "800" },
                  ]}
                >
                  {fmt(summary?.total_earning)}
                </Text>
              </View>
            </View>

            {/* Delivery Earnings List */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Delivery Earnings</Text>
              <View style={styles.orderCountBadge}>
                <Text style={styles.orderCountText}>
                  {orders.length} orders
                </Text>
              </View>
            </View>

            {orders.length === 0 ? (
              <View style={styles.emptyList}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={32}
                    color="#9CA3AF"
                  />
                </View>
                <Text style={styles.emptyText}>No deliveries found</Text>
                <Text style={styles.emptySubText}>
                  for {periodLabels[period].toLowerCase()}
                </Text>
              </View>
            ) : (
              orders.map((order) => {
                const isExpanded = expandedOrder === order.id;
                const managerEarning = order.manager_earning || 0;
                const isPositive = managerEarning > 0;
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <TouchableOpacity
                      style={styles.orderRow}
                      onPress={() =>
                        setExpandedOrder(isExpanded ? null : order.id)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.orderLeft}>
                        <View
                          style={[
                            styles.orderIcon,
                            {
                              backgroundColor: isPositive
                                ? "#E6F9EE"
                                : "#FEF2F2",
                            },
                          ]}
                        >
                          <Ionicons
                            name={isPositive ? "trending-up" : "trending-down"}
                            size={20}
                            color={isPositive ? "#06C168" : "#DC2626"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.orderNumRow}>
                            <Text style={styles.orderNum}>
                              #{order.order_number}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor:
                                    order.status === "delivered"
                                      ? "#DCFCE7"
                                      : order.status === "cancelled" ||
                                          order.status === "rejected"
                                        ? "#FEE2E2"
                                        : "#DBEAFE",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  {
                                    color:
                                      order.status === "delivered"
                                        ? "#15803D"
                                        : order.status === "cancelled" ||
                                            order.status === "rejected"
                                          ? "#B91C1C"
                                          : "#1D4ED8",
                                  },
                                ]}
                              >
                                {order.status?.replace(/_/g, " ") || "unknown"}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            {order.restaurant_name} •{" "}
                            {formatTime(order.placed_at)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.orderRight}>
                        <View style={styles.orderAmountCol}>
                          <Text style={styles.orderAmountLabel}>Total</Text>
                          <Text style={styles.orderAmountVal}>
                            Rs.{parseFloat(order.total_amount || 0).toFixed(0)}
                          </Text>
                        </View>
                        <View style={styles.orderDivider} />
                        <View style={styles.orderAmountCol}>
                          <Text style={styles.orderAmountLabel}>Earning</Text>
                          <Text
                            style={[
                              styles.orderEarning,
                              { color: isPositive ? "#06C168" : "#DC2626" },
                            ]}
                          >
                            Rs.{managerEarning.toFixed(0)}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedDetails}>
                        <View style={styles.detailsGrid}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>CUSTOMER</Text>
                            <Text style={styles.detailValue}>
                              {order.customer_name || "—"}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailLabel}>RESTAURANT</Text>
                            <Text style={styles.detailValue}>
                              {order.restaurant_name || "—"}
                            </Text>
                          </View>
                        </View>
                        {order.driver_name && (
                          <View style={styles.driverRow}>
                            <View style={styles.driverAvatar}>
                              <Text style={styles.driverAvatarText}>
                                {order.driver_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2) || "D"}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.driverName}>
                                {order.driver_name}
                              </Text>
                              <Text style={styles.driverPhone}>
                                {order.driver_phone || "No phone"}
                              </Text>
                            </View>
                            {order.driver_phone && (
                              <TouchableOpacity
                                style={styles.callBtn}
                                onPress={() =>
                                  Linking.openURL(`tel:${order.driver_phone}`)
                                }
                              >
                                <Ionicons name="call" size={16} color="#fff" />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                        <View style={styles.financialCard}>
                          {[
                            { k: "Food Subtotal", v: order.subtotal },
                            { k: "Delivery Fee", v: order.delivery_fee },
                            { k: "Service Fee", v: order.service_fee },
                          ].map((r, i) => (
                            <View key={i} style={styles.finRow}>
                              <Text style={styles.finKey}>{r.k}</Text>
                              <Text style={styles.finVal}>
                                Rs.{parseFloat(r.v || 0).toFixed(0)}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.finDivider} />
                          <View style={styles.finRow}>
                            <Text style={styles.finKeyBold}>
                              Total Collected
                            </Text>
                            <Text style={styles.finValBold}>
                              Rs.
                              {parseFloat(order.total_amount || 0).toFixed(0)}
                            </Text>
                          </View>
                          <View style={styles.finDivider} />
                          <View style={styles.finRow}>
                            <Text style={[styles.finKey, { color: "#D97706" }]}>
                              Restaurant Pay
                            </Text>
                            <Text style={[styles.finVal, { color: "#D97706" }]}>
                              − Rs.
                              {parseFloat(order.restaurant_payout || 0).toFixed(
                                0,
                              )}
                            </Text>
                          </View>
                          <View style={styles.finRow}>
                            <Text style={[styles.finKey, { color: "#0284C7" }]}>
                              Driver Pay
                            </Text>
                            <Text style={[styles.finVal, { color: "#0284C7" }]}>
                              − Rs.
                              {parseFloat(order.driver_earning || 0).toFixed(0)}
                            </Text>
                          </View>
                          <View style={styles.finDivider} />
                          <View style={styles.finRow}>
                            <Text
                              style={[styles.finKeyBold, { color: "#046B4D" }]}
                            >
                              Your Earning
                            </Text>
                            <Text
                              style={[
                                styles.finValBold,
                                { color: "#046B4D", fontSize: 15 },
                              ]}
                            >
                              Rs.{(order.manager_earning || 0).toFixed(0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {orders.length > 0 && (
              <View style={styles.endIndicator}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={28}
                  color="#9CA3AF"
                />
                <Text style={styles.endText}>End of list</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 30 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  errorCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
    marginBottom: 6,
  },
  errorSubtitle: { fontSize: 12, color: "#9A3412", marginBottom: 12 },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FB923C",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Period
  periodScroll: { marginBottom: 16 },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    marginRight: 8,
  },
  periodBtnActive: { backgroundColor: "#13ECB9", borderColor: "#13ECB9" },
  periodText: { fontSize: 13, fontWeight: "600", color: "#618980" },
  periodTextActive: { color: "#111816" },

  // Hero
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: "800",
    color: "#04553C",
    textAlign: "center",
    marginBottom: 16,
  },
  heroStatsRow: { flexDirection: "row", gap: 12 },
  heroStat: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  heroStatLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  heroStatValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },

  // Breakdown
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  breakdownCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  breakdownIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "700",
    letterSpacing: 1,
  },
  breakdownValue: { fontSize: 17, fontWeight: "700", color: "#1F2937" },

  // Formula
  formulaCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  formulaTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  formulaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  formulaKey: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  formulaVal: { color: "#fff", fontWeight: "700", fontSize: 13 },
  formulaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 4,
  },

  // List
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listTitle: { fontSize: 17, fontWeight: "700", color: "#1F2937" },
  orderCountBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderCountText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },

  // Empty
  emptyList: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  emptySubText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },

  // Order Card
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 10,
    overflow: "hidden",
  },
  orderRow: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  orderNumRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderNum: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  orderMeta: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  orderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderAmountCol: { alignItems: "flex-end" },
  orderAmountLabel: { fontSize: 9, color: "#9CA3AF", fontWeight: "500" },
  orderAmountVal: { fontSize: 11, fontWeight: "700", color: "#4B5563" },
  orderDivider: { width: 1, height: 32, backgroundColor: "#E5E7EB" },
  orderEarning: { fontSize: 13, fontWeight: "800" },

  // Expanded
  expandedDetails: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    padding: 16,
    backgroundColor: "rgba(249,250,251,0.5)",
    gap: 12,
  },
  detailsGrid: { flexDirection: "row", gap: 12 },
  detailLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },

  // Driver
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E6F9EE",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B8F0D0",
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  driverAvatarText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  driverName: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  driverPhone: { fontSize: 11, color: "#6B7280" },
  callBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },

  // Financial
  financialCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  finRow: { flexDirection: "row", justifyContent: "space-between" },
  finKey: { fontSize: 13, color: "#6B7280" },
  finVal: { fontSize: 13, fontWeight: "500", color: "#1F2937" },
  finKeyBold: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  finValBold: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  finDivider: { height: 1, backgroundColor: "#E5E7EB" },

  // End
  endIndicator: { alignItems: "center", paddingVertical: 24, opacity: 0.4 },
  endText: { fontSize: 13, fontWeight: "500", color: "#6B7280", marginTop: 4 },
  totalAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#06C168",
    marginTop: 4,
  },
  statsGrid: { gap: 10, marginBottom: 20 },
  statCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  statTitle: { fontSize: 13, color: "#6B7280" },
  statValue: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  summaryCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16 },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  summaryLabel: { fontSize: 14, color: "#6B7280" },
  summaryValue: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  loadingText: { textAlign: "center", color: "#6B7280", marginTop: 40 },
});
