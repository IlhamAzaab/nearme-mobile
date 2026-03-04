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
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOUR_COLORS = {
  earlyMorning: "#94A3B8",
  morning: "#FBBF24",
  lunch: "#F97316",
  afternoon: "#06B6D4",
  dinner: "#8B5CF6",
  night: "#475569",
};
function getHourColor(hour) {
  if (hour >= 5 && hour < 9) return HOUR_COLORS.earlyMorning;
  if (hour >= 9 && hour < 12) return HOUR_COLORS.morning;
  if (hour >= 12 && hour < 15) return HOUR_COLORS.lunch;
  if (hour >= 15 && hour < 18) return HOUR_COLORS.afternoon;
  if (hour >= 18 && hour < 22) return HOUR_COLORS.dinner;
  return HOUR_COLORS.night;
}

const TimeAnalyticsScreen = () => {
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
        `${API_URL}/manager/reports/analytics?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Analytics error", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const hourlyData = (data?.hourly_distribution || []).map((item) => ({
    ...item,
    label: `${item.hour}:00`,
    color: getHourColor(item.hour),
  }));
  const weekdayData = (data?.weekday_distribution || []).map((item) => ({
    ...item,
    label: dayNames[item.day] || `Day ${item.day}`,
  }));
  const peakHours = data?.peak_hours || [];
  const mealBreakdown = data?.meal_time_breakdown || {};
  const totalOrders = hourlyData.reduce((sum, h) => sum + (h.orders || 0), 0);

  const chartCfg = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (o = 1) => `rgba(59,130,246,${o})`,
    labelColor: () => "#9CA3AF",
    propsForBackgroundLines: { strokeDasharray: "" },
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Time Analytics"
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
            {/* Peak Hours Hero */}
            {peakHours.length > 0 && (
              <View style={styles.darkCard}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <Ionicons name="flame-outline" size={18} color="#13ECB9" />
                  <Text style={styles.darkLabel}>
                    Peak Hours ({periodLabels[period]})
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {peakHours.slice(0, 3).map((p, i) => (
                    <View key={i} style={styles.peakBox}>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontSize: 9,
                          fontWeight: "700",
                        }}
                      >
                        {i === 0 ? "🏆 " : ""}#{i + 1}
                      </Text>
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 22,
                          fontWeight: "900",
                          marginVertical: 2,
                        }}
                      >
                        {p.hour}:00
                      </Text>
                      <Text
                        style={{
                          color: "#13ECB9",
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        {p.orders} orders
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Meal Time Breakdown */}
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
                  key: "breakfast",
                  label: "Breakfast",
                  time: "6am - 11am",
                  icon: "sunny-outline",
                  bg: "#FFFBEB",
                  border: "#FDE68A",
                  color: "#92400E",
                },
                {
                  key: "lunch",
                  label: "Lunch",
                  time: "11am - 3pm",
                  icon: "fast-food-outline",
                  bg: "#FFF7ED",
                  border: "#FDBA74",
                  color: "#9A3412",
                },
                {
                  key: "snack",
                  label: "Snack Time",
                  time: "3pm - 6pm",
                  icon: "cafe-outline",
                  bg: "#ECFEFF",
                  border: "#A5F3FC",
                  color: "#155E75",
                },
                {
                  key: "dinner",
                  label: "Dinner",
                  time: "6pm - 11pm",
                  icon: "moon-outline",
                  bg: "#FAF5FF",
                  border: "#D8B4FE",
                  color: "#6B21A8",
                },
              ].map((meal) => {
                const count = mealBreakdown[meal.key] || 0;
                const pct =
                  totalOrders > 0
                    ? ((count / totalOrders) * 100).toFixed(0)
                    : 0;
                return (
                  <View
                    key={meal.key}
                    style={[
                      styles.mealCard,
                      { backgroundColor: meal.bg, borderColor: meal.border },
                    ]}
                  >
                    <Ionicons name={meal.icon} size={16} color={meal.color} />
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        marginTop: 4,
                      }}
                    >
                      {meal.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "800",
                        color: meal.color,
                        marginTop: 2,
                      }}
                    >
                      {count}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 2,
                      }}
                    >
                      <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                        {meal.time}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "700",
                          color: meal.color,
                          backgroundColor: "#fff",
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                          borderRadius: 6,
                        }}
                      >
                        {pct}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Hourly Distribution */}
            {hourlyData.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Orders by Hour of Day</Text>
                <BarChart
                  data={{
                    labels: hourlyData
                      .filter((_, i) => i % 3 === 0)
                      .map((h) => h.label),
                    datasets: [{ data: hourlyData.map((h) => h.orders || 0) }],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={{
                    ...chartCfg,
                    color: (o = 1) => `rgba(19,236,185,${o})`,
                  }}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
                {/* Legend */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {[
                    { label: "Early Morning", color: HOUR_COLORS.earlyMorning },
                    { label: "Morning", color: HOUR_COLORS.morning },
                    { label: "Lunch", color: HOUR_COLORS.lunch },
                    { label: "Afternoon", color: HOUR_COLORS.afternoon },
                    { label: "Dinner", color: HOUR_COLORS.dinner },
                    { label: "Night", color: HOUR_COLORS.night },
                  ].map((l, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: l.color,
                        }}
                      />
                      <Text style={{ fontSize: 9, color: "#6B7280" }}>
                        {l.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Weekday Distribution */}
            {weekdayData.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Orders by Day of Week</Text>
                <BarChart
                  data={{
                    labels: weekdayData.map((d) => d.label),
                    datasets: [{ data: weekdayData.map((d) => d.orders || 0) }],
                  }}
                  width={CHART_W}
                  height={200}
                  chartConfig={chartCfg}
                  style={{ borderRadius: 12 }}
                  withInnerLines={false}
                />
              </View>
            )}

            {/* Heatmap */}
            {data?.heatmap?.length > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  Order Heatmap (Hour × Day)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ minWidth: 340 }}>
                    {/* Header row */}
                    <View style={{ flexDirection: "row", marginBottom: 2 }}>
                      <View style={{ width: 42 }} />
                      {dayNames.map((d) => (
                        <View key={d} style={{ flex: 1, alignItems: "center" }}>
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "700",
                              color: "#6B7280",
                            }}
                          >
                            {d}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {/* Rows */}
                    {(() => {
                      const grid = {};
                      let maxVal = 1;
                      (data.heatmap || []).forEach((c) => {
                        grid[`${c.hour}-${c.day}`] = c.orders;
                        if (c.orders > maxVal) maxVal = c.orders;
                      });
                      const hours = [];
                      for (let h = 6; h <= 23; h++) hours.push(h);
                      for (let h = 0; h <= 5; h++) hours.push(h);
                      return hours.map((hour) => (
                        <View
                          key={hour}
                          style={{ flexDirection: "row", marginBottom: 2 }}
                        >
                          <View style={{ width: 42, justifyContent: "center" }}>
                            <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                              {String(hour).padStart(2, "0")}:00
                            </Text>
                          </View>
                          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                            const val = grid[`${hour}-${day}`] || 0;
                            const intensity = val / maxVal;
                            return (
                              <View
                                key={day}
                                style={{
                                  flex: 1,
                                  height: 22,
                                  borderRadius: 3,
                                  marginHorizontal: 1,
                                  backgroundColor:
                                    val > 0
                                      ? `rgba(19,236,185,${0.1 + intensity * 0.8})`
                                      : "#F9FAFB",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                {val > 0 && (
                                  <Text
                                    style={{
                                      fontSize: 8,
                                      fontWeight: "800",
                                      color:
                                        intensity > 0.5 ? "#064E3B" : "#0FA883",
                                    }}
                                  >
                                    {val}
                                  </Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ));
                    })()}
                    {/* Legend */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 6,
                      }}
                    >
                      <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                        Less
                      </Text>
                      {[0.1, 0.3, 0.5, 0.7, 0.9].map((int, i) => (
                        <View
                          key={i}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            backgroundColor: `rgba(19,236,185,${int})`,
                          }}
                        />
                      ))}
                      <Text style={{ fontSize: 9, color: "#9CA3AF" }}>
                        More
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Insight */}
            {peakHours.length > 0 && (
              <View
                style={{
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                  flexDirection: "row",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#DBEAFE",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="bulb-outline" size={18} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#1E40AF",
                    }}
                  >
                    Insight
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: "#3B82F6", marginTop: 2 }}
                  >
                    Your busiest hour is {peakHours[0]?.hour}:00 -{" "}
                    {peakHours[0]?.hour + 1}:00 with {peakHours[0]?.orders}{" "}
                    orders. Ensure sufficient driver availability during this
                    window.
                  </Text>
                </View>
              </View>
            )}

            {/* No data */}
            {(!hourlyData || hourlyData.length === 0) &&
              (!weekdayData || weekdayData.length === 0) && (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="analytics-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyText}>No analytics data yet</Text>
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

  darkCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  darkLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  peakBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },

  mealCard: { width: "48%", borderRadius: 14, padding: 12, borderWidth: 1 },

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

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#9CA3AF", marginTop: 8, fontSize: 13 },
});

export default TimeAnalyticsScreen;
