import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { API_URL } from "../../config/env";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Earnings() {
  const navigation = useNavigation();
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("all");
  const [restaurant, setRestaurant] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    setLoading(true);

    try {
      // Fetch earnings
      const earningsRes = await fetch(
        `${API_URL}/admin/earnings?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const earningsData = await earningsRes.json();
      if (earningsRes.ok) {
        setEarnings(earningsData.earnings);
      }

      // Fetch payouts
      const payoutsRes = await fetch(`${API_URL}/admin/payouts?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payoutsData = await payoutsRes.json();
      if (payoutsRes.ok) {
        setPayouts(payoutsData.payouts || []);
      }

      // Fetch restaurant info
      const restaurantRes = await fetch(`${API_URL}/admin/restaurant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const restaurantData = await restaurantRes.json();
      if (restaurantRes.ok) {
        setRestaurant(restaurantData.restaurant);
      }
    } catch (error) {
      console.error("Error fetching earnings data:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return `Rs. ${(amount || 0).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "Last 7 Days";
      case "month":
        return "Last 30 Days";
      case "year":
        return "Last Year";
      default:
        return "All Time";
    }
  };

  // Generate chart path from data
  const generateChartPath = () => {
    if (!earnings?.chartData || earnings.chartData.length === 0) {
      return { path: "", fillPath: "" };
    }

    const data = earnings.chartData;
    const maxAmount = Math.max(...data.map((d) => d.amount), 1);
    const width = SCREEN_WIDTH - 64;
    const height = 150;
    const padding = 10;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * (width - padding * 2) + padding;
      const y =
        height - padding - (d.amount / maxAmount) * (height - padding * 2);
      return { x, y };
    });

    if (points.length === 0) return { path: "", fillPath: "" };

    // Create smooth curve path
    let path = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` C${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Create fill path
    const fillPath =
      path +
      ` L${points[points.length - 1].x} ${height} L${points[0].x} ${height} Z`;

    return { path, fillPath };
  };

  const { path: chartPath, fillPath: chartFillPath } = generateChartPath();

  const periodOptions = [
    { value: "today", label: "Today" },
    { value: "week", label: "7 Days" },
    { value: "month", label: "30 Days" },
    { value: "year", label: "Year" },
    { value: "all", label: "All Time" },
  ];

  // Loading Skeleton
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header skeleton */}
          <View style={styles.skeletonHeader}>
            <View style={[styles.skeleton, styles.skeletonAvatar]} />
            <View style={styles.skeletonHeaderText}>
              <View style={[styles.skeleton, { width: 100, height: 12, marginBottom: 8 }]} />
              <View style={[styles.skeleton, { width: 140, height: 20 }]} />
            </View>
          </View>

          {/* Revenue card skeleton */}
          <View style={styles.skeletonRevenueCard}>
            <View style={[styles.skeleton, styles.skeletonDark, { width: 100, height: 12, marginBottom: 12 }]} />
            <View style={[styles.skeleton, styles.skeletonDark, { width: 180, height: 40, marginBottom: 8 }]} />
            <View style={[styles.skeleton, styles.skeletonDark, { width: 130, height: 12, marginBottom: 16 }]} />
            <View style={styles.skeletonPeriodRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.skeleton, styles.skeletonDark, { width: 55, height: 32 }]} />
              ))}
            </View>
          </View>

          {/* Metric grid skeleton */}
          <View style={styles.metricGrid}>
            <View style={styles.skeletonMetricCard}>
              <View style={[styles.skeleton, { width: 80, height: 10, marginBottom: 8 }]} />
              <View style={[styles.skeleton, { width: 100, height: 28 }]} />
            </View>
            <View style={styles.skeletonMetricCard}>
              <View style={[styles.skeleton, { width: 80, height: 10, marginBottom: 8 }]} />
              <View style={[styles.skeleton, { width: 100, height: 28 }]} />
            </View>
          </View>

          {/* Chart skeleton */}
          <View style={styles.skeletonChartCard}>
            <View style={[styles.skeleton, { width: 100, height: 16, marginBottom: 8 }]} />
            <View style={[styles.skeleton, { width: 140, height: 32, marginBottom: 24 }]} />
            <View style={[styles.skeleton, { width: "100%", height: 150, borderRadius: 12 }]} />
          </View>

          {/* Orders skeleton */}
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonOrderCard}>
              <View style={[styles.skeleton, { width: 40, height: 40, borderRadius: 10 }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={[styles.skeleton, { width: 100, height: 16, marginBottom: 6 }]} />
                <View style={[styles.skeleton, { width: 70, height: 12 }]} />
              </View>
              <View style={[styles.skeleton, { width: 60, height: 20 }]} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#22c55e"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.restaurantInfo}>
            <View style={styles.avatarContainer}>
              {restaurant?.logo_url ? (
                <Image
                  source={{ uri: restaurant.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {restaurant?.name?.charAt(0) || "R"}
                </Text>
              )}
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.restaurantName}>
                {restaurant?.name || "Your Restaurant"}
              </Text>
              <Text style={styles.headerTitle}>Financial Overview</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => navigation.navigate("AdminWithdrawals")}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawIcon}>💳</Text>
            <Text style={styles.withdrawText}>Withdrawals</Text>
          </TouchableOpacity>
        </View>

        {/* Main Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Text style={styles.revenueLabel}>
              NET REVENUE ({getPeriodLabel()})
            </Text>
            {earnings?.percentageChange !== 0 && (
              <View
                style={[
                  styles.changeBadge,
                  earnings?.percentageChange >= 0
                    ? styles.changeBadgePositive
                    : styles.changeBadgeNegative,
                ]}
              >
                <Text style={styles.changeBadgeText}>
                  {earnings?.percentageChange >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(earnings?.percentageChange || 0)}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.revenueAmount}>
            {formatCurrency(earnings?.totalRevenue)}
          </Text>
          <Text style={styles.revenueCompare}>
            vs. {formatCurrency(earnings?.lastWeekRevenue)} last week
          </Text>

          {/* Period Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.periodScrollView}
            contentContainerStyle={styles.periodContainer}
          >
            {periodOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.periodButton,
                  period === option.value && styles.periodButtonActive,
                ]}
                onPress={() => setPeriod(option.value)}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    period === option.value && styles.periodButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Metric Grid */}
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>TODAY'S SALES</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(earnings?.todaySales)}
            </Text>
            <Text style={styles.metricSubtext}>
              {earnings?.todayOrderCount || 0} orders
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>THIS WEEK</Text>
            <Text style={[styles.metricValue, styles.metricValueGreen]}>
              {formatCurrency(earnings?.thisWeekRevenue)}
            </Text>
            <Text style={styles.metricSubtext}>Last 7 days</Text>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartLabel}>Earnings Trend</Text>
              <Text style={styles.chartTotal}>
                {formatCurrency(earnings?.totalRevenue)}
              </Text>
            </View>
            <View style={styles.chartBadge}>
              <Text style={styles.chartBadgeText}>Last 30 days</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {earnings?.chartData && earnings.chartData.length > 0 ? (
              <Svg
                width={SCREEN_WIDTH - 64}
                height={150}
                viewBox={`0 0 ${SCREEN_WIDTH - 64} 150`}
              >
                <Defs>
                  <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#22c55e" stopOpacity="0.3" />
                    <Stop offset="1" stopColor="#22c55e" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Path d={chartFillPath} fill="url(#chartGradient)" />
                <Path
                  d={chartPath}
                  stroke="#22c55e"
                  strokeWidth={3}
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            ) : (
              <View style={styles.noChartData}>
                <Text style={styles.noChartDataText}>
                  No data available for chart
                </Text>
              </View>
            )}
          </View>

          {earnings?.chartData && earnings.chartData.length > 0 && (
            <View style={styles.chartDates}>
              <Text style={styles.chartDate}>
                {formatDate(earnings.chartData[0]?.date)}
              </Text>
              <Text style={styles.chartDate}>
                {formatDate(
                  earnings.chartData[Math.floor(earnings.chartData.length / 2)]?.date
                )}
              </Text>
              <Text style={styles.chartDate}>
                {formatDate(earnings.chartData[earnings.chartData.length - 1]?.date)}
              </Text>
            </View>
          )}
        </View>

        {/* Recent Orders */}
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <Text style={styles.ordersSectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate("AdminOrders")}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {payouts.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersText}>No completed orders yet</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {payouts.map((payout) => (
                <View key={payout.id} style={styles.orderCard}>
                  <View style={styles.orderIconContainer}>
                    <Text style={styles.orderIcon}>✓</Text>
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>
                      Order #{payout.order_number || payout.id.slice(0, 8)}
                    </Text>
                    <Text style={styles.orderDate}>{formatDate(payout.date)}</Text>
                  </View>
                  <View style={styles.orderAmountContainer}>
                    <Text style={styles.orderAmount}>
                      {formatCurrency(payout.amount)}
                    </Text>
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>Completed</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsCard}>
          <Text style={styles.quickStatsTitle}>Quick Stats</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatLabel}>TOTAL ORDERS</Text>
              <Text style={styles.quickStatValue}>
                {earnings?.totalOrders || 0}
              </Text>
            </View>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatLabel}>AVG. ORDER VALUE</Text>
              <Text style={styles.quickStatValue}>
                {earnings?.totalOrders > 0
                  ? formatCurrency(
                      Math.round(earnings.totalRevenue / earnings.totalOrders)
                    )
                  : "Rs. 0"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dcfce7",
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#16a34a",
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  withdrawIcon: {
    fontSize: 16,
  },
  withdrawText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Revenue Card
  revenueCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 16,
  },
  revenueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4b5563",
    letterSpacing: 0.5,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  changeBadgePositive: {
    backgroundColor: "#22c55e",
  },
  changeBadgeNegative: {
    backgroundColor: "#ef4444",
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  revenueAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -1,
  },
  revenueCompare: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  periodScrollView: {
    marginTop: 16,
  },
  periodContainer: {
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  periodButtonActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  periodButtonTextActive: {
    color: "#fff",
  },

  // Metric Grid
  metricGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 6,
  },
  metricValueGreen: {
    color: "#16a34a",
  },
  metricSubtext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },

  // Chart Card
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  chartTotal: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 4,
  },
  chartBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  chartContainer: {
    alignItems: "center",
  },
  noChartData: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  noChartDataText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  chartDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  chartDate: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#9ca3af",
  },

  // Orders Section
  ordersSection: {
    marginBottom: 20,
  },
  ordersSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ordersSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#16a34a",
  },
  emptyOrders: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  emptyOrdersText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  orderIcon: {
    fontSize: 18,
    color: "#16a34a",
  },
  orderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
  },
  orderDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  orderAmountContainer: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
  },
  completedBadge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#15803d",
  },

  // Quick Stats
  quickStatsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 20,
    padding: 20,
  },
  quickStatsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  quickStatsGrid: {
    flexDirection: "row",
    gap: 16,
  },
  quickStatItem: {
    flex: 1,
  },
  quickStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 0.5,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },

  // Skeleton Styles
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonDark: {
    backgroundColor: "#bbf7d0",
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  skeletonHeaderText: {
    marginLeft: 12,
  },
  skeletonRevenueCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  skeletonPeriodRow: {
    flexDirection: "row",
    gap: 8,
  },
  skeletonMetricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  skeletonChartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 20,
  },
  skeletonOrderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 12,
  },
});
