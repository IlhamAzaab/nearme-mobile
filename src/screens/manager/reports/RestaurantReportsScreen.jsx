import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerDrawer from "../../../components/manager/ManagerDrawer";
import ManagerHeader from "../../../components/manager/ManagerHeader";
import { API_URL } from "../../../config/env";

const REPORT_DRAWER_ITEMS = [
  { route: "SalesReports", label: "Sales", icon: "trending-up-outline" },
  { route: "DeliveryReports", label: "Delivery", icon: "car-outline" },
  {
    route: "RestaurantReports",
    label: "Restaurants",
    icon: "restaurant-outline",
  },
  { route: "FinancialReports", label: "Financial", icon: "calculator-outline" },
  { route: "CustomerReports", label: "Customers", icon: "people-outline" },
  { route: "TimeAnalytics", label: "Time Analytics", icon: "time-outline" },
];

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 40;
const periodLabels = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
  all: "All Time",
};
const fmt = (v) =>
  `Rs.${parseFloat(v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const STATUS_COLORS = {
  active: "#10B981",
  pending: "#F59E0B",
  suspended: "#EF4444",
  rejected: "#DC2626",
  unknown: "#9CA3AF",
};

const RestaurantReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/reports/restaurants?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Restaurant report error", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const s = data?.summary || {};
  const trend = data?.trend || [];
  const restaurants = showAll
    ? data?.restaurant_performance || []
    : (data?.restaurant_performance || []).slice(0, 8);
  const statusCounts = data?.status_counts
    ? Object.entries(data.status_counts).map(([n, v]) => ({
        name: n.charAt(0).toUpperCase() + n.slice(1),
        value: v,
      }))
    : [];

  const chartCfg = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (o = 1) => `rgba(19,236,185,${o})`,
    labelColor: () => "#9CA3AF",
    propsForBackgroundLines: { strokeDasharray: "" },
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Restaurant Reports"
        showBack
        onMenuPress={() => setDrawerOpen(true)}
      />
      <ManagerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionTitle="Reports"
        items={REPORT_DRAWER_ITEMS}
        activeRoute={route.name}
        navigation={navigation}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Period */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          {["daily", "weekly", "monthly", "all"].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pill, period === p && styles.pillActive]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[styles.pillText, period === p && styles.pillTextActive]}
              >
                {periodLabels[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#13ECB9" />
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Total Commission Earned</Text>
              <Text style={styles.heroValue}>{fmt(s.total_commission)}</Text>
              <View style={styles.heroGrid}>
                {[
                  {
                    label: "Total",
                    value: s.total_restaurants || 0,
                    bg: "#FFFBEB",
                    border: "#FDE68A",
                    color: "#B45309",
                  },
                  {
                    label: "Active",
                    value: s.active_restaurants || 0,
                    bg: "#ECFDF5",
                    border: "#A7F3D0",
                    color: "#065F46",
                  },
                  {
                    label: "Avg Orders",
                    value: s.avg_orders_per_restaurant || 0,
                    bg: "#EFF6FF",
                    border: "#BFDBFE",
                    color: "#1E40AF",
                  },
                ].map((st, i) => (
                  <View
                    key={i}
                    style={[
                      styles.heroStat,
                      { backgroundColor: st.bg, borderColor: st.border },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: st.color,
                        textTransform: "uppercase",
                      }}
                    >
                      {st.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "800",
                        color: st.color,
                        marginTop: 2,
                      }}
                    >
                      {st.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Financial Summary Dark Card */}
            <View style={styles.darkCard}>
              <Text style={styles.darkLabel}>Financial Summary</Text>
              <View style={styles.darkRow}>
                <Text style={styles.darkRowLabel}>Total Commission</Text>
                <Text style={styles.darkRowVal}>{fmt(s.total_commission)}</Text>
              </View>
              <View style={styles.darkRow}>
                <Text style={styles.darkRowLabel}>Total Restaurant Payout</Text>
                <Text style={[styles.darkRowVal, { color: "#FCD34D" }]}>
                  {fmt(s.total_payout)}
                </Text>
              </View>
              <View style={styles.darkDivider} />
              <View style={styles.darkRow}>
                <Text
                  style={[
                    styles.darkRowLabel,
                    { color: "#13EC80", fontWeight: "700" },
                  ]}
                >
                  Commission Rate (avg)
                </Text>
                <Text
                  style={{ color: "#13EC80", fontSize: 18, fontWeight: "800" }}
                >
                  {s.total_payout > 0
                    ? (
                        (s.total_commission /
                          (s.total_payout + s.total_commission)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </Text>
              </View>
            </View>

            {/* Status Breakdown */}
            {statusCounts.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Restaurant Status</Text>
                {statusCounts.map((st, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor:
                          STATUS_COLORS[st.name.toLowerCase()] || "#9CA3AF",
                        marginRight: 8,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                      {st.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {st.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Commission Trend */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Commission Trend</Text>
                <LineChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 5) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [
                      {
                        data: trend.map((t) => t.commission || 0),
                        color: () => "#13ECB9",
                        strokeWidth: 2,
                      },
                    ],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={chartCfg}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                  bezier
                />
              </View>
            )}

            {/* Top Restaurants by Orders */}
            {data?.top_by_orders?.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top Restaurants by Orders</Text>
                <BarChart
                  data={{
                    labels: data.top_by_orders
                      .slice(0, 5)
                      .map((r) => r.name?.slice(0, 6) || ""),
                    datasets: [
                      {
                        data: data.top_by_orders
                          .slice(0, 5)
                          .map((r) => r.total_orders || 0),
                      },
                    ],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={{
                    ...chartCfg,
                    color: (o = 1) => `rgba(59,130,246,${o})`,
                  }}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Restaurant Performance */}
            {(data?.restaurant_performance || []).length > 0 && (
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={styles.cardTitle}>Restaurant Performance</Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: "#9CA3AF",
                      backgroundColor: "#F3F4F6",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10,
                    }}
                  >
                    {(data.restaurant_performance || []).length} restaurants
                  </Text>
                </View>
                {restaurants.map((r, i) => (
                  <View key={r.id} style={styles.restRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        i < 3 && {
                          backgroundColor:
                            i === 0
                              ? "#FBBF24"
                              : i === 1
                                ? "#9CA3AF"
                                : "#B45309",
                        },
                      ]}
                    >
                      <Text style={styles.rankNum}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                        {r.total_orders} orders • {r.delivered_orders} delivered
                        {r.cancelled_orders > 0
                          ? ` • ${r.cancelled_orders} cancelled`
                          : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
                        Sales
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#374151",
                        }}
                      >
                        {fmt(r.total_sales)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#059669",
                        }}
                      >
                        {fmt(r.commission_earned)}
                      </Text>
                    </View>
                  </View>
                ))}
                {(data.restaurant_performance || []).length > 8 && (
                  <TouchableOpacity
                    style={styles.showAllBtn}
                    onPress={() => setShowAll(!showAll)}
                  >
                    <Text style={styles.showAllText}>
                      {showAll
                        ? "Show Less"
                        : `Show All ${data.restaurant_performance.length} Restaurants`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* No data */}
            {(!data?.restaurant_performance ||
              data.restaurant_performance.length === 0) && (
              <View style={styles.emptyWrap}>
                <Ionicons name="restaurant-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No restaurant data yet</Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  scroll: { padding: 16 },

  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 6,
  },
  pillActive: { backgroundColor: "#13ECB9", borderColor: "#13ECB9" },
  pillText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  pillTextActive: { color: "#111816" },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    alignItems: "center",
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#065F46",
    marginVertical: 4,
  },
  heroGrid: { flexDirection: "row", gap: 8, marginTop: 10, width: "100%" },
  heroStat: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
  },

  darkCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  darkLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  darkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  darkRowLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  darkRowVal: { color: "#fff", fontWeight: "700", fontSize: 13 },
  darkDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 6,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },

  restRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  rankNum: { fontSize: 11, fontWeight: "800", color: "#fff" },

  showAllBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(19,236,185,0.1)",
    alignItems: "center",
  },
  showAllText: { fontSize: 12, fontWeight: "700", color: "#13ECB9" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default RestaurantReportsScreen;
