/**
 * Driver Earnings Screen
 * 
 * Shows driver's earnings with:
 * - Period filter (today, week, month, all)
 * - Summary stats
 * - Weekly performance chart
 * - Recent activity
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
];

export default function DriverEarningsScreen({ navigation }) {
  const [period, setPeriod] = useState("week");
  const [summary, setSummary] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch earnings data
  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      // Fetch summary
      const summaryRes = await fetch(
        `${API_BASE_URL}/driver/earnings/summary?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const summaryData = await summaryRes.json();
      if (summaryData.success) {
        setSummary(summaryData.summary);
      }

      // Fetch earnings history
      const historyRes = await fetch(
        `${API_BASE_URL}/driver/earnings/history?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const historyData = await historyRes.json();
      if (historyData.success) {
        setEarnings(historyData.earnings || []);
      }
    } catch (error) {
      console.log("Fetch earnings error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Format currency
  const formatCurrency = (value) => `₹${Number(value || 0).toFixed(0)}`;

  // Period label
  const periodLabel = useMemo(() => {
    const now = new Date();
    const currentPeriod = PERIODS.find((p) => p.key === period);
    if (period === "today") return "Today";
    if (period === "month") {
      return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
    if (period === "all") return "All Time";
    // Week label
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    const startLabel = start.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const endLabel = now.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    return `${startLabel} - ${endLabel}`;
  }, [period]);

  // Weekly chart data
  const weeklyChart = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return d;
    });

    const totals = days.map((d) => {
      const key = d.toISOString().split("T")[0];
      const dayTotal = earnings
        .filter((e) => (e.delivered_at || e.accepted_at || "").startsWith(key))
        .reduce(
          (sum, e) =>
            sum + Number(e.driver_earnings || 0) + Number(e.tip_amount || 0),
          0
        );
      return dayTotal;
    });

    const max = Math.max(...totals, 1);
    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return totals.map((value, idx) => ({
      label: dayLabels[days[idx].getDay()],
      value: value,
      height: Math.max(10, Math.round((value / max) * 100)),
      isPeak: value === max && max > 0,
    }));
  }, [earnings]);

  // Daily average
  const dailyAvg = useMemo(() => {
    if (!summary) return 0;
    const days =
      period === "today"
        ? 1
        : period === "week"
        ? 7
        : period === "month"
        ? 30
        : Math.max(earnings.length, 1);
    return Number(summary.total_earnings || 0) / Math.max(days, 1);
  }, [summary, period, earnings.length]);

  // Recent activities
  const recentActivities = earnings.slice(0, 5);

  // Cycle period
  const cyclePeriod = () => {
    const currentIndex = PERIODS.findIndex((p) => p.key === period);
    const nextIndex = (currentIndex + 1) % PERIODS.length;
    setPeriod(PERIODS[nextIndex].key);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10b981"]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <Pressable style={styles.periodSelector} onPress={cyclePeriod}>
          <Text style={styles.periodLabel}>{periodLabel}</Text>
          <Text style={styles.periodChange}>Tap to change →</Text>
        </Pressable>

        {/* Main Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsValue}>
            {formatCurrency(summary?.total_earnings || 0)}
          </Text>
          <View style={styles.earningsSubRow}>
            <View style={styles.earningsSubItem}>
              <Text style={styles.earningsSubValue}>
                {summary?.total_deliveries || 0}
              </Text>
              <Text style={styles.earningsSubLabel}>Deliveries</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsSubItem}>
              <Text style={styles.earningsSubValue}>
                {(summary?.total_distance_km || 0).toFixed(1)} km
              </Text>
              <Text style={styles.earningsSubLabel}>Distance</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsSubItem}>
              <Text style={styles.earningsSubValue}>
                {formatCurrency(dailyAvg)}
              </Text>
              <Text style={styles.earningsSubLabel}>Daily Avg</Text>
            </View>
          </View>
        </View>

        {/* Weekly Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Weekly Performance</Text>
          <View style={styles.chartContainer}>
            {weeklyChart.map((day, index) => (
              <View key={index} style={styles.chartBarContainer}>
                <Text style={styles.chartBarValue}>
                  {day.value > 0 ? `₹${day.value.toFixed(0)}` : ""}
                </Text>
                <View
                  style={[
                    styles.chartBar,
                    { height: day.height },
                    day.isPeak && styles.chartBarPeak,
                  ]}
                />
                <Text style={styles.chartBarLabel}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>No recent deliveries</Text>
            </View>
          ) : (
            recentActivities.map((activity, index) => (
              <View key={activity.delivery_id || index} style={styles.activityCard}>
                <View style={styles.activityLeft}>
                  <Text style={styles.activityIcon}>📦</Text>
                  <View>
                    <Text style={styles.activityOrder}>
                      #{activity.order_number || activity.delivery_id}
                    </Text>
                    <Text style={styles.activityRestaurant}>
                      {activity.restaurant_name || "Restaurant"}
                    </Text>
                  </View>
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityEarnings}>
                    +{formatCurrency(
                      Number(activity.driver_earnings || 0) +
                        Number(activity.bonus_amount || 0)
                    )}
                  </Text>
                  {activity.bonus_amount > 0 && (
                    <Text style={styles.activityBonus}>
                      +₹{activity.bonus_amount} bonus
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Period Filter Buttons */}
        <View style={styles.periodButtons}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  period === p.key && styles.periodBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnText: {
    fontSize: 24,
    color: "#111827",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  placeholder: {
    width: 40,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Period Selector
  periodSelector: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  periodLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  periodChange: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },

  // Earnings Card
  earningsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 42,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 16,
  },
  earningsSubRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  earningsSubItem: {
    flex: 1,
    alignItems: "center",
  },
  earningsDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
  },
  earningsSubValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  earningsSubLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },

  // Chart Section
  chartSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBarValue: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 4,
  },
  chartBar: {
    width: 24,
    backgroundColor: "#D1FAE5",
    borderRadius: 6,
    minHeight: 10,
  },
  chartBarPeak: {
    backgroundColor: "#10b981",
  },
  chartBarLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    fontWeight: "600",
  },

  // Activity Section
  activitySection: {
    marginBottom: 20,
  },
  emptyActivity: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
  },
  emptyActivityText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  activityIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  activityOrder: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  activityRestaurant: {
    fontSize: 12,
    color: "#6B7280",
  },
  activityRight: {
    alignItems: "flex-end",
  },
  activityEarnings: {
    fontSize: 16,
    fontWeight: "800",
    color: "#059669",
  },
  activityBonus: {
    fontSize: 11,
    color: "#F59E0B",
    fontWeight: "600",
  },

  // Period Buttons
  periodButtons: {
    flexDirection: "row",
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: "#10b981",
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  periodBtnTextActive: {
    color: "#fff",
  },
});
