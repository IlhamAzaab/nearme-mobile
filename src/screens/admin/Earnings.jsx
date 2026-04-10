import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";
import { getAccessToken } from "../../lib/authStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const fetchEarnings = async (period) => {
  const token = await getAccessToken();
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

export default function Earnings() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("all");
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;
  const pageEnterStyle = usePageEnterAnimation();

  const earningsQuery = useQuery({
    queryKey: ["admin", "earnings", period],
    queryFn: () => fetchEarnings(period),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
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
  const dayByDayRows = Array.isArray(earnings?.dayByDayAnalysis)
    ? [...earnings.dayByDayAnalysis].reverse()
    : [];
  const loading = earningsQuery.isLoading && !earningsQuery.data;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "earnings"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return `Rs.${(amount || 0).toLocaleString()}`;
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

  const formatDay = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatDateWithDay = (dateStr, day) => {
    const safeDay = day || formatDay(dateStr);
    return `${formatDate(dateStr)}, ${safeDay}`;
  };

  const getComparisonLabel = () => {
    switch (period) {
      case "today":
        return "vs. yesterday";
      case "week":
        return "vs. prev 7 days";
      case "month":
        return "vs. prev 30 days";
      case "year":
        return "vs. prev year";
      default:
        return null;
    }
  };

  const comparisonLabel = getComparisonLabel();
  const pct = earnings?.percentageChange || 0;
  const isUp = pct >= 0;
  const showComparison = comparisonLabel && pct !== 0;

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
      <SafeAreaView style={styles.container} edges={["top"]}>
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View style={[styles.pageAnimationWrap, pageEnterStyle]}>
        {earningsQuery.isFetching && earnings ? (
          <View style={styles.refreshOverlay}>
            <ActivityIndicator size="small" color="#06C168" />
            <Text style={styles.refreshText}>Updating...</Text>
          </View>
        ) : null}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            earningsQuery.isFetching && earnings
              ? styles.scrollContentFaded
              : null,
          ]}
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
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Earnings</Text>
              <View style={styles.headerUnderline} />
            </View>
            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={() => navigation.navigate("AdminWithdrawals")}
              activeOpacity={0.8}
            >
              <Feather name="credit-card" size={15} color="#fff" />
              <Text style={styles.withdrawText}>Withdrawals</Text>
            </TouchableOpacity>
          </View>

          {earningsQuery.error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {earningsQuery.error?.message || "Unable to load earnings data"}
              </Text>
            </View>
          )}

          {/* Main Revenue Card */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueHeader}>
              <Text style={styles.revenueLabel}>NET REVENUE</Text>
              {showComparison && (
                <View
                  style={[
                    styles.changeBadge,
                    isUp
                      ? styles.changeBadgePositive
                      : styles.changeBadgeNegative,
                  ]}
                >
                  <View
                    style={[
                      styles.changeBadgeIconWrap,
                      isUp
                        ? styles.changeBadgeIconWrapPositive
                        : styles.changeBadgeIconWrapNegative,
                    ]}
                  >
                    <Feather
                      name="arrow-up"
                      size={11}
                      color={isUp ? "#06C168" : "#DC2626"}
                      style={!isUp ? styles.changeBadgeArrowDown : null}
                    />
                  </View>
                  <Text
                    style={[
                      styles.changeBadgeText,
                      isUp
                        ? styles.changeBadgeTextPositive
                        : styles.changeBadgeTextNegative,
                    ]}
                  >
                    {Math.abs(pct)}%
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.revenueAmount}>
              {formatCurrency(earnings?.totalRevenue)}
            </Text>
            {showComparison ? (
              <View style={styles.revenueCompareRow}>
                <Text style={styles.revenueCompareLabel}>
                  {isUp ? "▲" : "▼"} {comparisonLabel}:
                </Text>
                <Text style={styles.revenueCompareValue}>
                  {formatCurrency(earnings?.previousRevenue)}
                </Text>
              </View>
            ) : null}

            {/* Period Selector */}
            <View style={styles.periodContainer}>
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
            </View>
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
              <Text style={styles.chartLabel}>Earnings Trend</Text>
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
                    earnings.chartData[
                      Math.floor(earnings.chartData.length / 2)
                    ]?.date,
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
                        Math.round(
                          earnings.totalRevenue / earnings.totalOrders,
                        ),
                      )
                    : "Rs. 0"}
                </Text>
              </View>
            </View>
          </View>

          {/* Day-by-Day Analysis */}
          <View style={styles.ordersSection}>
            <View style={styles.ordersSectionHeader}>
              <Text style={styles.ordersSectionTitle}>Day by Day Analysis</Text>
            </View>

            {dayByDayRows.length > 0 ? (
              <View style={styles.ordersList}>
                <View style={styles.analysisHeaderRow}>
                  <Text
                    style={[styles.analysisHeaderText, styles.analysisDateCol]}
                  >
                    Date, Day
                  </Text>
                  <Text
                    style={[styles.analysisHeaderText, styles.analysisSalesCol]}
                  >
                    Sales
                  </Text>
                </View>
                {dayByDayRows.map((row) => (
                  <View
                    key={`${row.date}-${row.day}`}
                    style={styles.analysisDataRow}
                  >
                    <Text
                      style={[styles.analysisCellText, styles.analysisDateCol]}
                    >
                      {formatDateWithDay(row.date, row.day)}
                    </Text>
                    <Text
                      style={[styles.analysisCellText, styles.analysisSalesCol]}
                    >
                      {formatCurrency(row.sales)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyOrders}>
                <Text style={styles.emptyOrdersText}>
                  No daily earnings data available
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>
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
  pageAnimationWrap: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContentFaded: {
    opacity: 0.9,
  },
  refreshOverlay: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    zIndex: 20,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
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
  headerTitleWrap: {
    alignItems: "flex-end",
    paddingTop: 2,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 36,
    lineHeight: 38,
    fontWeight: "500",
    color: "#111827",
    marginTop: 2,
  },
  headerUnderline: {
    width: 64,
    height: 3,
    borderRadius: 99,
    backgroundColor: "#06C168",
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
  },
  withdrawText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },

  // Revenue Card
  revenueCard: {
    backgroundColor: "rgba(6,193,104,0.10)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(6,193,104,0.28)",
    marginBottom: 14,
  },
  revenueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  revenueLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#06C168",
    letterSpacing: 0.3,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  changeBadgePositive: {
    backgroundColor: "rgba(6,193,104,0.12)",
  },
  changeBadgeNegative: {
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  changeBadgeIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBadgeIconWrapPositive: {
    backgroundColor: "rgba(6,193,104,0.14)",
  },
  changeBadgeIconWrapNegative: {
    backgroundColor: "rgba(220,38,38,0.14)",
  },
  changeBadgeArrowDown: {
    transform: [{ rotate: "180deg" }],
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  changeBadgeTextPositive: {
    color: "#06C168",
  },
  changeBadgeTextNegative: {
    color: "#DC2626",
  },
  revenueAmount: {
    fontSize: 45,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    lineHeight: 56,
  },
  revenueCompareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  revenueCompareLabel: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "700",
  },
  revenueCompareValue: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  periodContainer: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  periodButtonActive: {
    backgroundColor: "#06C168",
    borderColor: "#06C168",
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
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
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 25,
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
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
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
  analysisHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  analysisDataRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  analysisHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  analysisCellText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  analysisDateCol: {
    flex: 1.8,
  },
  analysisSalesCol: {
    flex: 1,
    textAlign: "right",
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(6,193,104,0.10)",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "rgba(6,193,104,0.10)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
    borderWidth: 1,
    borderColor: "rgba(6,193,104,0.28)",
  },
  completedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#06C168",
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
    backgroundColor: "rgba(6,193,104,0.32)",
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
    backgroundColor: "rgba(6,193,104,0.12)",
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
