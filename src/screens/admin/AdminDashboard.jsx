import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  StyleSheet,
  Animated,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LineChart } from "react-native-chart-kit";
import { API_URL } from "../../config/env";

const { width: screenWidth } = Dimensions.get("window");

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [chartPeriod, setChartPeriod] = useState("week");
  const [networkError, setNetworkError] = useState(null);
  const navigation = useNavigation();

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  // Fetch dashboard stats with error handling
  const fetchDashboardStats = useCallback(async (period) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      console.warn("No auth token found");
      setNetworkError("Authentication token not found. Please login again.");
      return;
    }
    try {
      setNetworkError(null);
      const res = await fetchWithTimeout(
        `${API_URL}/admin/dashboard-stats?chartPeriod=${period}`,
        { 
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await res.json();
      if (res.ok) {
        setDashboardData(data);
        setNetworkError(null);
      } else {
        console.error("Dashboard stats API error:", data?.message || res.status);
        setNetworkError(data?.message || `API Error: ${res.status}`);
      }
    } catch (err) {
      console.error("Dashboard stats error:", err.message || err);
      const isAbort = err.name === 'AbortError' || err.message?.toLowerCase().includes('abort');
      if (isAbort) {
        setNetworkError(`Server connection timeout. Please check if your backend is running at ${API_URL}`);
      } else {
        setNetworkError(`Connection failed. Ensure your phone and computer are on the same WiFi and the IP ${API_URL} is correct.`);
      }
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      console.warn("No auth token found");
      return;
    }
    try {
      const commonHeaders = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch orders
      try {
        const ordersRes = await fetchWithTimeout(`${API_URL}/admin/orders?limit=5`, {
          headers: commonHeaders,
        });
        const ordersData = await ordersRes.json();
        if (ordersData.orders) setRecentOrders(ordersData.orders);
      } catch (err) {
        console.error("Fetch orders error:", err.message || err);
      }

      // Fetch restaurant
      try {
        const restaurantRes = await fetchWithTimeout(`${API_URL}/admin/restaurant`, {
          headers: commonHeaders,
        });
        const restaurantData = await restaurantRes.json();
        if (restaurantData.restaurant) setRestaurant(restaurantData.restaurant);
      } catch (err) {
        console.error("Fetch restaurant error:", err.message || err);
      }

      // Fetch stats
      await fetchDashboardStats(chartPeriod);
    } catch (err) {
      console.error("Dashboard fetch error:", err.message || err);
    }
  }, [chartPeriod, fetchDashboardStats]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAll();
      setLoading(false);

      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    };
    loadData();
  }, []);

  // Re-fetch chart data when period changes
  useEffect(() => {
    if (!loading) {
      fetchDashboardStats(chartPeriod);
    }
  }, [chartPeriod]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const toggleRestaurantOpen = async () => {
    if (toggling) return;
    setToggling(true);
    setRestaurant((prev) =>
      prev ? { ...prev, is_open: !prev.is_open } : prev
    );
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetchWithTimeout(`${API_URL}/admin/restaurant/toggle-open`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }, 5000);
      const data = await res.json();
      if (res.ok && data.restaurant) {
        setRestaurant(data.restaurant);
      } else {
        setRestaurant((prev) =>
          prev ? { ...prev, is_open: !prev.is_open } : prev
        );
      }
    } catch {
      setRestaurant((prev) =>
        prev ? { ...prev, is_open: !prev.is_open } : prev
      );
    } finally {
      setToggling(false);
    }
  };

  // Helpers
  const formatCurrency = (val) => `Rs. ${(val || 0).toLocaleString()}`;

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

  // Loading skeleton
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.loadingContent}>
          {/* Header skeleton */}
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonHeaderText}>
              <View style={[styles.skeletonLine, { width: 150, height: 24 }]} />
              <View style={[styles.skeletonLine, { width: 100, height: 14, marginTop: 8 }]} />
            </View>
          </View>

          {/* Toggle skeleton */}
          <View style={[styles.skeletonLine, { width: 200, height: 48, borderRadius: 16, marginVertical: 16 }]} />

          {/* Performance cards skeleton */}
          <View style={styles.skeletonCards}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={[styles.skeletonLine, { width: 80, height: 12 }]} />
                <View style={[styles.skeletonLine, { width: 100, height: 28, marginTop: 12 }]} />
                <View style={[styles.skeletonLine, { width: 60, height: 12, marginTop: 8 }]} />
              </View>
            ))}
          </View>

          {/* Chart skeleton */}
          <View style={styles.skeletonChartContainer}>
            <View style={[styles.skeletonLine, { width: 150, height: 20, marginBottom: 20 }]} />
            <View style={[styles.skeletonLine, { width: "100%", height: 200, borderRadius: 12 }]} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Prepare chart data
  const chartData = {
    labels:
      dashboardData?.chartData?.slice(-7).map((item) => {
        if (chartPeriod === "year") {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const [, m] = item.date.split("-");
          return months[parseInt(m) - 1] || "";
        }
        const d = new Date(item.date);
        return `${d.getDate()}/${d.getMonth() + 1}`;
      }) || [],
    datasets: [
      {
        data: dashboardData?.chartData?.slice(-7).map((item) => item.amount) || [0],
        strokeWidth: 2,
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ═══════════ Fixed Header Bar ═══════════ */}
      <View style={styles.fixedHeader}>
        <View style={styles.fixedHeaderLeft}>
          {restaurant?.logo_url ? (
            <Image
              source={{ uri: restaurant.logo_url }}
              style={styles.fixedHeaderLogo}
            />
          ) : (
            <View style={styles.fixedHeaderLogoPlaceholder}>
              <Text style={styles.fixedHeaderLogoText}>
                {restaurant?.restaurant_name?.charAt(0) || "R"}
              </Text>
            </View>
          )}
          <View style={styles.fixedHeaderInfo}>
            <Text style={styles.fixedHeaderName} numberOfLines={1}>
              {restaurant?.restaurant_name || "Dashboard"}
            </Text>
            <Text style={styles.fixedHeaderDate}>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("AdminNotifications")}
          style={styles.fixedHeaderNotifBtn}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Network Error Banner */}
      {networkError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {networkError}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#22c55e"]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* ═══════════ Toggle Card ═══════════ */}
          <View style={styles.toggleCard}>
            <TouchableOpacity
              onPress={toggleRestaurantOpen}
              disabled={toggling}
              style={[
                styles.toggleButton,
                restaurant?.is_open ? styles.toggleButtonOpen : styles.toggleButtonClosed,
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.toggleTrack,
                  restaurant?.is_open ? styles.toggleTrackOpen : styles.toggleTrackClosed,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    restaurant?.is_open ? styles.toggleThumbOpen : styles.toggleThumbClosed,
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.toggleText,
                  restaurant?.is_open ? styles.toggleTextOpen : styles.toggleTextClosed,
                ]}
              >
                {restaurant?.is_open ? "Restaurant Open" : "Restaurant Closed"}
              </Text>
              {restaurant?.is_manually_overridden && (
                <View style={styles.manualBadge}>
                  <Text style={styles.manualBadgeText}>Manual</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ═══════════ Block 2: Today Performance ═══════════ */}
          <View style={styles.performanceCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIndicator} />
              <Text style={styles.sectionTitle}>Today's Performance</Text>
            </View>

            {/* Today Sales */}
            <View style={styles.performanceItem}>
              <View style={[styles.performanceIcon, styles.salesIconBg]}>
                <Text style={styles.iconEmoji}>💰</Text>
              </View>
              <View style={styles.performanceDetails}>
                <Text style={styles.performanceLabel}>TODAY SALES</Text>
                <Text style={[styles.performanceValue, styles.salesValue]}>
                  {formatCurrency(dashboardData?.today?.sales)}
                </Text>
                <ChangeIndicator value={dashboardData?.changes?.salesChange} />
              </View>
            </View>

            {/* Today Orders */}
            <View style={styles.performanceItem}>
              <View style={[styles.performanceIcon, styles.ordersIconBg]}>
                <Text style={styles.iconEmoji}>📦</Text>
              </View>
              <View style={styles.performanceDetails}>
                <Text style={styles.performanceLabel}>TODAY ORDERS</Text>
                <Text style={[styles.performanceValue, styles.ordersValue]}>
                  {dashboardData?.today?.orders || 0}
                </Text>
                <ChangeIndicator value={dashboardData?.changes?.ordersChange} />
              </View>
            </View>

            {/* Avg Order Value */}
            <View style={styles.performanceItem}>
              <View style={[styles.performanceIcon, styles.avgIconBg]}>
                <Text style={styles.iconEmoji}>📊</Text>
              </View>
              <View style={styles.performanceDetails}>
                <Text style={styles.performanceLabel}>AVG ORDER VALUE</Text>
                <Text style={[styles.performanceValue, styles.avgValue]}>
                  {formatCurrency(dashboardData?.today?.avgOrderValue)}
                </Text>
                <ChangeIndicator value={dashboardData?.changes?.avgChange} />
              </View>
            </View>
          </View>

          {/* ═══════════ Block 3: Lifetime Stats ═══════════ */}
          <View style={styles.lifetimeContainer}>
            <View style={styles.lifetimeCardRevenue}>
              <View style={styles.lifetimeContent}>
                <Text style={styles.lifetimeLabel}>TOTAL REVENUE</Text>
                <Text style={styles.lifetimeValue}>
                  {formatCurrency(dashboardData?.lifetime?.totalRevenue)}
                </Text>
                <Text style={styles.lifetimeSubtext}>Lifetime admin earnings</Text>
              </View>
              <Text style={styles.lifetimeEmoji}>💰</Text>
            </View>

            <View style={styles.lifetimeCardOrders}>
              <View style={styles.lifetimeContent}>
                <Text style={styles.lifetimeLabel}>TOTAL ORDERS</Text>
                <Text style={styles.lifetimeValue}>
                  {(dashboardData?.lifetime?.totalOrders || 0).toLocaleString()}
                </Text>
                <Text style={styles.lifetimeSubtext}>All time orders fulfilled</Text>
              </View>
              <Text style={styles.lifetimeEmoji}>📦</Text>
            </View>
          </View>

          {/* ═══════════ Block 4: Sales Performance Chart ═══════════ */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIndicator} />
                <Text style={styles.sectionTitle}>Sales Performance</Text>
              </View>
              <View style={styles.chartPeriodButtons}>
                {["week", "month", "year"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setChartPeriod(p)}
                    style={[
                      styles.periodButton,
                      chartPeriod === p ? styles.periodButtonActive : styles.periodButtonInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        chartPeriod === p
                          ? styles.periodButtonTextActive
                          : styles.periodButtonTextInactive,
                      ]}
                    >
                      {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {dashboardData?.chartData?.length > 0 ? (
              <LineChart
                data={chartData}
                width={screenWidth - 48}
                height={220}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: "4",
                    strokeWidth: "2",
                    stroke: "#22c55e",
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: "#f0f0f0",
                  },
                }}
                bezier
                style={styles.chart}
              />
            ) : (
              <View style={styles.noChartData}>
                <Text style={styles.noChartIcon}>📊</Text>
                <Text style={styles.noChartText}>No sales data for this period</Text>
              </View>
            )}
          </View>

          {/* ═══════════ Block 5: Products Info ═══════════ */}
          <View style={styles.productsContainer}>
            <View style={styles.productCard}>
              <View>
                <Text style={styles.productLabel}>TOTAL PRODUCTS</Text>
                <Text style={[styles.productValue, styles.totalProductsValue]}>
                  {dashboardData?.products?.total || 0}
                </Text>
                <Text style={styles.productSubtext}>All menu items</Text>
              </View>
              <View style={[styles.productIconContainer, styles.totalProductsIconBg]}>
                <Text style={styles.productEmoji}>🍽️</Text>
              </View>
            </View>

            <View style={styles.productCard}>
              <View>
                <Text style={styles.productLabel}>AVAILABLE</Text>
                <Text style={[styles.productValue, styles.availableProductsValue]}>
                  {dashboardData?.products?.available || 0}
                </Text>
                <Text style={styles.productSubtext}>Currently active</Text>
              </View>
              <View style={[styles.productIconContainer, styles.availableProductsIconBg]}>
                <Text style={styles.productEmoji}>✅</Text>
              </View>
            </View>
          </View>

          {/* ═══════════ Block 6: Recent Orders ═══════════ */}
          <View style={styles.ordersCard}>
            <View style={styles.ordersHeader}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIndicator} />
                <Text style={styles.sectionTitle}>Recent Orders</Text>
              </View>
              <Text style={styles.ordersSubtitle}>Latest customer orders</Text>
            </View>

            {recentOrders.length === 0 ? (
              <View style={styles.noOrders}>
                <View style={styles.noOrdersIconContainer}>
                  <Text style={styles.noOrdersIcon}>📦</Text>
                </View>
                <Text style={styles.noOrdersTitle}>No orders yet</Text>
                <Text style={styles.noOrdersSubtitle}>
                  Orders will appear here once customers start ordering
                </Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {recentOrders.map((order, index) => (
                  <View
                    key={order.id}
                    style={[
                      styles.orderItem,
                      index !== recentOrders.length - 1 && styles.orderItemBorder,
                    ]}
                  >
                    <View style={styles.orderCustomer}>
                      <View style={styles.customerAvatar}>
                        <Text style={styles.customerAvatarText}>
                          {order.customer.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.customerInfo}>
                        <Text style={styles.customerName}>{order.customer}</Text>
                        <Text style={styles.orderNumber}>#{order.order_number}</Text>
                      </View>
                    </View>
                    <View style={styles.orderDetails}>
                      <Text style={styles.orderAmount}>
                        Rs. {order.amount.toLocaleString()}
                      </Text>
                      <Text style={styles.orderTime}>{order.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  loadingContent: {
    padding: 16,
  },
  animatedContainer: {
    gap: 16,
  },

  // Skeleton styles
  skeletonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  skeletonHeaderText: {
    flex: 1,
  },
  skeletonLine: {
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
  },
  skeletonCards: {
    gap: 12,
    marginTop: 16,
  },
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  skeletonChartContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },

  // Header Card
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  headerContent: {
    gap: 16,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  restaurantLogo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#bbf7d0",
  },
  restaurantLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantLogoText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#16a34a",
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  // Toggle Button
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  toggleButtonOpen: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  toggleButtonClosed: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleTrackOpen: {
    backgroundColor: "#22c55e",
  },
  toggleTrackClosed: {
    backgroundColor: "#f87171",
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    position: "absolute",
  },
  toggleThumbOpen: {
    right: 3,
  },
  toggleThumbClosed: {
    left: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  toggleTextOpen: {
    color: "#15803d",
  },
  toggleTextClosed: {
    color: "#dc2626",
  },
  manualBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  manualBadgeText: {
    fontSize: 10,
    color: "#d97706",
    fontWeight: "600",
  },

  // Performance Card
  performanceCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionIndicator: {
    width: 4,
    height: 24,
    backgroundColor: "#22c55e",
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  performanceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0fdf4",
  },
  performanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  salesIconBg: {
    backgroundColor: "#dcfce7",
  },
  ordersIconBg: {
    backgroundColor: "#dbeafe",
  },
  avgIconBg: {
    backgroundColor: "#f3e8ff",
  },
  iconEmoji: {
    fontSize: 20,
  },
  performanceDetails: {
    flex: 1,
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
    color: "#16a34a",
  },
  ordersValue: {
    color: "#2563eb",
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
    color: "#16a34a",
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
    color: "#16a34a",
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

  // Lifetime Stats
  lifetimeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  lifetimeCardRevenue: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lifetimeCardOrders: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lifetimeContent: {
    flex: 1,
  },
  lifetimeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 1,
  },
  lifetimeValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },
  lifetimeSubtext: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  lifetimeEmoji: {
    fontSize: 32,
    opacity: 0.8,
  },

  // Chart Card
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  chartPeriodButtons: {
    flexDirection: "row",
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  periodButtonActive: {
    backgroundColor: "#22c55e",
  },
  periodButtonInactive: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  periodButtonTextInactive: {
    color: "#15803d",
  },
  chart: {
    marginTop: 16,
    borderRadius: 16,
  },
  noChartData: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  noChartIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noChartText: {
    fontSize: 14,
    color: "#9ca3af",
  },

  // Products Container
  productsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  productLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    letterSpacing: 1,
  },
  productValue: {
    fontSize: 26,
    fontWeight: "bold",
    marginTop: 4,
  },
  totalProductsValue: {
    color: "#ea580c",
  },
  availableProductsValue: {
    color: "#16a34a",
  },
  productSubtext: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 2,
  },
  productIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  totalProductsIconBg: {
    backgroundColor: "#ffedd5",
  },
  availableProductsIconBg: {
    backgroundColor: "#dcfce7",
  },
  productEmoji: {
    fontSize: 24,
  },

  // Orders Card
  ordersCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  ordersHeader: {
    marginBottom: 16,
  },
  ordersSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 12,
  },
  noOrders: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noOrdersIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  noOrdersIcon: {
    fontSize: 32,
  },
  noOrdersTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  noOrdersSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  ordersList: {
    gap: 0,
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  orderItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0fdf4",
  },
  orderCustomer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  customerAvatarText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  customerInfo: {
    gap: 2,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  orderNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },
  orderDetails: {
    alignItems: "flex-end",
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#16a34a",
  },
  orderTime: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderBottomWidth: 1,
    borderBottomColor: "#fca5a5",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#991b1b",
    textAlign: "center",
  },

  // Fixed Header
  fixedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#dcfce7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  fixedHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  fixedHeaderLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
  },
  fixedHeaderLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  fixedHeaderLogoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  fixedHeaderInfo: {
    flex: 1,
  },
  fixedHeaderName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#15803d",
  },
  fixedHeaderDate: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  fixedHeaderNotifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  toggleCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
});
