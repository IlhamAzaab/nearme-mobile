import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";

const { width: screenWidth } = Dimensions.get("window");

// Query Functions
const fetchDashboardStats = async (period = "week") => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const response = await fetch(
    `${API_URL}/admin/dashboard-stats?chartPeriod=${period}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || `HTTP ${response.status}`);
  }

  return response.json();
};

const fetchRecentOrders = async () => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const response = await fetch(`${API_URL}/admin/orders?limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.orders || [];
};

const fetchRestaurant = async () => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const response = await fetch(`${API_URL}/admin/restaurant`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.restaurant || {};
};

const toggleRestaurantOpen = async () => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("No authentication token");

  const response = await fetch(`${API_URL}/admin/restaurant/toggle-open`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.restaurant;
};

// Components
const ChangeIndicator = ({ value }) => {
  if (value === 0 || value === undefined) {
    return <Text style={styles.noChangeText}>No change</Text>;
  }
  const isPositive = value > 0;
  return (
    <View style={styles.changeContainer}>
      <View
        style={[
          styles.changeIconContainer,
          isPositive ? styles.positiveChangeBg : styles.negativeChangeBg,
        ]}
      >
        <Text style={isPositive ? styles.positiveArrow : styles.negativeArrow}>
          {isPositive ? "↗" : "↘"}
        </Text>
      </View>
      <Text
        style={[
          styles.changeValue,
          isPositive ? styles.positiveText : styles.negativeText,
        ]}
      >
        {Math.abs(value)}%
      </Text>
      <Text style={styles.vsYesterdayText}>vs yesterday</Text>
    </View>
  );
};

const SkeletonLoader = ({ opacity }) => (
  <SafeAreaView style={styles.container}>
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.loadingContent}
    >
      {/* Header skeleton */}
      <Animated.View style={[styles.skeletonHeader, { opacity }]}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonHeaderText}>
          <View style={[styles.skeletonLine, { width: 150, height: 24 }]} />
          <View
            style={[
              styles.skeletonLine,
              { width: 100, height: 14, marginTop: 8 },
            ]}
          />
        </View>
      </Animated.View>

      {/* Toggle skeleton */}
      <Animated.View
        style={[
          styles.skeletonLine,
          {
            width: 200,
            height: 48,
            borderRadius: 16,
            marginVertical: 16,
            opacity,
          },
        ]}
      />

      {/* Performance cards skeleton */}
      <View style={styles.skeletonCards}>
        {[1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.skeletonCard, { opacity }]}>
            <View style={[styles.skeletonLine, { width: 80, height: 12 }]} />
            <View
              style={[
                styles.skeletonLine,
                { width: 100, height: 28, marginTop: 12 },
              ]}
            />
            <View
              style={[
                styles.skeletonLine,
                { width: 60, height: 12, marginTop: 8 },
              ]}
            />
          </Animated.View>
        ))}
      </View>

      {/* Chart skeleton */}
      <Animated.View style={[styles.skeletonChartContainer, { opacity }]}>
        <View
          style={[
            styles.skeletonLine,
            { width: 150, height: 20, marginBottom: 20 },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            { width: "100%", height: 200, borderRadius: 12 },
          ]}
        />
      </Animated.View>
    </ScrollView>
  </SafeAreaView>
);

