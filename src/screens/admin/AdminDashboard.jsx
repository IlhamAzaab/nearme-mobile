import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";
import { getAccessToken } from "../../lib/authStorage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getDashboardCacheKey = (period) => ["admin", "dashboard", period];

const CHART_PERIODS = ["week", "month", "year"];

const statusPalette = {
  placed: { label: "New", bg: "#fef3c7", text: "#b45309" },
  pending: { label: "Accepted", bg: "#dcfce7", text: "#15803d" },
  accepted: { label: "Accepted", bg: "#dcfce7", text: "#15803d" },
  picked_up: { label: "Picked Up", bg: "#dbeafe", text: "#1d4ed8" },
  on_the_way: { label: "On the Way", bg: "#dbeafe", text: "#1d4ed8" },
  at_customer: { label: "Arriving", bg: "#e0e7ff", text: "#4338ca" },
  delivered: { label: "Delivered", bg: "#d1fae5", text: "#047857" },
  rejected: { label: "Rejected", bg: "#fee2e2", text: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "#f3f4f6", text: "#4b5563" },
};

const formatCurrency = (value) => `Rs. ${(value || 0).toLocaleString()}`;

const formatOrderDateTime = (dateStr) => {
  if (!dateStr) return { date: "", time: "" };
  const date = new Date(dateStr);
  return {
    date: date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const getOrderStatusFilter = (order) => {
  const ds = order?.delivery_status;
  if (!ds || ds === "placed") return "pending";
  if (ds === "pending" || ds === "accepted") return "accepted";
  if (["picked_up", "on_the_way", "at_customer", "delivered"].includes(ds)) {
    return "delivered";
  }
  return "all";
};

const getOrderItemsPreview = (order) => {
  if (typeof order?.items === "string") {
    return order.items.length > 40
      ? `${order.items.slice(0, 40)}...`
      : order.items;
  }

  if (Array.isArray(order?.items)) {
    const label = order.items
      .map((item) => item?.name || item?.product_name || "Item")
      .join(", ");
    return label.length > 40 ? `${label.slice(0, 40)}...` : label;
  }

  return "";
};

function ChangeIndicator({ value }) {
  if (value === 0 || value === undefined || value === null) {
    return <Text style={styles.noChangeText}>No change</Text>;
  }

  const isPositive = value > 0;

  return (
    <View style={styles.changeContainer}>
      <View
        style={[
          styles.changeDot,
          { backgroundColor: isPositive ? "#dcfce7" : "#fee2e2" },
        ]}
      >
        <Text
          style={[
            styles.changeArrow,
            { color: isPositive ? "#15803d" : "#dc2626" },
          ]}
        >
          {isPositive ? "↗" : "↘"}
        </Text>
      </View>
      <Text
        style={[
          styles.changeValue,
          { color: isPositive ? "#15803d" : "#dc2626" },
        ]}
      >
        {Math.abs(value)}%
      </Text>
      <Text style={styles.vsYesterday}>vs yesterday</Text>
    </View>
  );
}

function StatusBadge({ order }) {
  const ds = order?.delivery_status || order?.status;
  const status = statusPalette[ds] || {
    label: ds || "Unknown",
    bg: "#f3f4f6",
    text: "#4b5563",
  };

  return (
    <View style={[styles.badge, { backgroundColor: status.bg }]}>
      <Text style={[styles.badgeText, { color: status.text }]}>
        {status.label}
      </Text>
    </View>
  );
}

function SkeletonLoader({ opacity }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
      >
        <Animated.View style={[styles.skeletonHeaderCard, { opacity }]}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonTextBlock}>
              <View style={[styles.skeletonLine, { width: 130, height: 16 }]} />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 90, height: 12, marginTop: 8 },
                ]}
              />
            </View>
            <View style={[styles.skeletonCircle, { width: 38, height: 38 }]} />
          </View>
          <View style={styles.skeletonDivider} />
          <View style={styles.skeletonRowBetween}>
            <View>
              <View style={[styles.skeletonLine, { width: 110, height: 14 }]} />
              <View
                style={[
                  styles.skeletonLine,
                  { width: 100, height: 12, marginTop: 8 },
                ]}
              />
            </View>
            <View
              style={[
                styles.skeletonLine,
                { width: 46, height: 24, borderRadius: 999 },
              ]}
            />
          </View>
        </Animated.View>

        <View style={styles.skeletonSectionTitle} />
        <View style={styles.skeletonGrid2}>
          <Animated.View style={[styles.skeletonCard, { opacity }]} />
          <Animated.View style={[styles.skeletonCard, { opacity }]} />
        </View>

        <View style={styles.skeletonSectionTitle} />
        <Animated.View style={[styles.skeletonBigCard, { opacity }]} />

        <View style={styles.skeletonSectionTitle} />
        <Animated.View style={[styles.skeletonMenuCard, { opacity }]} />

        <Animated.View style={[styles.skeletonChartCard, { opacity }]}>
          <View
            style={[
              styles.skeletonLine,
              { width: 140, height: 16, marginBottom: 16 },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              { width: "100%", height: 210, borderRadius: 14 },
            ]}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function AdminDashboard() {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const [token, setToken] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("week");
  const [dashboardData, setDashboardData] = useState(() =>
    queryClient.getQueryData(getDashboardCacheKey("week")),
  );
  const [recentOrders, setRecentOrders] = useState(
    () => queryClient.getQueryData(["admin", "recent-orders"]) || [],
  );
  const [restaurant, setRestaurant] = useState(
    () => queryClient.getQueryData(["admin", "restaurant"]) || null,
  );
  const [loading, setLoading] = useState(
    !queryClient.getQueryData(getDashboardCacheKey("week")),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const pageEnterStyle = usePageEnterAnimation();

  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;
  const chartSwitchAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;

    const loadToken = async () => {
      const nextToken = await getAccessToken();
      if (!mounted) return;
      setToken(nextToken);
      setTokenReady(true);
    };

    loadToken();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.55,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [skeletonOpacity]);

  const handleUnauthorized = useCallback(async () => {
    await logout();
  }, [logout]);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard", chartPeriod],
    enabled: tokenReady && !!token,
    staleTime: 15 * 1000,
    refetchOnMount: "always",
    refetchInterval: 20 * 1000,
    refetchIntervalInBackground: true,
    placeholderData: (previousData) => previousData,
    initialData:
      queryClient.getQueryData(getDashboardCacheKey(chartPeriod)) || undefined,
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/admin/dashboard-stats?chartPeriod=${chartPeriod}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch dashboard stats");
      }

      queryClient.setQueryData(getDashboardCacheKey(chartPeriod), data);
      return data;
    },
  });

  const recentOrdersQuery = useQuery({
    queryKey: ["admin", "recent-orders"],
    enabled: tokenReady && !!token,
    staleTime: 15 * 1000,
    refetchOnMount: "always",
    refetchInterval: 20 * 1000,
    refetchIntervalInBackground: true,
    initialData:
      queryClient.getQueryData(["admin", "recent-orders"]) || undefined,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/orders?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch recent orders");
      }

      const orders = data?.orders || [];
      queryClient.setQueryData(["admin", "recent-orders"], orders);
      return orders;
    },
  });

  const restaurantQuery = useQuery({
    queryKey: ["admin", "restaurant"],
    enabled: tokenReady && !!token,
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    initialData: queryClient.getQueryData(["admin", "restaurant"]) || undefined,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/restaurant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Unauthorized");
      }

      if (!data?.restaurant) {
        throw new Error(data?.message || "Failed to fetch restaurant");
      }

      queryClient.setQueryData(["admin", "restaurant"], data.restaurant);
      return data.restaurant;
    },
  });

  useEffect(() => {
    if (dashboardQuery.data) {
      setDashboardData(dashboardQuery.data);
      Animated.timing(chartSwitchAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [chartSwitchAnim, dashboardQuery.data]);

  useEffect(() => {
    if (recentOrdersQuery.data) {
      setRecentOrders(recentOrdersQuery.data);
    }
  }, [recentOrdersQuery.data]);

  useEffect(() => {
    if (restaurantQuery.data) {
      setRestaurant(restaurantQuery.data);
    }
  }, [restaurantQuery.data]);

  useEffect(() => {
    const hasData =
      Boolean(dashboardData) || Boolean(restaurant) || recentOrders.length > 0;

    const initialLoading =
      (dashboardQuery.isLoading && !dashboardData) ||
      (restaurantQuery.isLoading && !restaurant) ||
      (recentOrdersQuery.isLoading && recentOrders.length === 0 && !hasData);

    setLoading(initialLoading);

    setRefreshing(
      !initialLoading &&
        (dashboardQuery.isFetching ||
          restaurantQuery.isFetching ||
          recentOrdersQuery.isFetching),
    );
  }, [
    dashboardData,
    dashboardQuery.isFetching,
    dashboardQuery.isLoading,
    recentOrders.length,
    recentOrdersQuery.isFetching,
    recentOrdersQuery.isLoading,
    restaurant,
    restaurantQuery.isFetching,
    restaurantQuery.isLoading,
  ]);

  const toggleRestaurantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/admin/restaurant/toggle-open`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error(data?.message || "Unauthorized");
      }

      if (!res.ok || !data?.restaurant) {
        throw new Error(data?.message || "Failed to toggle restaurant");
      }

      return data.restaurant;
    },
    onSuccess: (nextRestaurant) => {
      setRestaurant(nextRestaurant);
      queryClient.setQueryData(["admin", "restaurant"], nextRestaurant);
    },
  });

  const onToggleRestaurant = async () => {
    if (toggling || !token) return;

    setToggling(true);

    const previousRestaurant = restaurant;
    const optimisticRestaurant = previousRestaurant
      ? { ...previousRestaurant, is_open: !previousRestaurant.is_open }
      : previousRestaurant;

    setRestaurant(optimisticRestaurant);
    if (optimisticRestaurant) {
      queryClient.setQueryData(["admin", "restaurant"], optimisticRestaurant);
    }

    try {
      await toggleRestaurantMutation.mutateAsync();
    } catch (error) {
      console.error("Toggle restaurant error", error);
      setRestaurant(previousRestaurant);
      if (previousRestaurant) {
        queryClient.setQueryData(["admin", "restaurant"], previousRestaurant);
      }
    } finally {
      setToggling(false);
    }
  };

  const onPullRefresh = async () => {
    await Promise.all([
      dashboardQuery.refetch(),
      recentOrdersQuery.refetch(),
      restaurantQuery.refetch(),
    ]);
  };

  const revenueChange = dashboardData?.lifetime?.revenueChange;

  const onChangeChartPeriod = (nextPeriod) => {
    if (nextPeriod === chartPeriod) return;

    chartSwitchAnim.setValue(0.35);
    setChartPeriod(nextPeriod);
  };

  const chartData = useMemo(() => {
    const points = dashboardData?.chartData || [];

    return {
      labels: points.map((item) => {
        if (chartPeriod === "year") {
          const [, month] = String(item.date || "").split("-");
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
          return months[Number.parseInt(month, 10) - 1] || "";
        }

        const date = new Date(item.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }),
      datasets: [
        {
          data: points.length ? points.map((item) => item.amount || 0) : [0],
          strokeWidth: 2,
        },
      ],
    };
  }, [chartPeriod, dashboardData?.chartData]);

  const chartAnimatedStyle = useMemo(
    () => ({
      opacity: chartSwitchAnim,
      transform: [
        {
          translateY: chartSwitchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          }),
        },
      ],
    }),
    [chartSwitchAnim],
  );

  if (loading && !dashboardData && !restaurant) {
    return <SkeletonLoader opacity={skeletonOpacity} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onPullRefresh}
            colors={["#06C168"]}
            tintColor="#06C168"
          />
        }
      >
        <Animated.View
          style={[
            styles.contentWrap,
            pageEnterStyle,
            refreshing ? styles.contentWrapRefreshing : null,
          ]}
        >
          <View style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.restaurantInfoRow}>
                {restaurant?.logo_url ? (
                  <Image
                    source={{ uri: restaurant.logo_url }}
                    style={styles.restaurantLogo}
                  />
                ) : (
                  <View style={styles.restaurantLogoFallback}>
                    <MaterialCommunityIcons
                      name="storefront-outline"
                      size={24}
                      color="#ffffff"
                    />
                  </View>
                )}

                <View>
                  <Text style={styles.restaurantTitle}>
                    {restaurant?.restaurant_name ||
                      restaurant?.name ||
                      "Restaurant"}
                  </Text>
                  <Text style={styles.premiumLabel}>PREMIUM PARTNER</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => navigation.navigate("AdminNotifications")}
                activeOpacity={0.85}
              >
                <Feather name="bell" size={18} color="#4b5563" />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerDivider} />

            <View style={styles.statusRow}>
              <View>
                <Text style={styles.statusTitle}>Restaurant Status</Text>
                <Text
                  style={[
                    styles.statusSubtitle,
                    { color: restaurant?.is_open ? "#06C168" : "#ef4444" },
                  ]}
                >
                  {restaurant?.is_open ? "Currently open" : "Currently closed"}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.statusToggle,
                  {
                    backgroundColor: restaurant?.is_open
                      ? "#06C168"
                      : "#d1d5db",
                  },
                ]}
                onPress={onToggleRestaurant}
                disabled={toggling}
                activeOpacity={0.9}
              >
                <View
                  style={[
                    styles.statusToggleThumb,
                    restaurant?.is_open ? styles.statusToggleThumbOn : null,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeaderWrap}>
            <View style={styles.sectionMarker} />
            <Text style={styles.sectionTitle}>Today's Performance</Text>
          </View>

          <View style={styles.grid2}>
            <View style={styles.metricCard}>
              <View style={styles.metricHead}>
                <Text style={styles.metricLabelTop}>Today's Sales</Text>
                <View
                  style={[
                    styles.changePill,
                    {
                      backgroundColor:
                        (dashboardData?.changes?.salesChange ?? 0) >= 0
                          ? "rgba(6,193,104,0.12)"
                          : "rgba(239,68,68,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changePillText,
                      {
                        color:
                          (dashboardData?.changes?.salesChange ?? 0) >= 0
                            ? "#06C168"
                            : "#ef4444",
                      },
                    ]}
                  >
                    {(dashboardData?.changes?.salesChange ?? 0) >= 0 ? "+" : ""}
                    {dashboardData?.changes?.salesChange ?? 0}%
                  </Text>
                </View>
              </View>

              <Text style={styles.metricValuePriority}>
                {formatCurrency(dashboardData?.today?.sales)}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricHead}>
                <Text style={styles.metricLabelTop}>Today's Orders</Text>
                <View
                  style={[
                    styles.changePill,
                    {
                      backgroundColor:
                        (dashboardData?.changes?.ordersChange ?? 0) >= 0
                          ? "rgba(6,193,104,0.12)"
                          : "rgba(239,68,68,0.1)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changePillText,
                      {
                        color:
                          (dashboardData?.changes?.ordersChange ?? 0) >= 0
                            ? "#06C168"
                            : "#ef4444",
                      },
                    ]}
                  >
                    {(dashboardData?.changes?.ordersChange ?? 0) >= 0
                      ? "+"
                      : ""}
                    {dashboardData?.changes?.ordersChange ?? 0}%
                  </Text>
                </View>
              </View>

              <Text style={styles.metricValuePriority}>
                {dashboardData?.today?.orders || 0}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeaderWrap}>
            <View style={styles.sectionMarker} />
            <Text style={styles.sectionTitle}>Last 30 Day Performance</Text>
          </View>

          <LinearGradient
            colors={["#06C168", "#04a857", "#038848"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.revenueCard}
          >
            <View style={styles.revenueBgIcon}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={94}
                color="rgba(255,255,255,0.14)"
              />
            </View>

            <Text style={styles.revenueLabel}>Revenue</Text>
            <Text style={styles.revenueValue}>
              {formatCurrency(dashboardData?.lifetime?.totalRevenue)}
            </Text>

            <View style={styles.revenuePillRow}>
              <View style={styles.revenuePill}>
                <Ionicons
                  name="bag-handle-outline"
                  size={12}
                  color="rgba(255,255,255,0.85)"
                />
                <Text style={styles.revenuePillText}>
                  {(dashboardData?.lifetime?.totalOrders || 0).toLocaleString()}{" "}
                  Orders
                </Text>
              </View>

              <View style={[styles.revenuePill, styles.revenuePillStrong]}>
                <Text style={styles.revenuePillText}>
                  {revenueChange === undefined || revenueChange === null
                    ? "↗ No comparison data"
                    : revenueChange === 0
                      ? "→ Same as last 30 days"
                      : revenueChange > 0
                        ? `↗ Performance is up by ${Math.abs(revenueChange)}%`
                        : `↘ Performance is down by ${Math.abs(revenueChange)}%`}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeaderWrap}>
            <View style={styles.sectionMarker} />
            <Text style={styles.sectionTitle}>Menu Overview</Text>
          </View>

          <View style={styles.menuCard}>
            <View style={styles.menuCardInner}>
              <View style={styles.menuRow}>
                <View style={styles.menuRowLeft}>
                  <View
                    style={[styles.menuDot, { backgroundColor: "#9582C1" }]}
                  />
                  <Text style={styles.menuLabel}>Total Products</Text>
                </View>
                <Text style={styles.menuValue}>
                  {dashboardData?.products?.total || 0}
                </Text>
              </View>

              <View style={styles.menuDivider} />

              <View style={styles.menuRow}>
                <View style={styles.menuRowLeft}>
                  <View
                    style={[styles.menuDot, { backgroundColor: "#06C168" }]}
                  />
                  <Text style={styles.menuLabel}>Available Items</Text>
                </View>
                <Text style={styles.menuValue}>
                  {dashboardData?.products?.available || 0}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartTitleRow}>
              <View style={styles.sectionHeaderWrapInline}>
                <View style={styles.sectionMarker} />
                <Text style={styles.sectionTitle}>Sales Performance</Text>
              </View>
            </View>

            <View style={styles.periodTabsBelowTitle}>
              {CHART_PERIODS.map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodTab,
                    chartPeriod === period ? styles.periodTabActive : null,
                  ]}
                  onPress={() => onChangeChartPeriod(period)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.periodTabText,
                      chartPeriod === period
                        ? styles.periodTabTextActive
                        : null,
                    ]}
                  >
                    {period === "week"
                      ? "Weekly"
                      : period === "month"
                        ? "Monthly"
                        : "Yearly"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Animated.View style={chartAnimatedStyle}>
              {dashboardData?.chartData?.length ? (
                <LineChart
                  data={chartData}
                  width={Math.max(SCREEN_WIDTH - 56, 280)}
                  height={240}
                  yAxisSuffix=""
                  yAxisLabel="Rs."
                  withShadow
                  withInnerLines
                  withOuterLines
                  withHorizontalLines
                  withVerticalLines={false}
                  bezier
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(6, 193, 104, ${opacity})`,
                    labelColor: () => "#9ca3af",
                    fillShadowGradientFrom: "#06C168",
                    fillShadowGradientTo: "#06C168",
                    fillShadowGradientFromOpacity: 0.2,
                    fillShadowGradientToOpacity: 0,
                    propsForDots: {
                      r: "3",
                      strokeWidth: "1.5",
                      stroke: "#06C168",
                      fill: "#06C168",
                    },
                    propsForBackgroundLines: {
                      stroke: "#f3f4f6",
                      strokeDasharray: "3 3",
                    },
                  }}
                  style={styles.chart}
                />
              ) : (
                <View style={styles.emptyChartWrap}>
                  <Ionicons
                    name="bar-chart-outline"
                    size={36}
                    color="#d1d5db"
                  />
                  <Text style={styles.emptyChartText}>
                    No sales data for this period
                  </Text>
                </View>
              )}
            </Animated.View>
          </View>

          <View style={styles.recentOrdersCard}>
            <View style={styles.recentOrdersHead}>
              <View style={styles.sectionHeaderWrapInline}>
                <View style={styles.sectionMarker} />
                <Text style={styles.sectionTitle}>Recent Orders</Text>
              </View>

              <TouchableOpacity onPress={() => navigation.navigate("Orders")}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length === 0 ? (
              <View style={styles.emptyOrdersWrap}>
                <View style={styles.emptyOrdersIconWrap}>
                  <Ionicons
                    name="bag-handle-outline"
                    size={26}
                    color="#06C168"
                  />
                </View>
                <Text style={styles.emptyOrdersTitle}>No orders yet</Text>
                <Text style={styles.emptyOrdersSubtitle}>
                  Orders will appear here once customers start ordering
                </Text>
              </View>
            ) : (
              <View style={styles.orderList}>
                {recentOrders.map((order) => {
                  const dt = formatOrderDateTime(order?.created_at);

                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={styles.orderRow}
                      onPress={() =>
                        navigation.navigate("Orders", {
                          statusFilter: getOrderStatusFilter(order),
                          orderId: order.id,
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <View style={styles.orderAvatar}>
                        <Text style={styles.orderAvatarText}>
                          {(order?.customer || "C").charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.orderInfoCol}>
                        <View style={styles.orderTopLine}>
                          <Text style={styles.orderCustomer} numberOfLines={1}>
                            {order?.customer || "Customer"}
                          </Text>
                          <StatusBadge order={order} />
                        </View>

                        <View style={styles.orderMetaLine}>
                          <Text style={styles.orderNumber}>
                            #{order?.order_number || order?.id}
                          </Text>
                          <Text style={styles.dot}>·</Text>
                          <Text style={styles.orderItemsText} numberOfLines={1}>
                            {getOrderItemsPreview(order)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderAmountCol}>
                        <Text style={styles.orderAmount}>
                          Rs. {(order?.amount || 0).toLocaleString()}
                        </Text>
                        <Text style={styles.orderDateTime}>
                          {dt.date}
                          {dt.date && dt.time ? " · " : ""}
                          {dt.time}
                        </Text>
                      </View>

                      <Feather name="chevron-right" size={16} color="#d1d5db" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {dashboardData?.changes?.salesChange != null ? (
            <View style={styles.hiddenChangeAnchor}>
              <ChangeIndicator value={dashboardData?.changes?.salesChange} />
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  page: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  contentWrap: {
    gap: 12,
  },
  contentWrapRefreshing: {
    opacity: 0.9,
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#06C168",
    backgroundColor: "#ecfdf5",
  },
  restaurantLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#06C168",
    borderWidth: 2,
    borderColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 19,
  },
  premiumLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#06C168",
    marginTop: 2,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#ef4444",
  },
  headerDivider: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  statusSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  statusToggle: {
    width: 48,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  statusToggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  statusToggleThumbOn: {
    transform: [{ translateX: 24 }],
  },

  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderWrapInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionMarker: {
    width: 4,
    height: 28,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    backgroundColor: "#06C168",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  grid2: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
  },
  metricHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metricLabelTop: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "700",
  },
  changePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: "#111827",
  },
  metricValuePriority: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    color: "#111827",
  },

  revenueCard: {
    borderRadius: 16,
    padding: 18,
    overflow: "hidden",
    position: "relative",
  },
  revenueBgIcon: {
    position: "absolute",
    right: 6,
    top: "50%",
    marginTop: -48,
  },
  revenueLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  revenueValue: {
    color: "#ffffff",
    fontSize: 33,
    fontWeight: "800",
    marginBottom: 12,
  },
  revenuePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  revenuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  revenuePillStrong: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  revenuePillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  menuCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 12,
  },
  menuCardInner: {
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  menuLabel: {
    fontSize: 14,
    color: "#111827",
  },
  menuValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  menuDivider: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },

  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
  },
  chartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  periodTabsBelowTitle: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  periodTabs: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  periodTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  periodTabActive: {
    backgroundColor: "#06C168",
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  periodTabTextActive: {
    color: "#ffffff",
  },
  chart: {
    borderRadius: 12,
  },
  emptyChartWrap: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyChartText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },

  recentOrdersCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
  },
  recentOrdersHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  viewAllText: {
    color: "#06C168",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyOrdersWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  emptyOrdersIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,193,104,0.08)",
    marginBottom: 10,
  },
  emptyOrdersTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4b5563",
  },
  emptyOrdersSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  orderList: {
    gap: 8,
  },
  orderRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  orderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
  },
  orderAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  orderInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  orderTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  orderCustomer: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "700",
    maxWidth: "60%",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  orderMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  orderNumber: {
    color: "#06C168",
    fontSize: 11,
    fontWeight: "700",
  },
  dot: {
    color: "#d1d5db",
    fontSize: 11,
  },
  orderItemsText: {
    color: "#9ca3af",
    fontSize: 11,
    flex: 1,
  },
  orderAmountCol: {
    alignItems: "flex-end",
  },
  orderAmount: {
    color: "#06C168",
    fontSize: 14,
    fontWeight: "800",
  },
  orderDateTime: {
    marginTop: 2,
    color: "#9ca3af",
    fontSize: 10,
  },

  skeletonHeaderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonTextBlock: {
    flex: 1,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
    marginRight: 10,
  },
  skeletonCircle: {
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  skeletonLine: {
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  skeletonDivider: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginVertical: 12,
  },
  skeletonRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonSectionTitle: {
    height: 18,
    width: 180,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    marginTop: 4,
  },
  skeletonGrid2: {
    flexDirection: "row",
    gap: 12,
  },
  skeletonCard: {
    flex: 1,
    height: 112,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  skeletonBigCard: {
    height: 138,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  skeletonMenuCard: {
    height: 102,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  skeletonChartCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },

  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  changeDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  changeArrow: {
    fontSize: 10,
    fontWeight: "700",
  },
  changeValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  vsYesterday: {
    fontSize: 10,
    color: "#9ca3af",
  },
  noChangeText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  hiddenChangeAnchor: {
    display: "none",
  },
});
