import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { DriverListLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

async function authFetchJson(url) {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeliveryHistoryScreen({ navigation }) {
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["driver", "delivery-history"],
    queryFn: async () => {
      const data = await authFetchJson(`${API_URL}/driver/deliveries/history`);
      return data.deliveries || [];
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    initialData: () => queryClient.getQueryData(["driver", "delivery-history"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const deliveries = historyQuery.data || [];

  const stats = useMemo(() => {
    const totalEarnings = deliveries.reduce(
      (sum, item) => sum + (parseFloat(item.driver_earnings) || 0),
      0,
    );

    return {
      totalDeliveries: deliveries.length,
      totalEarnings,
      averageRating: 4.8,
    };
  }, [deliveries]);

  const filteredDeliveries = useMemo(() => {
    if (filter === "all") return deliveries;
    return deliveries.filter((item) => item.status === filter);
  }, [deliveries, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ["driver", "delivery-history"],
      });
    } finally {
      setRefreshing(false);
    }
  };

  const renderHistoryCard = ({ item }) => {
    const isDelivered = item.status === "delivered";
    const isCancelled = item.status === "cancelled";

    return (
      <View style={styles.historyCard}>
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
            {isDelivered ? "Delivered" : isCancelled ? "Cancelled" : "Pending"}
          </Text>
        </View>

        <View style={styles.orderInfo}>
          <Text
            style={styles.orderNumber}
          >{`#${item.orders?.order_number || item.order_id || item.id}`}</Text>
          <Text style={styles.orderDate}>{formatDate(item.delivered_at)}</Text>
        </View>

        <View style={styles.locationInfo}>
          <Text style={styles.locationText} numberOfLines={1}>
            {`Restaurant: ${item.orders?.restaurant_name || "Restaurant"}`}
          </Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {`Customer: ${item.orders?.customer_name || "Customer"}`}
          </Text>
        </View>

        {isDelivered ? (
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Your Earning</Text>
            <Text style={styles.earningsValue}>
              {`Rs. ${Number(item.driver_earnings || 0).toFixed(2)}`}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (historyQuery.isLoading && deliveries.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <DriverListLoadingSkeleton count={6} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DeliveryHistory" sectionIndex={0}>
          <DriverScreenHeader
            title="Delivery History"
            rightIcon="refresh"
            onBackPress={() => navigation.goBack()}
            onRightPress={onRefresh}
          />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DeliveryHistory"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <FlatList
            data={filteredDeliveries}
            keyExtractor={(item, index) =>
              String(item.id || item.order_id || index)
            }
            renderItem={renderHistoryCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#06C168"]}
              />
            }
            ListHeaderComponent={
              <>
                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, styles.deliveriesCard]}>
                    <Text style={styles.statLabel}>Total Deliveries</Text>
                    <Text style={styles.statValue}>
                      {stats.totalDeliveries}
                    </Text>
                  </View>

                  <View style={[styles.statCard, styles.earningsCard]}>
                    <Text style={styles.statLabel}>Total Earnings</Text>
                    <Text
                      style={styles.statValue}
                    >{`Rs. ${stats.totalEarnings.toFixed(2)}`}</Text>
                  </View>

                  <View style={[styles.statCard, styles.ratingCard]}>
                    <Text style={styles.statLabel}>Avg Rating</Text>
                    <Text style={styles.statValue}>{stats.averageRating}</Text>
                  </View>
                </View>

                <View style={styles.filterRow}>
                  {FILTER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.filterBtn,
                        filter === option.key && styles.filterBtnActive,
                      ]}
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
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Deliveries</Text>
                <Text style={styles.emptySubtitle}>
                  {filter === "all"
                    ? "Start accepting deliveries to see your history"
                    : `No ${filter} deliveries found`}
                </Text>
              </View>
            }
          />
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loader: { marginTop: 40 },
  listContent: { padding: 16, paddingBottom: 110 },

  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  deliveriesCard: { backgroundColor: "#eef2ff" },
  earningsCard: { backgroundColor: "#ecfdf3" },
  ratingCard: { backgroundColor: "#fff7ed" },
  statLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700" },
  statValue: {
    marginTop: 6,
    fontSize: 16,
    color: "#111827",
    fontWeight: "800",
  },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  filterBtnActive: { backgroundColor: "#06C168" },
  filterBtnText: { fontSize: 13, fontWeight: "700", color: "#6b7280" },
  filterBtnTextActive: { color: "#fff" },

  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    marginBottom: 10,
  },
  deliveredBadge: { backgroundColor: "#dcfce7" },
  cancelledBadge: { backgroundColor: "#fee2e2" },
  statusBadgeText: { fontSize: 11, color: "#6b7280", fontWeight: "700" },
  deliveredBadgeText: { color: "#15803d" },
  cancelledBadgeText: { color: "#b91c1c" },

  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  orderNumber: { fontSize: 15, color: "#111827", fontWeight: "800", flex: 1 },
  orderDate: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
  locationInfo: { gap: 4 },
  locationText: { fontSize: 13, color: "#374151", fontWeight: "600" },

  earningsRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningsLabel: { fontSize: 12, color: "#6b7280", fontWeight: "700" },
  earningsValue: { fontSize: 15, color: "#06C168", fontWeight: "800" },

  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    paddingVertical: 30,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
});