export default function AdminDashboard() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [chartPeriod, setChartPeriod] = React.useState("week");
  const [refreshing, setRefreshing] = React.useState(false);

  // Animation refs
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;

  // Queries
  const statsQuery = useQuery({
    queryKey: ["admin", "dashboard", "stats", chartPeriod],
    queryFn: () => fetchDashboardStats(chartPeriod),
    staleTime: 60 * 1000, // 60s - dashboard specific
    refetchInterval: 60 * 1000,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin", "dashboard", "orders"],
    queryFn: fetchRecentOrders,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const restaurantQuery = useQuery({
    queryKey: ["admin", "restaurant"],
    queryFn: fetchRestaurant,
    staleTime: 120 * 1000, // 2min - restaurant info doesn't change often
    refetchInterval: 120 * 1000,
  });

  // Mutation for toggle
  const toggleMutation = useMutation({
    mutationFn: toggleRestaurantOpen,
    onSuccess: (data) => {
      // Update the restaurant query with new data
      queryClient.setQueryData(["admin", "restaurant"], data);
    },
    onError: () => {
      // Revert on error by invalidating
      queryClient.invalidateQueries({ queryKey: ["admin", "restaurant"] });
    },
  });

  // Skeleton animation loop
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

  // Determine loading state
  const isLoading =
    (statsQuery.isLoading && !statsQuery.data) ||
    (ordersQuery.isLoading && !ordersQuery.data) ||
    (restaurantQuery.isLoading && !restaurantQuery.data);

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalidate all dashboard-related queries
      await queryClient.invalidateQueries({
        queryKey: ["admin", "dashboard"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "restaurant"],
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Show skeleton while loading
  if (isLoading) {
    return <SkeletonLoader opacity={skeletonOpacity} />;
  }

  // Extract data
  const dashboardData = statsQuery.data;
  const recentOrders = ordersQuery.data || [];
  const restaurant = restaurantQuery.data || {};

  // Prepare chart data
  const chartData = useMemo(
    () => ({
      labels:
        dashboardData?.chartData?.slice(-7).map((item) => {
          if (chartPeriod === "year") {
            const months = [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ];
            const [, m] = item.date.split("-");
            return months[parseInt(m) - 1] || "";
          }
          const d = new Date(item.date);
          return `${d.getDate()}/${d.getMonth() + 1}`;
        }) || [],
      datasets: [
        {
          data: dashboardData?.chartData
            ?.slice(-7)
            .map((item) => item.amount || 0) || [0],
          strokeWidth: 2,
        },
      ],
    }),
    [dashboardData, chartPeriod],
  );

  const formatCurrency = (val) => `Rs. ${(val || 0).toLocaleString()}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.fixedHeaderLeft}>
          {restaurant?.logo_url ? (
            <Image
              source={{ uri: restaurant.logo_url }}
              style={styles.fixedHeaderLogo}
            />
          ) : (
            <View style={styles.fixedHeaderLogoPlaceholder} />
          )}
          <View style={styles.fixedHeaderTextContainer}>
            <Text style={styles.fixedHeaderTitle}>
              {restaurant?.name || "Restaurant"}
            </Text>
            <Text style={styles.fixedHeaderSubtitle}>
              {restaurant?.is_open ? "Open" : "Closed"}
            </Text>
          </View>
        </View>
        <Switch
          value={restaurant?.is_open || false}
          onValueChange={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          trackColor={{ false: "#e5e7eb", true: "#86efac" }}
          thumbColor={restaurant?.is_open ? "#16a34a" : "#9ca3af"}
          style={styles.fixedHeaderToggle}
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        {/* Error Message */}
        {(statsQuery.error || ordersQuery.error || restaurantQuery.error) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {statsQuery.error?.message ||
                ordersQuery.error?.message ||
                restaurantQuery.error?.message ||
                "Error loading dashboard"}
            </Text>
          </View>
        )}

        {/* Performance Cards */}
        <View style={styles.performanceCardsContainer}>
          {/* Sales Card */}
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>TOTAL SALES</Text>
            <Text style={[styles.performanceValue, styles.salesValue]}>
              {formatCurrency(dashboardData?.total_sales)}
            </Text>
            <ChangeIndicator value={dashboardData?.sales_change_percentage} />
          </View>

          {/* Orders Card */}
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>TOTAL ORDERS</Text>
            <Text style={[styles.performanceValue, styles.ordersValue]}>
              {dashboardData?.total_orders || 0}
            </Text>
            <ChangeIndicator value={dashboardData?.orders_change_percentage} />
          </View>

          {/* Average Order Card */}
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>AVERAGE ORDER</Text>
            <Text style={[styles.performanceValue, styles.avgValue]}>
              {formatCurrency(dashboardData?.average_order_value)}
            </Text>
            <ChangeIndicator value={dashboardData?.avg_change_percentage} />
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>REVENUE TREND</Text>
            <View style={styles.chartPeriodTabs}>
              {["week", "month", "year"].map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodTab,
                    chartPeriod === period && styles.periodTabActive,
                  ]}
                  onPress={() => setChartPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodTabText,
                      chartPeriod === period && styles.periodTabTextActive,
                    ]}
                  >
                    {period[0].toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {chartData.datasets[0].data.length > 0 ? (
            <LineChart
              data={chartData}
              width={screenWidth - 32}
              height={200}
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: () => "#3b82f6",
                labelColor: () => "#6b7280",
                style: { borderRadius: 16 },
                propsForDots: {
                  r: "5",
                  strokeWidth: "2",
                  stroke: "#3b82f6",
                },
                propsForBackgroundLines: {
                  strokeDasharray: "0",
                  stroke: "#e5e7eb",
                },
              }}
              style={styles.chart}
              bezier
              withDots={true}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLabels={true}
              withHorizontalLabels={true}
            />
          ) : (
            <Text style={styles.noChartText}>No chart data available</Text>
          )}
        </View>

        {/* Recent Orders Section */}
        <View style={styles.recentOrdersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ORDERS</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Orders")}>
              <Text style={styles.viewAllLink}>View All →</Text>
            </TouchableOpacity>
          </View>

          {recentOrders.length > 0 ? (
            <View>
              {recentOrders.map((order, index) => (
                <TouchableOpacity
                  key={order.id || index}
                  style={styles.orderCard}
                  onPress={() =>
                    navigation.navigate("OrderDetail", { orderId: order.id })
                  }
                >
                  <View style={styles.orderCardLeft}>
                    <Text style={styles.orderCardId}>Order #{order.id}</Text>
                    <Text style={styles.orderCardTime}>
                      {new Date(
                        order.created_at || Date.now(),
                      ).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.orderCardRight}>
                    <Text style={styles.orderCardAmount}>
                      {formatCurrency(order.total)}
                    </Text>
                    <View
                      style={[
                        styles.orderStatusBadge,
                        order.status === "delivered" && styles.statusDelivered,
                        order.status === "pending" && styles.statusPending,
                        order.status === "cancelled" && styles.statusCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.orderStatusText,
                          order.status === "delivered" &&
                            styles.orderStatusTextDelivered,
                          order.status === "pending" &&
                            styles.orderStatusTextPending,
                          order.status === "cancelled" &&
                            styles.orderStatusTextCancelled,
                        ]}
                      >
                        {order.status
                          ? order.status[0].toUpperCase() +
                            order.status.slice(1)
                          : "Unknown"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noOrdersText}>No recent orders</Text>
          )}
        </View>
      </ScrollView>

      {/* Loading Indicator for Mutation */}
      {toggleMutation.isPending && (
        <View style={styles.mutationLoadingOverlay}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}
    </SafeAreaView>
  );
}

// ═══════════ STYLES ═══════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  fixedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  fixedHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fixedHeaderLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  fixedHeaderLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    marginRight: 12,
  },
  fixedHeaderTextContainer: {
    flex: 1,
  },
  fixedHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  fixedHeaderSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  fixedHeaderToggle: {
    marginLeft: 8,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Error Banner
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  errorText: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "500",
  },

  // Loading Skeleton
  loadingContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    marginRight: 12,
  },
  skeletonHeaderText: {
    flex: 1,
  },
  skeletonLine: {
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
  },
  skeletonCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  skeletonChartContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },

  // Performance Cards
  performanceCardsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  performanceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    letterSpacing: 1,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 4,
  },
  salesValue: {
    color: "#111827",
  },
  ordersValue: {
    color: "#111827",
  },
  avgValue: {
    color: "#9333ea",
  },

  // Change Indicator
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  changeIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  positiveChangeBg: {
    backgroundColor: "#dcfce7",
  },
  negativeChangeBg: {
    backgroundColor: "#fee2e2",
  },
  positiveArrow: {
    fontSize: 10,
    color: "#06C168",
  },
  negativeArrow: {
    fontSize: 10,
    color: "#dc2626",
  },
  changeValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  positiveText: {
    color: "#06C168",
  },
  negativeText: {
    color: "#dc2626",
  },
  vsYesterdayText: {
    fontSize: 10,
    color: "#9ca3af",
  },
  noChangeText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },

  // Chart Section
  chartSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  chartPeriodTabs: {
    flexDirection: "row",
    gap: 8,
  },
  periodTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  periodTabActive: {
    backgroundColor: "#3b82f6",
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  periodTabTextActive: {
    color: "#ffffff",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noChartText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
    paddingVertical: 40,
  },

  // Recent Orders
  recentOrdersSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
  },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  orderCardLeft: {
    flex: 1,
  },
  orderCardId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  orderCardTime: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  orderCardRight: {
    alignItems: "flex-end",
  },
  orderCardAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  statusDelivered: {
    backgroundColor: "#dcfce7",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
  },
  statusCancelled: {
    backgroundColor: "#fee2e2",
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderStatusTextDelivered: {
    color: "#06C168",
  },
  orderStatusTextPending: {
    color: "#d97706",
  },
  orderStatusTextCancelled: {
    color: "#dc2626",
  },
  noOrdersText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
    paddingVertical: 20,
  },

  // Mutation Loading
  mutationLoadingOverlay: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
