import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
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
import ManagerHeader from "../../components/manager/ManagerHeader";
import { API_URL } from "../../config/env";

const ROLE_CARDS = [
  {
    role: "customer",
    title: "Customers",
    subtitle: "Promotions, updates and announcements",
    icon: "person-outline",
    color: "#2563EB",
    bg: "#DBEAFE",
  },
  {
    role: "admin",
    title: "Restaurant Admins",
    subtitle: "Policy updates and important alerts",
    icon: "business-outline",
    color: "#D97706",
    bg: "#FEF3C7",
  },
  {
    role: "driver",
    title: "Drivers",
    subtitle: "Schedule changes and bonus alerts",
    icon: "bicycle-outline",
    color: "#059669",
    bg: "#D1FAE5",
  },
];

export default function SendNotificationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/notification-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setHistory(Array.isArray(data.notifications) ? data.notifications : []);
      }
    } catch (error) {
      console.error("Failed to fetch manager notification history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);
  }, []);

  const renderHistoryItem = ({ item }) => {
    const sent = item.status === "sent";
    const createdAt = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "";
    const count = item?.data?.recipientCount;

    return (
      <View style={styles.historyItem}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: sent ? "#DCFCE7" : "#FEE2E2" },
          ]}
        >
          <Ionicons
            name={sent ? "checkmark-circle" : "alert-circle"}
            size={16}
            color={sent ? "#16A34A" : "#DC2626"}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {item.title || "Untitled Notification"}
          </Text>
          <Text style={styles.historyBody} numberOfLines={1}>
            {item.body || ""}
          </Text>
          <Text style={styles.historyMeta} numberOfLines={1}>
            {createdAt}
            {count ? `  •  ${count} recipients` : ""}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ManagerHeader title="Send Notification" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#06C168" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ManagerHeader
        title="Send Notification"
        showBack
        onRefresh={() => fetchHistory(false)}
      />

      <FlatList
        data={history.slice(0, 10)}
        keyExtractor={(item, index) => String(item.id ?? index)}
        renderItem={renderHistoryItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHistory(false)}
            colors={["#06C168"]}
          />
        }
        ListHeaderComponent={
          <View style={styles.contentWrap}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="megaphone-outline" size={24} color="#111816" />
              </View>
              <Text style={styles.heroTitle}>Manager Broadcast Center</Text>
              <Text style={styles.heroSubtitle}>
                Send push and in-app notifications to customers, restaurant
                admins, or drivers.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Choose Audience</Text>
            {ROLE_CARDS.map((card) => (
              <TouchableOpacity
                key={card.role}
                style={styles.roleCard}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate("SendNotificationForm", {
                    role: card.role,
                  })
                }
              >
                <View style={[styles.roleIcon, { backgroundColor: card.bg }]}>
                  <Ionicons name={card.icon} size={20} color={card.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>{card.title}</Text>
                  <Text style={styles.roleSubtitle}>{card.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
              Recent Notifications
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>No notification history yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  hero: {
    backgroundColor: "#06C168",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "rgba(17,24,22,0.72)",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748B",
    marginBottom: 8,
  },
  roleCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 2,
  },
  roleSubtitle: {
    fontSize: 12,
    color: "#618980",
    lineHeight: 16,
  },
  historyItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 1,
  },
  historyBody: {
    fontSize: 12,
    color: "#618980",
    marginBottom: 3,
  },
  historyMeta: {
    fontSize: 11,
    color: "#94A3B8",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
  },
});
