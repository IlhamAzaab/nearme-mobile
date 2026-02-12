/**
 * Delivery History Screen
 * 
 * Shows driver's completed deliveries with:
 * - Stats overview (total deliveries, earnings, rating)
 * - Filter by status (all, delivered, cancelled)
 * - Delivery history list
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

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function DeliveryHistoryScreen({ navigation }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    totalEarnings: 0,
    averageRating: 4.8,
  });

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/driver/deliveries/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        const completed = data.deliveries || [];
        setDeliveries(completed);

        const totalEarnings = completed.reduce(
          (sum, d) => sum + (parseFloat(d.driver_earnings) || 0),
          0
        );

        setStats({
          totalDeliveries: completed.length,
          totalEarnings: totalEarnings,
          averageRating: 4.8,
        });
      }
    } catch (error) {
      console.log("Fetch history error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  // Filter deliveries
  const filteredDeliveries =
    filter === "all"
      ? deliveries
      : deliveries.filter((d) => d.status === filter);

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading history...</Text>
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
        <Text style={styles.headerTitle}>Delivery History</Text>
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
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.deliveriesCard]}>
            <Text style={styles.statIcon}>📦</Text>
            <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>

          <View style={[styles.statCard, styles.earningsCard]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>₹{stats.totalEarnings.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>

          <View style={[styles.statCard, styles.ratingCard]}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{stats.averageRating}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.filterBtn, filter === option.key && styles.filterBtnActive]}
              onPress={() => setFilter(option.key)}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  filter === option.key && styles.filterBtnTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Delivery List */}
        {filteredDeliveries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Deliveries Found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === "all"
                ? "You haven't completed any deliveries yet"
                : `No ${filter} deliveries found`}
            </Text>
          </View>
        ) : (
          filteredDeliveries.map((delivery, index) => {
            const isDelivered = delivery.status === "delivered";
            const isCancelled = delivery.status === "cancelled";

            return (
              <View key={delivery.id || index} style={styles.historyCard}>
                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    isDelivered && styles.deliveredBadge,
                    isCancelled && styles.cancelledBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isDelivered && styles.deliveredBadgeText,
                      isCancelled && styles.cancelledBadgeText,
                    ]}
                  >
                    {isDelivered ? "✅ Delivered" : isCancelled ? "❌ Cancelled" : "⏳ Pending"}
                  </Text>
                </View>

                {/* Order Info */}
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNumber}>
                    #{delivery.orders?.order_number || delivery.order_id}
                  </Text>
                  <Text style={styles.orderDate}>{formatDate(delivery.delivered_at)}</Text>
                </View>

                {/* Restaurant & Customer */}
                <View style={styles.locationInfo}>
                  <View style={styles.locationRow}>
                    <Text style={styles.locationIcon}>🏪</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {delivery.orders?.restaurant_name || "Restaurant"}
                    </Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Text style={styles.locationIcon}>👤</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                      {delivery.orders?.customer_name || "Customer"}
                    </Text>
                  </View>
                </View>

                {/* Earnings */}
                {isDelivered && (
                  <View style={styles.earningsRow}>
                    <Text style={styles.earningsLabel}>Earnings</Text>
                    <Text style={styles.earningsValue}>
                      ₹{parseFloat(delivery.driver_earnings || 0).toFixed(0)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
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

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  deliveriesCard: {
    backgroundColor: "#DBEAFE",
  },
  earningsCard: {
    backgroundColor: "#D1FAE5",
  },
  ratingCard: {
    backgroundColor: "#FEF3C7",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },

  // Filter Row
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  filterBtnActive: {
    backgroundColor: "#10b981",
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterBtnTextActive: {
    color: "#fff",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  // History Card
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  // Status Badge
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
  },
  deliveredBadge: {
    backgroundColor: "#D1FAE5",
  },
  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  deliveredBadgeText: {
    color: "#059669",
  },
  cancelledBadgeText: {
    color: "#DC2626",
  },

  // Order Info
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  orderDate: {
    fontSize: 12,
    color: "#6B7280",
  },

  // Location Info
  locationInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },

  // Earnings Row
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  earningsLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#059669",
  },
});
