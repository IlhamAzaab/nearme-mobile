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
const CHART_COLORS = ["#13ECB9", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899"];

const CustomerReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/reports/customers?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Customer report error", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const s = data?.summary || {};
  const topCustomers = data?.top_customers || [];
  const displayCustomers = showAllCustomers
    ? topCustomers
    : topCustomers.slice(0, 5);
  const regTrend = data?.registration_trend || [];
  const orderFreq = data?.order_frequency || [];

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
        title="Customer Reports"
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
              <Text style={styles.heroLabel}>Total Customers</Text>
              <Text style={styles.heroValue}>{s.total_customers || 0}</Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {s.new_customers || 0} new {periodLabels[period]?.toLowerCase()}
              </Text>
            </View>

            {/* Key Metrics */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[
                {
                  icon: "bag-handle-outline",
                  label: "Avg Orders",
                  value: parseFloat(s.avg_orders_per_customer || 0).toFixed(1),
                  sub: "per customer",
                  bg: "#ECFDF5",
                  color: "#059669",
                },
                {
                  icon: "receipt-outline",
                  label: "Avg Spend",
                  value: `Rs.${parseFloat(s.avg_spend_per_customer || 0).toFixed(0)}`,
                  sub: "per customer",
                  bg: "#EFF6FF",
                  color: "#2563EB",
                },
                {
                  icon: "repeat-outline",
                  label: "Repeat Rate",
                  value: `${s.total_customers > 0 ? ((s.repeat_customers / s.total_customers) * 100).toFixed(1) : 0}%`,
                  sub: "2+ orders",
                  bg: "#F5F3FF",
                  color: "#7C3AED",
                },
                {
                  icon: "star-outline",
                  label: "Loyal Customers",
                  value: s.loyal_customers || 0,
                  sub: "5+ orders",
                  bg: "#FFFBEB",
                  color: "#D97706",
                },
              ].map((m, i) => (
                <View
                  key={i}
                  style={[styles.metricCard, { backgroundColor: m.bg }]}
                >
                  <Ionicons name={m.icon} size={16} color={m.color} />
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      marginTop: 4,
                    }}
                  >
                    {m.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: "#111827",
                      marginTop: 2,
                    }}
                  >
                    {m.value}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#9CA3AF" }}>{m.sub}</Text>
                </View>
              ))}
            </View>

            {/* Registration Trend */}
            {regTrend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  Customer Registration Trend
                </Text>
                <LineChart
                  data={{
                    labels: regTrend
                      .filter(
                        (_, i) => i % Math.ceil(regTrend.length / 5) === 0,
                      )
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [
                      {
                        data: regTrend.map((t) => t.registrations || 0),
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

            {/* Order Frequency */}
            {orderFreq.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  Order Frequency Distribution
                </Text>
                <BarChart
                  data={{
                    labels: orderFreq.map((f) => f.range || ""),
                    datasets: [{ data: orderFreq.map((f) => f.count || 0) }],
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

            {/* City Breakdown */}
            {data?.city_breakdown?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Customers by City</Text>
                {data.city_breakdown.map((c, i) => (
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
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        marginRight: 8,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                      {c.city || "Unknown"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {c.count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Top Customers */}
            {topCustomers.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Customers</Text>
                {displayCustomers.map((c, i) => (
                  <View key={i} style={styles.custRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        i < 3 && {
                          backgroundColor:
                            i === 0
                              ? "#FEF3C7"
                              : i === 1
                                ? "#F3F4F6"
                                : "#FED7AA",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankNum,
                          i < 3 && {
                            color:
                              i === 0
                                ? "#B45309"
                                : i === 1
                                  ? "#6B7280"
                                  : "#C2410C",
                          },
                        ]}
                      >
                        {i + 1}
                      </Text>
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
                        {c.name || "Unknown"}
                      </Text>
                      <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
                        {c.city || "N/A"} • {c.order_count || 0} orders
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#065F46",
                        }}
                      >
                        Rs.{parseFloat(c.total_spent || 0).toFixed(0)}
                      </Text>
                      <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                        total spent
                      </Text>
                    </View>
                  </View>
                ))}
                {topCustomers.length > 5 && (
                  <TouchableOpacity
                    style={styles.showAllBtn}
                    onPress={() => setShowAllCustomers(!showAllCustomers)}
                  >
                    <Text style={styles.showAllText}>
                      {showAllCustomers
                        ? "Show Less"
                        : `Show All (${topCustomers.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Popular Restaurants */}
            {data?.favorite_restaurants?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Most Popular Restaurants</Text>
                {data.favorite_restaurants.slice(0, 5).map((r, i) => {
                  const maxO = data.favorite_restaurants[0]?.order_count || 1;
                  const pct = ((r.order_count || 0) / maxO) * 100;
                  return (
                    <View key={i} style={{ marginBottom: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 3,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: "#374151",
                          }}
                          numberOfLines={1}
                        >
                          {r.restaurant_name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#6B7280",
                          }}
                        >
                          {r.order_count} orders
                        </Text>
                      </View>
                      <View
                        style={{
                          height: 6,
                          backgroundColor: "#F3F4F6",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            backgroundColor: "#F43F5E",
                            borderRadius: 3,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* No data */}
            {(!topCustomers || topCustomers.length === 0) &&
              (!regTrend || regTrend.length === 0) && (
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No customer data yet</Text>
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
    fontSize: 40,
    fontWeight: "900",
    color: "#065F46",
    marginVertical: 4,
  },

  metricCard: {
    width: "48%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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

  custRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  rankNum: { fontSize: 10, fontWeight: "800", color: "#6B7280" },

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

export default CustomerReportsScreen;
