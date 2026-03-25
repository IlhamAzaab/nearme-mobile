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
import { BarChart } from "react-native-chart-kit";
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

const DeliveryReportsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/reports/deliveries?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Delivery report error", e);
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
  const drivers = data?.driver_performance || [];
  const driversToShow = showAllDrivers ? drivers : drivers.slice(0, 5);

  const chartCfg = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (o = 1) => `rgba(19, 236, 185, ${o})`,
    labelColor: () => "#9CA3AF",
    propsForBackgroundLines: { strokeDasharray: "" },
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Delivery Reports"
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
              <Text style={styles.heroLabel}>Completion Rate</Text>
              <Text style={styles.heroValue}>{s.completion_rate || 0}%</Text>
              <View style={styles.heroGrid}>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#F3E8FF", borderColor: "#DDD6FE" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#7C3AED" }]}>
                    Total
                  </Text>
                  <Text style={[styles.heroStatVal, { color: "#5B21B6" }]}>
                    {s.total_deliveries || 0}
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroStat,
                    { backgroundColor: "#E6F9EE", borderColor: "#86E5AF" },
                  ]}
                >
                  <Text style={[styles.heroStatLabel, { color: "#06C168" }]}>
                    Completed
                  </Text>
                  <Text style={[styles.heroStatVal, { color: "#04553C" }]}>
                    {s.delivered || 0}
                  </Text>
                </View>
              </View>
            </View>

            {/* Key Metrics */}
            <View style={styles.metricsGrid}>
              {[
                {
                  icon: "timer-outline",
                  label: "Avg Time",
                  value: `${s.avg_delivery_time || 0} min`,
                  bg: "#EFF6FF",
                  color: "#2563EB",
                },
                {
                  icon: "navigate-outline",
                  label: "Avg Distance",
                  value: `${s.avg_distance || 0} km`,
                  bg: "#EEF2FF",
                  color: "#4F46E5",
                },
                {
                  icon: "cash-outline",
                  label: "Driver Pay",
                  value: fmt(s.total_driver_earnings),
                  bg: "#E6F9EE",
                  color: "#06C168",
                },
                {
                  icon: "heart-outline",
                  label: "Total Tips",
                  value: fmt(s.total_tips),
                  bg: "#FFFBEB",
                  color: "#D97706",
                },
              ].map((m, i) => (
                <View
                  key={i}
                  style={[styles.metricCard, { backgroundColor: m.bg }]}
                >
                  <Ionicons name={m.icon} size={18} color={m.color} />
                  <Text style={[styles.metricLabel, { color: m.color }]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.metricValue, { color: m.color }]}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Delivery Trend */}
            {trend.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Delivery Trend</Text>
                <BarChart
                  data={{
                    labels: trend
                      .filter((_, i) => i % Math.ceil(trend.length / 5) === 0)
                      .map((t) => t.date?.toString().slice(-5) || ""),
                    datasets: [{ data: trend.map((t) => t.delivered || 0) }],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={chartCfg}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Performance Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Performance Metrics</Text>
              {[
                {
                  label: "Total Distance Covered",
                  value: `${(s.total_distance || 0).toFixed(1)} km`,
                  bg: "#E6F9EE",
                  icon: "bicycle-outline",
                  color: "#06C168",
                },
                {
                  label: "Pending Deliveries",
                  value: s.pending || 0,
                  bg: "#EFF6FF",
                  icon: "hourglass-outline",
                  color: "#2563EB",
                },
                {
                  label: "Cancelled",
                  value: s.cancelled || 0,
                  bg: "#FEF2F2",
                  icon: "close-circle-outline",
                  color: "#DC2626",
                },
              ].map((m, i) => (
                <View
                  key={i}
                  style={[styles.perfRow, { backgroundColor: m.bg }]}
                >
                  <Ionicons name={m.icon} size={22} color={m.color} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: m.color,
                        textTransform: "uppercase",
                      }}
                    >
                      {m.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "800",
                        color: m.color,
                        marginTop: 2,
                      }}
                    >
                      {m.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Driver Performance */}
            {drivers.length > 0 && (
              <View style={styles.card}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Text style={styles.cardTitle}>Driver Performance</Text>
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
                    {drivers.length} drivers
                  </Text>
                </View>
                {driversToShow.map((d, i) => (
                  <View key={d.id} style={styles.driverRow}>
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
                      <Text style={styles.driverName} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={styles.driverSub}>
                        {d.type} • {d.avg_time}min avg • {d.completion_rate}%
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#06C168",
                        }}
                      >
                        {d.delivered} done
                      </Text>
                      <Text style={{ fontSize: 10, color: "#3B82F6" }}>
                        {fmt(d.earnings)}
                      </Text>
                    </View>
                  </View>
                ))}
                {drivers.length > 5 && (
                  <TouchableOpacity
                    style={styles.showAllBtn}
                    onPress={() => setShowAllDrivers(!showAllDrivers)}
                  >
                    <Text style={styles.showAllText}>
                      {showAllDrivers
                        ? "Show Less"
                        : `Show All ${drivers.length} Drivers`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* No data */}
            {(!trend || trend.length === 0) && (
              <View style={styles.emptyWrap}>
                <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No delivery data yet</Text>
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
    color: "#04553C",
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
  heroStatLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  heroStatVal: { fontSize: 18, fontWeight: "800", marginTop: 2 },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metricCard: { width: "48%", borderRadius: 14, padding: 14 },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 4,
  },
  metricValue: { fontSize: 16, fontWeight: "800", marginTop: 2 },

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
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#111827" },

  perfRow: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
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
  driverName: { fontSize: 13, fontWeight: "700", color: "#111827" },
  driverSub: { fontSize: 9, color: "#9CA3AF" },

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

export default DeliveryReportsScreen;
