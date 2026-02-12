/**
 * Driver Dashboard Screen
 * 
 * Shows driver statistics and quick actions:
 * - Available orders count
 * - Active delivery status
 * - Completed today count
 * - Today's earnings
 * - Quick action buttons
 */

import React, { useState, useEffect, useCallback } from "react";
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

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({
    activeDelivery: null,
    availableCount: 0,
    completedToday: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverName, setDriverName] = useState("");

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userName = await AsyncStorage.getItem("userName");
      setDriverName(userName || "Driver");

      if (!token) {
        navigation.replace("Login");
        return;
      }

      // Fetch active delivery
      const activeRes = await fetch(`${API_BASE_URL}/driver/deliveries/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (activeRes.status === 401 || activeRes.status === 403) {
        await AsyncStorage.clear();
        navigation.replace("Login");
        return;
      }

      const activeData = await activeRes.json();

      // Fetch available deliveries count
      const availableRes = await fetch(`${API_BASE_URL}/driver/deliveries/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const availableData = await availableRes.json();

      // Fetch today's earnings
      const earningsRes = await fetch(`${API_BASE_URL}/driver/earnings/summary?period=today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const earningsData = await earningsRes.json();

      setStats({
        activeDelivery: activeData.deliveries?.[0] || null,
        availableCount: availableData.deliveries?.length || 0,
        completedToday: earningsData.summary?.total_deliveries || 0,
        totalEarnings: earningsData.summary?.total_earnings || 0,
      });
    } catch (error) {
      console.log("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10b981"]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.driverName}>{driverName} 👋</Text>
          </View>
          <Pressable
            style={styles.notificationBtn}
            onPress={() => navigation.navigate("DriverNotifications")}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </Pressable>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Pressable
            style={[styles.statCard, styles.availableCard]}
            onPress={() => navigation.navigate("Available")}
          >
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statNumber}>{stats.availableCount}</Text>
            <Text style={styles.statLabel}>Available Orders</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, styles.activeCard]}
            onPress={() => navigation.navigate("Active")}
          >
            <Text style={styles.statIcon}>🚗</Text>
            <Text style={styles.statNumber}>{stats.activeDelivery ? "1" : "0"}</Text>
            <Text style={styles.statLabel}>Active Delivery</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, styles.completedCard]}
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statNumber}>{stats.completedToday}</Text>
            <Text style={styles.statLabel}>Completed Today</Text>
          </Pressable>

          <Pressable
            style={[styles.statCard, styles.earningsCard]}
            onPress={() => navigation.navigate("Earnings")}
          >
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statNumber}>₹{stats.totalEarnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </Pressable>
        </View>

        {/* Active Delivery Card */}
        {stats.activeDelivery && (
          <View style={styles.activeDeliverySection}>
            <Text style={styles.sectionTitle}>Active Delivery</Text>
            <Pressable
              style={styles.activeDeliveryCard}
              onPress={() => navigation.navigate("DriverMap", { deliveryId: stats.activeDelivery.id })}
            >
              <View style={styles.activeDeliveryHeader}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>
                    #{stats.activeDelivery.orders?.order_number || stats.activeDelivery.order_id}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {stats.activeDelivery.status?.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.deliveryInfo}>
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>🏪</Text>
                  <Text style={styles.locationText} numberOfLines={1}>
                    {stats.activeDelivery.orders?.restaurant_name || "Restaurant"}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationText} numberOfLines={1}>
                    {stats.activeDelivery.orders?.customer_address || "Customer Address"}
                  </Text>
                </View>
              </View>

              <View style={styles.viewRouteBtn}>
                <Text style={styles.viewRouteBtnText}>View Route →</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate("Available")}
            >
              <Text style={styles.quickActionIcon}>🔍</Text>
              <Text style={styles.quickActionText}>Find Deliveries</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate("DriverNotifications")}
            >
              <Text style={styles.quickActionIcon}>🔔</Text>
              <Text style={styles.quickActionText}>Notifications</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate("History")}
            >
              <Text style={styles.quickActionIcon}>📜</Text>
              <Text style={styles.quickActionText}>History</Text>
            </Pressable>

            <Pressable
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate("DriverProfile")}
            >
              <Text style={styles.quickActionIcon}>👤</Text>
              <Text style={styles.quickActionText}>Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>💡 Pro Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Accept multiple deliveries from nearby restaurants to earn extra bonuses!
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Keep your location updated for better delivery matching.
            </Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: "#6B7280",
  },
  driverName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  notificationBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationIcon: {
    fontSize: 24,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  availableCard: {
    backgroundColor: "#DBEAFE",
  },
  activeCard: {
    backgroundColor: "#FEF3C7",
  },
  completedCard: {
    backgroundColor: "#D1FAE5",
  },
  earningsCard: {
    backgroundColor: "#F3E8FF",
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 4,
    textAlign: "center",
  },

  // Active Delivery Section
  activeDeliverySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  activeDeliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  activeDeliveryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderBadge: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  orderBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  statusBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: "#059669",
    fontWeight: "600",
    fontSize: 12,
  },
  deliveryInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  viewRouteBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewRouteBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // Quick Actions
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionBtn: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },

  // Tips Section
  tipsSection: {
    marginBottom: 24,
  },
  tipCard: {
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },
});
