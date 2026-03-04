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

const REVENUE_COLORS = ["#13ECB9", "#3B82F6", "#8B5CF6"];
const EXPENSE_COLORS = ["#F59E0B", "#06B6D4", "#EC4899"];

const FinancialReportsScreen = () => {
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
        `${API_URL}/manager/reports/financial?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Financial report error", e);
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
    color: (o = 1) => `rgba(19,236,185,${o})`,
    labelColor: () => "#9CA3AF",
    propsForBackgroundLines: { strokeDasharray: "" },
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Financial Reports"
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
              <Text style={styles.heroLabel}>
                {periodLabels[period]} Net Earnings
              </Text>
              <Text style={styles.heroValue}>{fmt(s.manager_earnings)}</Text>
              <View style={styles.heroGrid}>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: "#059669",
                      textTransform: "uppercase",
                    }}
                  >
                    Revenue
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: "#065F46",
                      marginTop: 2,
                    }}
                  >
                    {fmt(s.total_revenue)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: "#2563EB",
                      textTransform: "uppercase",
                    }}
                  >
                    Margin
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: "#1E40AF",
                      marginTop: 2,
                    }}
                  >
                    {s.total_revenue > 0
                      ? ((s.manager_earnings / s.total_revenue) * 100).toFixed(
                          1,
                        )
                      : 0}
                    %
                  </Text>
                </View>
              </View>
            </View>

            {/* Revenue vs Profit Trend */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Revenue vs Profit Trend</Text>
                <LineChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 5) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [
                      {
                        data: trend.map((t) => t.revenue || 0),
                        color: () => "#13ECB9",
                        strokeWidth: 2,
                      },
                      {
                        data: trend.map((t) => t.profit || 0),
                        color: () => "#3B82F6",
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
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 16,
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#13ECB9",
                      }}
                    />
                    <Text style={{ fontSize: 10, color: "#6B7280" }}>
                      Revenue
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#3B82F6",
                      }}
                    />
                    <Text style={{ fontSize: 10, color: "#6B7280" }}>
                      Profit
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Financial Breakdown Dark Card */}
            <View style={styles.darkCard}>
              <Text style={styles.darkLabel}>Complete Financial Breakdown</Text>
              <View style={styles.darkRow}>
                <Text style={styles.darkRowLabel}>
                  Total Revenue (Collected)
                </Text>
                <Text style={styles.darkRowVal}>{fmt(s.total_revenue)}</Text>
              </View>
              <View style={styles.darkDivider} />
              {[
                {
                  label: "Restaurant Payouts",
                  value: s.total_restaurant_payout,
                  color: "#FCD34D",
                  dot: "#FCD34D",
                },
                {
                  label: "Driver Earnings",
                  value: s.total_driver_earnings,
                  color: "#67E8F9",
                  dot: "#67E8F9",
                },
              ].map((r, i) => (
                <View key={i} style={styles.darkRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: r.dot,
                      }}
                    />
                    <Text style={styles.darkRowLabel}>{r.label}</Text>
                  </View>
                  <Text style={[styles.darkRowVal, { color: r.color }]}>
                    − {fmt(r.value)}
                  </Text>
                </View>
              ))}
              <View style={styles.darkDivider} />
              {[
                {
                  label: "Food Commission",
                  value: s.total_commission,
                  color: "#6EE7B7",
                  dot: "#6EE7B7",
                },
                {
                  label: "Service Fees",
                  value: s.total_service_fees,
                  color: "#93C5FD",
                  dot: "#93C5FD",
                },
                {
                  label: "Delivery Fees",
                  value: s.total_delivery_fees,
                  color: "#C4B5FD",
                  dot: "#C4B5FD",
                },
              ].map((r, i) => (
                <View key={i} style={styles.darkRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: r.dot,
                      }}
                    />
                    <Text style={styles.darkRowLabel}>{r.label}</Text>
                  </View>
                  <Text style={[styles.darkRowVal, { color: r.color }]}>
                    {fmt(r.value)}
                  </Text>
                </View>
              ))}
              <View
                style={[
                  styles.darkDivider,
                  { backgroundColor: "rgba(255,255,255,0.25)" },
                ]}
              />
              <View style={styles.darkRow}>
                <Text
                  style={[
                    styles.darkRowLabel,
                    { color: "#13EC80", fontWeight: "700" },
                  ]}
                >
                  = Your Net Earnings
                </Text>
                <Text
                  style={{ color: "#13EC80", fontSize: 18, fontWeight: "800" }}
                >
                  {fmt(s.manager_earnings)}
                </Text>
              </View>
            </View>

            {/* Revenue Sources */}
            {data?.revenue_breakdown?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Revenue Sources</Text>
                {data.revenue_breakdown.map((item, i) => (
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
                          REVENUE_COLORS[i % REVENUE_COLORS.length],
                        marginRight: 8,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: "#6B7280" }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {fmt(item.value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Expense Breakdown */}
            {data?.expense_breakdown?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Expense Breakdown</Text>
                {data.expense_breakdown.map((item, i) => (
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
                          EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                        marginRight: 8,
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 13, color: "#6B7280" }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {fmt(item.value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Cash Flow */}
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
                  icon: "cash-outline",
                  label: "Cash",
                  value: s.cash_collected,
                  bg: "#ECFDF5",
                  color: "#059669",
                },
                {
                  icon: "card-outline",
                  label: "Online",
                  value: s.online_collected,
                  bg: "#EFF6FF",
                  color: "#2563EB",
                },
                {
                  icon: "wallet-outline",
                  label: "Deposited",
                  value: s.total_deposited,
                  bg: "#FFFBEB",
                  color: "#D97706",
                },
                {
                  icon: "send-outline",
                  label: "Paid Out",
                  value: s.total_paid_to_drivers,
                  bg: "#F5F3FF",
                  color: "#7C3AED",
                },
              ].map((m, i) => (
                <View
                  key={i}
                  style={[styles.cashCard, { backgroundColor: m.bg }]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <Ionicons name={m.icon} size={16} color={m.color} />
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                      }}
                    >
                      {m.label}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: "#111827",
                    }}
                  >
                    {fmt(m.value)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Cost Breakdown Bar Chart */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Daily Cost Breakdown</Text>
                <BarChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 5) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [
                      {
                        data: trend.map(
                          (t) =>
                            (t.restaurant_payout || 0) +
                            (t.driver_earnings || 0) +
                            (t.profit || 0),
                        ),
                      },
                    ],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={{
                    ...chartCfg,
                    color: (o = 1) => `rgba(245,158,11,${o})`,
                  }}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Tips Info */}
            {s.total_tips > 0 && (
              <View
                style={{
                  backgroundColor: "#FFFBEB",
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#FEF3C7",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="heart-outline" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#92400E",
                    }}
                  >
                    Tips Collected
                  </Text>
                  <Text style={{ fontSize: 11, color: "#D97706" }}>
                    {fmt(s.total_tips)} in tips allocated to drivers
                  </Text>
                </View>
              </View>
            )}

            {/* No data */}
            {(!trend || trend.length === 0) && (
              <View style={styles.emptyWrap}>
                <Ionicons name="cash-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No financial data yet</Text>
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
    backgroundColor: "rgba(255,255,255,0.1)",
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

  cashCard: {
    width: "48%",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default FinancialReportsScreen;
