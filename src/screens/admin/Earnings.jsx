import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { API_URL } from "../../config/env";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const fetchEarnings = async (period) => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/earnings?period=${period}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load earnings");
  return data.earnings || null;
};

const fetchPayouts = async () => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/payouts?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load payouts");
  return data.payouts || [];
};

const fetchRestaurant = async () => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/restaurant`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Failed to load restaurant");
  return data.restaurant || null;
};

export default function Earnings() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("all");
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;

  const earningsQuery = useQuery({
    queryKey: ["admin", "earnings", period],
    queryFn: () => fetchEarnings(period),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin", "earnings", "payouts"],
    queryFn: fetchPayouts,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const restaurantQuery = useQuery({
    queryKey: ["admin", "restaurant"],
    queryFn: fetchRestaurant,
    staleTime: 120 * 1000,
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [skeletonOpacity]);

  const earnings = earningsQuery.data;
  const payouts = payoutsQuery.data || [];
  const restaurant = restaurantQuery.data;

  const loading =
    (earningsQuery.isLoading && !earningsQuery.data) ||
    (payoutsQuery.isLoading && !payoutsQuery.data) ||
    (restaurantQuery.isLoading && !restaurantQuery.data);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "earnings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "restaurant"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
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
          <Animated.View
            style={[styles.skeletonHeader, { opacity: skeletonOpacity }]}
          >
            <View style={[styles.skeleton, styles.skeletonAvatar]} />
            <View style={styles.skeletonHeaderText}>
              <View
                style={[
                  styles.skeleton,
                  { width: 100, height: 12, marginBottom: 8 },
                ]}
              />
              <View style={[styles.skeleton, { width: 140, height: 20 }]} />
            </View>
          </Animated.View>

          {/* Revenue card skeleton */}
          <Animated.View
            style={[styles.skeletonRevenueCard, { opacity: skeletonOpacity }]}
          >
            <View
              style={[
                styles.skeleton,
                styles.skeletonDark,
                { width: 100, height: 12, marginBottom: 12 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                styles.skeletonDark,
                { width: 180, height: 40, marginBottom: 8 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                styles.skeletonDark,
                { width: 130, height: 12, marginBottom: 16 },
              ]}
            />
            <View style={styles.skeletonPeriodRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.skeleton,
                    styles.skeletonDark,
                    { width: 55, height: 32 },
                  ]}
                />
              ))}
            </View>
          </Animated.View>

          {/* Metric grid skeleton */}
          <Animated.View
            style={[styles.metricGrid, { opacity: skeletonOpacity }]}
          >
            <View style={styles.skeletonMetricCard}>
              <View
                style={[
                  styles.skeleton,
                  { width: 80, height: 10, marginBottom: 8 },
                ]}
              />
              <View style={[styles.skeleton, { width: 100, height: 28 }]} />
            </View>
            <View style={styles.skeletonMetricCard}>
              <View
                style={[
                  styles.skeleton,
                  { width: 80, height: 10, marginBottom: 8 },
                ]}
              />
              <View style={[styles.skeleton, { width: 100, height: 28 }]} />
            </View>
          </Animated.View>

          {/* Chart skeleton */}
          <Animated.View
            style={[styles.skeletonChartCard, { opacity: skeletonOpacity }]}
          >
            <View
              style={[
                styles.skeleton,
                { width: 100, height: 16, marginBottom: 8 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                { width: 140, height: 32, marginBottom: 24 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                { width: "100%", height: 150, borderRadius: 12 },
              ]}
            />
          </Animated.View>

          {/* Orders skeleton */}
          {[1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[styles.skeletonOrderCard, { opacity: skeletonOpacity }]}
            >
              <View
                style={[
                  styles.skeleton,
                  { width: 40, height: 40, borderRadius: 10 },
                ]}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View
                  style={[
                    styles.skeleton,
                    { width: 100, height: 16, marginBottom: 6 },
                  ]}
                />
                <View style={[styles.skeleton, { width: 70, height: 12 }]} />
              </View>
              <View style={[styles.skeleton, { width: 60, height: 20 }]} />
            </Animated.View>
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
            colors={["#06C168"]}
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

        {(earningsQuery.error ||
          payoutsQuery.error ||
          restaurantQuery.error) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {earningsQuery.error?.message ||
                payoutsQuery.error?.message ||
                restaurantQuery.error?.message ||
                "Unable to load earnings data"}
            </Text>
          </View>
        )}

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
                  <LinearGradient
                    id="chartGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <Stop offset="0" stopColor="#06C168" stopOpacity="0.3" />
                    <Stop offset="1" stopColor="#06C168" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Path d={chartFillPath} fill="url(#chartGradient)" />
                <Path
                  d={chartPath}
                  stroke="#06C168"
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
                  earnings.chartData[Math.floor(earnings.chartData.length / 2)]
                    ?.date,
                )}
              </Text>
              <Text style={styles.chartDate}>
                {formatDate(
                  earnings.chartData[earnings.chartData.length - 1]?.date,
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Recent Orders */}
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <Text style={styles.ordersSectionTitle}>Recent Orders</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("AdminOrders")}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {payouts.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersText}>
                No completed orders yet
              </Text>
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
                    <Text style={styles.orderDate}>
                      {formatDate(payout.date)}
                    </Text>
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
                      Math.round(earnings.totalRevenue / earnings.totalOrders),
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
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorBanner: {
    marginBottom: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "500",
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E6F9F1",
    borderWidth: 1,
    borderColor: "#B8F0D0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#06C168",
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 2,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#06C168",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  withdrawIcon: {
    fontSize: 14,
  },
  withdrawText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  // Revenue Card
  revenueCard: {
    backgroundColor: "#E6F9F1",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#B8F0D0",
    marginBottom: 14,
  },
  revenueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  revenueLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803d",
    letterSpacing: 0.3,
  },
  changeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeBadgePositive: {
    backgroundColor: "#06C168",
  },
  changeBadgeNegative: {
    backgroundColor: "#DC2626",
  },
  changeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  revenueCompare: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 3,
    fontWeight: "500",
  },
  periodScrollView: {
    marginTop: 16,
  },
  periodContainer: {
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  periodButtonActive: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  periodButtonTextActive: {
    color: "#fff",
  },

  // Metric Grid
  metricGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
    lineHeight: 24,
  },
  metricValueGreen: {
    color: "#06C168",
  },
  metricSubtext: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
    fontWeight: "500",
  },

  // Chart Card
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  chartTotal: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginTop: 3,
    lineHeight: 26,
  },
  chartBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  chartBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
    fontSize: 13,
    color: "#9ca3af",
  },
  chartDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  chartDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
  },

  // Orders Section
  ordersSection: {
    marginBottom: 16,
  },
  ordersSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  ordersSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#06C168",
  },
  emptyOrders: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyOrdersText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  ordersList: {
    gap: 10,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  orderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E6F9F1",
    alignItems: "center",
    justifyContent: "center",
  },
  orderIcon: {
    fontSize: 16,
    color: "#06C168",
  },
  orderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  orderDate: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 1,
    fontWeight: "500",
  },
  orderAmountContainer: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  completedBadge: {
    backgroundColor: "#E6F9F1",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
    borderWidth: 1,
    borderColor: "#B8F0D0",
  },
  completedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803d",
  },

  // Quick Stats
  quickStatsCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 16,
  },
  quickStatsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  quickStatsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickStatItem: {
    flex: 1,
  },
  quickStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#9ca3af",
    letterSpacing: 0.3,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginTop: 3,
    lineHeight: 24,
  },

  // Skeleton Styles
  skeleton: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonDark: {
    backgroundColor: "#9EEBBE",
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
