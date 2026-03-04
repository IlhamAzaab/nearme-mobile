import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";

const PERIODS = [
  { key: "today", label: "Today's Earnings" },
  { key: "week", label: "This Week's Earnings" },
  { key: "month", label: "This Month's Earnings" },
  { key: "all", label: "Total Earnings" },
];

export default function DriverEarningsScreen({ navigation }) {
  const [period, setPeriod] = useState("all");
  const [summary, setSummary] = useState(null);
  const [todayPerformance, setTodayPerformance] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState([]);

  const cyclePeriod = () => {
    const currentIndex = PERIODS.findIndex((p) => p.key === period);
    const nextIndex = (currentIndex + 1) % PERIODS.length;
    setPeriod(PERIODS[nextIndex].key);
  };

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.error("No token found");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      const [sRes, hRes] = await Promise.all([
        fetch(`${API_URL}/driver/earnings/summary?period=${period}`, {
          headers,
        }),
        fetch(`${API_URL}/driver/earnings/history?limit=50`, { headers }),
      ]);

      // Handle summary response
      if (!sRes.ok) {
        const sText = await sRes.text();
        console.error(`Summary error (${sRes.status}):`, sText);
      } else {
        const sData = await sRes.json();
        if (sData.success) {
          setSummary(sData.summary);
          if (sData.summary?.today) setTodayPerformance(sData.summary.today);
        }
      }

      // Handle history response
      if (!hRes.ok) {
        const hText = await hRes.text();
        console.error(`History error (${hRes.status}):`, hText);
      } else {
        const hData = await hRes.json();
        if (hData.success) {
          const earningsData = hData.earnings || [];
          setEarnings(earningsData);

          // Log first item to debug field names
          if (earningsData.length > 0) {
            console.log(
              "Earnings item fields:",
              JSON.stringify(earningsData[0]),
            );
          }

          // Build weekly chart data from history
          const last7Days = {};
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const now = new Date();

          // Initialize last 7 days with 0
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            last7Days[key] = { day: dayNames[d.getDay()], earnings: 0 };
          }

          // Aggregate earnings by date
          earningsData.forEach((item) => {
            const date = (item.created_at || item.date || "").split("T")[0];
            if (last7Days[date]) {
              const amt = Number(
                item.delivery_earning ||
                  item.total_earning ||
                  item.earning_amount ||
                  item.base_amount ||
                  item.earnings ||
                  item.amount ||
                  0,
              );
              last7Days[date].earnings += amt;
            }
          });

          const chartEntries = Object.values(last7Days);
          setWeeklyData(chartEntries);
        }
      }
    } catch (e) {
      console.error("Fetch error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator
          size="large"
          color="#1db95b"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.container}>
      <DriverScreenHeader
        title="Earnings"
        rightIcon="calendar"
        onBackPress={() => navigation.goBack()}
        onRightPress={cyclePeriod}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={["#1db95b"]}
          />
        }
      >
        {/* Period Indicator */}
        <View style={s.periodIndicator}>
          <Text style={s.periodText}>
            {PERIODS.find((p) => p.key === period)?.label || "Total Earnings"}
          </Text>
        </View>

        {/* Total Earnings Card */}
        <View style={s.earningsCard}>
          <Text style={s.earningsLabel}>
            {PERIODS.find((p) => p.key === period)?.label?.toUpperCase() ||
              "TOTAL EARNINGS"}
          </Text>
          <Text style={s.earningsAmount}>
            Rs {Number(summary?.total_earnings || 0).toFixed(2)}
          </Text>
          <View style={s.earningsStatRow}>
            <Text style={s.earningsCheckmark}>✓</Text>
            <Text style={s.earningsDeliveries}>
              {summary?.total_deliveries || 0} deliveries
            </Text>
          </View>
        </View>

        {/* My Withdrawals Card */}
        <TouchableOpacity
          style={s.withdrawalsCard}
          onPress={() => navigation.navigate("DriverWithdrawals")}
        >
          <View style={s.withdrawalsContent}>
            <Ionicons name="arrow-down-circle" size={24} color="#1db95b" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.withdrawalsTitle}>My Withdrawals</Text>
              <Text style={s.withdrawalsSubtitle}>
                View payment history from management
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9ca3af" />
        </TouchableOpacity>

        {/* Today's Performance */}
        {todayPerformance && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Today's Performance</Text>
              <Text style={s.sectionDate}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </Text>
            </View>
            <View style={s.todayCard}>
              <View style={s.todayGrid}>
                <View style={s.todayStat}>
                  <Text style={s.todayStatIcon}>💷</Text>
                  <Text style={s.todayStatValue}>
                    Rs {Number(todayPerformance.earnings || 0).toFixed(2)}
                  </Text>
                  <Text style={s.todayStatLabel}>EARNINGS</Text>
                </View>
                <View style={s.todayStat}>
                  <Text style={s.todayStatIcon}>📦</Text>
                  <Text style={s.todayStatValue}>
                    {todayPerformance.deliveries || 0}
                  </Text>
                  <Text style={s.todayStatLabel}>DELIVERIES</Text>
                </View>
              </View>
              <View style={s.todayAverage}>
                <Text style={s.todayAverageLabel}>Average per Delivery</Text>
                <Text style={s.todayAverageValue}>
                  Rs{" "}
                  {todayPerformance.deliveries > 0
                    ? (
                        Number(todayPerformance.earnings) /
                        Number(todayPerformance.deliveries)
                      ).toFixed(2)
                    : "0.00"}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Statistics Cards */}
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>DAILY AVG</Text>
            <Text style={s.statValue}>
              Rs{" "}
              {Number(
                summary?.daily_average || summary?.avg_per_delivery || 0,
              ).toFixed(2)}
            </Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>LIFETIME AVG</Text>
            <Text style={s.statValue}>
              Rs{" "}
              {Number(
                summary?.lifetime_average || summary?.avg_lifetime || 0,
              ).toFixed(2)}
            </Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>ALL DELIVERIES</Text>
            <Text style={s.statValue}>{summary?.total_deliveries || 0}</Text>
          </View>
        </View>

        {/* Weekly Performance Chart */}
        <View style={s.weeklyCard}>
          <View style={s.weeklyHeader}>
            <Text style={s.sectionTitle}>Weekly Performance</Text>
            <Text style={s.sectionDate}>Last 7 Days</Text>
          </View>
          {weeklyData.length > 0 ? (
            <LineChart
              data={{
                labels: weeklyData.map((d) => d.day || ""),
                datasets: [
                  {
                    data: weeklyData.map((d) => Number(d.earnings || 0)),
                    strokeWidth: 2,
                  },
                ],
              }}
              width={Dimensions.get("window").width - 64}
              height={200}
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(29, 185, 91, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: "#1db95b",
                },
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
            />
          ) : (
            <View style={s.chartPlaceholder}>
              <Text style={s.chartText}>📊 No data available</Text>
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <Text style={s.sectionTitle}>Recent Activity</Text>
        {earnings.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name="inbox"
              size={40}
              color="#d1d5db"
              style={{ marginBottom: 12 }}
            />
            <Text style={s.emptyText}>No earnings recorded yet</Text>
          </View>
        ) : (
          earnings.map((item, index) => {
            const orderNum =
              item.order_number ||
              item.order_id ||
              item.delivery_id ||
              item.id ||
              `#${index}`;
            const amount = Number(
              item.delivery_earning ||
                item.total_earning ||
                item.earning_amount ||
                item.base_amount ||
                item.earnings ||
                item.amount ||
                0,
            );
            const bonus = Number(item.bonus_amount || item.bonus || 0);
            const tip = Number(item.tip_amount || item.tip || 0);
            const location =
              item.location_name || item.restaurant_name || item.location || "";
            const dateStr =
              item.created_at || item.date || new Date().toISOString();

            return (
              <View
                key={`earning-${item.id || index}-${dateStr}`}
                style={s.earningItem}
              >
                <View style={s.earningItemLeft}>
                  <Ionicons
                    name="swap-horizontal"
                    size={24}
                    color="#1db95b"
                    style={{ marginRight: 12 }}
                  />
                  <View>
                    <Text style={s.earningItemTitle}>Order #{orderNum}</Text>
                    <Text style={s.earningItemDate}>
                      {new Date(dateStr).toLocaleDateString()} • {location}
                    </Text>
                  </View>
                </View>
                <View style={s.earningItemRight}>
                  <Text style={s.earningItemAmount}>
                    Rs {amount.toFixed(2)}
                  </Text>
                  {bonus > 0 && (
                    <Text style={s.earningItemBonus}>
                      Bonus +Rs {bonus.toFixed(2)}
                    </Text>
                  )}
                  {tip > 0 && (
                    <Text style={s.earningItemTip}>
                      Tip +Rs {tip.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 16, paddingBottom: 100 },

  /* Period Indicator */
  periodIndicator: {
    backgroundColor: "#1db95b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
  },
  periodText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Earnings Card */
  earningsCard: {
    backgroundColor: "#1db95b",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  earningsStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  earningsCheckmark: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.9)",
  },
  earningsDeliveries: { fontSize: 13, color: "rgba(255, 255, 255, 0.9)" },

  /* Withdrawals Card */
  withdrawalsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
  },
  withdrawalsContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  withdrawalsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  withdrawalsSubtitle: {
    fontSize: 12,
    color: "#6b7280",
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  sectionDate: {
    fontSize: 12,
    color: "#1db95b",
    fontWeight: "600",
  },

  /* Today's Performance Card */
  todayCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  earningItemRight: {
    alignItems: "flex-end",
  },
  earningItemBonus: {
    fontSize: 12,
    color: "#1db95b",
    fontWeight: "600",
    marginTop: 4,
  },
  earningItemTip: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 2,
  },
  todayGrid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
  },
  todayStat: {
    alignItems: "center",
    flex: 1,
  },
  todayStatIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  todayStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  todayStatLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  todayAverage: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    alignItems: "center",
  },
  todayAverageLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  todayAverageValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1db95b",
  },

  /* Stats Cards Grid */
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    elevation: 1,
  },
  statLabel: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },

  /* Weekly Card */
  weeklyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  weeklyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chartText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  /* Earning Items */
  earningItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
  },
  earningItemLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  earningItemRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  earningItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  earningItemDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  earningItemAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1db95b",
  },
  earningItemBonus: {
    fontSize: 12,
    color: "#1db95b",
    fontWeight: "600",
    marginTop: 4,
  },
  earningItemTip: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
    marginTop: 2,
  },

  /* Empty State */
  empty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
  },
});
