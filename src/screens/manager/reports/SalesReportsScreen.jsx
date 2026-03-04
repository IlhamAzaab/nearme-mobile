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

function fmt(v) {
  return `Rs.${parseFloat(v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const SalesReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/reports/sales?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Sales report error", e);
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
  const chartCfg = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (o = 1) => `rgba(19, 236, 185, ${o})`,
    labelColor: () => "#9CA3AF",
    propsForDots: { r: "3" },
    propsForBackgroundLines: { strokeDasharray: "" },
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Sales Reports"
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
        {/* Period Selector */}
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
              <Text style={styles.heroLabel}>
                {periodLabels[period]} Total Sales
              </Text>
              <Text style={styles.heroValue}>{fmt(s.total_sales)}</Text>
              <View style={styles.heroGrid}>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#2563EB" }]}>
                    Orders
                  </Text>
                  <Text style={[styles.heroStatVal, { color: "#1D4ED8" }]}>
                    {s.total_orders || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#059669" }]}>
                    Delivered
                  </Text>
                  <Text style={[styles.heroStatVal, { color: "#065F46" }]}>
                    {s.delivered_orders || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#D97706" }]}>
                    Avg Value
                  </Text>
                  <Text style={[styles.heroStatVal, { color: "#92400E" }]}>
                    {fmt(s.avg_order_value)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Sales Trend Line Chart */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Sales Trend</Text>
                <LineChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 6) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [{ data: trend.map((t) => t.sales || 0) }],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={chartCfg}
                  bezier
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Order Volume Bar Chart */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Order Volume</Text>
                <BarChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 6) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [{ data: trend.map((t) => t.orders || 0) }],
                  }}
                  width={CHART_W}
                  height={180}
                  chartConfig={{
                    ...chartCfg,
                    color: (o = 1) => `rgba(99, 102, 241, ${o})`,
                  }}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Payment Methods */}
            {data?.payment_breakdown?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payment Methods</Text>
                {data.payment_breakdown.map((m, i) => (
                  <View key={i} style={styles.listRow}>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: [
                            "#13ecb9",
                            "#3b82f6",
                            "#8b5cf6",
                            "#f59e0b",
                          ][i % 4],
                        },
                      ]}
                    />
                    <Text style={styles.listLabel}>{m.method}</Text>
                    <Text style={styles.listValue}>
                      {fmt(m.total)} ({m.count})
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Order Status */}
            {data?.status_breakdown && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Order Status</Text>
                {Object.entries(data.status_breakdown).map(
                  ([status, count]) => {
                    const pct =
                      s.total_orders > 0
                        ? ((count / s.total_orders) * 100).toFixed(1)
                        : 0;
                    return (
                      <View key={status} style={{ marginBottom: 8 }}>
                        <View style={styles.barLabelRow}>
                          <Text style={styles.barLabel}>
                            {status.replace(/_/g, " ")}
                          </Text>
                          <Text style={styles.barVal}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.barBg}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${pct}%`, backgroundColor: "#13ECB9" },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  },
                )}
              </View>
            )}

            {/* Top Restaurants */}
            {data?.top_restaurants?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Restaurants by Sales</Text>
                {data.top_restaurants.slice(0, 5).map((r, i) => (
                  <View key={r.id} style={styles.rankRow}>
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.rankSub}>{r.orders} orders</Text>
                    </View>
                    <Text style={styles.rankValue}>{fmt(r.sales)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* No data */}
            {(!trend || trend.length === 0) && (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="trending-up-outline"
                  size={48}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyText}>No sales data yet</Text>
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
    fontSize: 32,
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
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroStatVal: { fontSize: 18, fontWeight: "800", marginTop: 2 },

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
    marginBottom: 12,
  },

  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  listLabel: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    textTransform: "capitalize",
  },
  listValue: { fontSize: 12, fontWeight: "700", color: "#111827" },

  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  barLabel: { fontSize: 11, color: "#6B7280", textTransform: "capitalize" },
  barVal: { fontSize: 11, fontWeight: "700", color: "#111827" },
  barBg: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  rankNum: { fontSize: 11, fontWeight: "800", color: "#fff" },
  rankName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  rankSub: { fontSize: 10, color: "#9CA3AF" },
  rankValue: { fontSize: 13, fontWeight: "700", color: "#059669" },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default SalesReportsScreen;
