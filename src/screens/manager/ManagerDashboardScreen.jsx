import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";
import SplashScreen from "../SplashScreen";

const screenWidth = Dimensions.get("window").width;

const MiniBarChart = ({ data, dataKey, color, maxHeight = 100 }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d[dataKey]), 1);
  const barWidth = (screenWidth - 80) / data.length - 8;
  return (
    <View style={[styles.chartContainer, { height: maxHeight + 40 }]}>
      {data.map((d, i) => {
        const h = Math.max((d[dataKey] / maxVal) * maxHeight, 4);
        const label =
          d[dataKey] > 0
            ? d[dataKey] >= 1000
              ? `${(d[dataKey] / 1000).toFixed(1)}k`
              : `${Math.round(d[dataKey])}`
            : "";
        return (
          <View key={i} style={styles.barWrapper}>
            <Text style={styles.barValue}>{label}</Text>
            <View
              style={[
                styles.bar,
                {
                  height: h,
                  backgroundColor: color,
                  opacity: i === data.length - 1 ? 1 : 0.6,
                  width: barWidth > 30 ? 30 : barWidth,
                },
              ]}
            />
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ManagerDashboardScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const [userName, setUserName] = useState("");
  const EMPTY_STATS = useMemo(
    () => ({
      todayEarnings: 0,
      todaySales: 0,
      todayOrders: 0,
      totalPendingFromDrivers: 0,
      driverPayment: 0,
      driverCount: 0,
      restaurantPayment: 0,
      restaurantCount: 0,
      earningsGraph: [],
    }),
    [],
  );

  const dashboardQuery = useQuery({
    queryKey: ["manager", "dashboard-stats"],
    queryFn: async () => {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message ||
            `Dashboard request failed (${res.status}). Please try again.`,
        );
      }

      return {
        todayEarnings: data.todayEarnings || 0,
        todaySales: data.todaySales || 0,
        todayOrders: data.todayOrders || 0,
        totalPendingFromDrivers: data.totalPendingFromDrivers || 0,
        driverPayment: data.driverPayment || 0,
        driverCount: data.driverCount || 0,
        restaurantPayment: data.restaurantPayment || 0,
        restaurantCount: data.restaurantCount || 0,
        earningsGraph: data.earningsGraph || [],
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: isFocused ? 90 * 1000 : false,
    initialData: () =>
      queryClient.getQueryData(["manager", "dashboard-stats"]) || undefined,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const stats = dashboardQuery.data || EMPTY_STATS;
  const loading = dashboardQuery.isLoading && !dashboardQuery.data;
  const refreshing = dashboardQuery.isFetching && !loading;

  useEffect(() => {
    (async () => {
      const email = await AsyncStorage.getItem("userEmail");
      if (email) {
        const name = email.split("@")[0];
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      }
    })();
  }, []);

  const formatCurrency = (value) =>
    `Rs.${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader title="Dashboard" onRefresh={dashboardQuery.refetch} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={dashboardQuery.refetch}
            colors={["#06C168"]}
          />
        }
      >
        {/* Today's Earnings Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroDecor1} />
          <View style={styles.heroDecor2} />
          <View style={styles.heroContent}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroLabel}>{"TODAY'S EARNINGS"}</Text>
              <View style={styles.heroIcon}>
                <Ionicons name="cash-outline" size={20} color="#56D68A" />
              </View>
            </View>
            <Text style={styles.heroAmount}>
              {formatCurrency(stats.todayEarnings)}
            </Text>
            <Text style={styles.heroSubtitle}>
              Welcome back, {userName || "Manager"}
            </Text>
          </View>
        </View>

        {/* Today's Sales & Orders */}
        <View style={styles.row}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#F3E8FF" }]}>
              <Ionicons name="wallet-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.statLabel}>{"TODAY'S SALES"}</Text>
            <Text style={styles.statValue}>
              {formatCurrency(stats.todaySales)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="clipboard-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.statLabel}>{"TODAY'S ORDERS"}</Text>
            <Text style={styles.statValueLarge}>{stats.todayOrders}</Text>
          </View>
        </View>

        {/* Payment Overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PAYMENT OVERVIEW</Text>

          {/* Pending from Drivers */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <View
                style={[styles.paymentIcon, { backgroundColor: "#FEF2F2" }]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color="#EF4444"
                />
              </View>
              <View>
                <Text style={styles.paymentTitle}>Pending from Drivers</Text>
                <Text style={styles.paymentSub}>
                  Cash collected, not deposited
                </Text>
              </View>
            </View>
            <Text style={[styles.paymentAmount, { color: "#DC2626" }]}>
              {formatCurrency(stats.totalPendingFromDrivers)}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Driver Payment */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <View
                style={[styles.paymentIcon, { backgroundColor: "#F0F9FF" }]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#0EA5E9"
                />
              </View>
              <View>
                <Text style={styles.paymentTitle}>Driver Payment</Text>
                <Text style={styles.paymentSub}>
                  To pay {stats.driverCount} driver
                  {stats.driverCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <View style={styles.paymentRight}>
              <Text style={[styles.paymentAmount, { color: "#0284C7" }]}>
                {formatCurrency(stats.driverPayment)}
              </Text>
              <View style={[styles.badge, { backgroundColor: "#F0F9FF" }]}>
                <Text style={[styles.badgeText, { color: "#0284C7" }]}>
                  {stats.driverCount} driver
                  {stats.driverCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Restaurant Payment */}
          <View style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <View
                style={[styles.paymentIcon, { backgroundColor: "#FFFBEB" }]}
              >
                <Ionicons name="restaurant-outline" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.paymentTitle}>Restaurant Payment</Text>
                <Text style={styles.paymentSub}>
                  To pay {stats.restaurantCount} restaurant
                  {stats.restaurantCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <View style={styles.paymentRight}>
              <Text style={[styles.paymentAmount, { color: "#D97706" }]}>
                {formatCurrency(stats.restaurantPayment)}
              </Text>
              <View style={[styles.badge, { backgroundColor: "#FFFBEB" }]}>
                <Text style={[styles.badgeText, { color: "#D97706" }]}>
                  {stats.restaurantCount} restaurant
                  {stats.restaurantCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings Graph */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Earnings</Text>
              <Text style={styles.chartSub}>Last 7 days</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: "#06C168" }]}
              />
              <Text style={styles.legendText}>Earnings</Text>
            </View>
          </View>
          {stats.earningsGraph.length > 0 ? (
            <MiniBarChart
              data={stats.earningsGraph}
              dataKey="earnings"
              color="#06C168"
              maxHeight={100}
            />
          ) : (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>No data yet</Text>
            </View>
          )}
        </View>

        {/* Sales Graph */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Sales</Text>
              <Text style={styles.chartSub}>Last 7 days</Text>
            </View>
            <View style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: "#7C3AED" }]}
              />
              <Text style={styles.legendText}>Sales</Text>
            </View>
          </View>
          {stats.earningsGraph.length > 0 ? (
            <MiniBarChart
              data={stats.earningsGraph}
              dataKey="sales"
              color="#7C3AED"
              maxHeight={100}
            />
          ) : (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>No data yet</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Drivers")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#06C168" }]}>
            <Ionicons name="receipt-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Manage Deposits</Text>
            <Text style={styles.actionSub}>Review driver deposits</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Earnings")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#2563EB" }]}>
            <Ionicons name="bar-chart-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>View Earnings</Text>
            <Text style={styles.actionSub}>Detailed earnings breakdown</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { marginBottom: 20 }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Reports")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#7C3AED" }]}>
            <Ionicons name="stats-chart-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>View Reports</Text>
            <Text style={styles.actionSub}>Analytics & performance</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Manage Section */}
        <Text style={styles.sectionTitle}>MANAGE</Text>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("Drivers", { screen: "DriverManagement" })
          }
        >
          <View style={[styles.actionIcon, { backgroundColor: "#0EA5E9" }]}>
            <Ionicons name="bicycle-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Manage Drivers</Text>
            <Text style={styles.actionSub}>Fleet, verification & payments</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("Admins", { screen: "RestaurantManagement" })
          }
        >
          <View style={[styles.actionIcon, { backgroundColor: "#F59E0B" }]}>
            <Ionicons name="restaurant-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Manage Restaurants</Text>
            <Text style={styles.actionSub}>Admins, payments & approvals</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { marginBottom: 20 }]}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("Reports", { screen: "SalesReports" })
          }
        >
          <View style={[styles.actionIcon, { backgroundColor: "#06C168" }]}>
            <Ionicons name="trending-up-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Sales Reports</Text>
            <Text style={styles.actionSub}>Detailed sales analytics</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { marginBottom: 20 }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("SendNotification")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#111816" }]}>
            <Ionicons name="megaphone-outline" size={20} color="#fff" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Send Notification</Text>
            <Text style={styles.actionSub}>
              Broadcast to users, admins or drivers
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 30 },

  // Hero
  heroCard: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },
  heroDecor1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  heroDecor2: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  heroContent: { position: "relative", zIndex: 1 },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  heroLabel: {
    color: "#56D68A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroAmount: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: { color: "rgba(167,243,208,0.6)", fontSize: 13, marginTop: 4 },

  // Stats row
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#111827" },
  statValueLarge: { fontSize: 28, fontWeight: "800", color: "#111827" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Payment rows
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  paymentLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentTitle: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  paymentSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  paymentRight: { alignItems: "flex-end" },
  paymentAmount: { fontSize: 16, fontWeight: "800" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  badgeText: { fontSize: 9, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F9FAFB", marginHorizontal: 16 },

  // Charts
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  barWrapper: { alignItems: "center", flex: 1, gap: 4 },
  bar: { borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barValue: { fontSize: 8, color: "#9CA3AF", fontWeight: "700" },
  barLabel: { fontSize: 9, color: "#6B7280", fontWeight: "500" },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  chartTitle: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  chartSub: { fontSize: 11, color: "#9CA3AF" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 9, color: "#6B7280", fontWeight: "500" },
  noData: { height: 96, justifyContent: "center", alignItems: "center" },
  noDataText: { color: "#D1D5DB", fontSize: 13 },

  // Quick Actions
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  actionSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
});
