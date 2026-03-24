import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
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
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";

const FILTER_TABS = ["all"];
const DRIVER_READ_IDS_KEY = "@driver_read_notification_ids";

function getNotifIcon(type) {
  switch (type) {
    case "new_delivery":
    case "order_assigned":
      return "";
    case "order_ready":
      return "";
    case "reminder":
      return "";
    default:
      return "";
  }
}

export default function DriverNotificationsScreen({ navigation }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [driverId, setDriverId] = useState(null);
  const [readIds, setReadIds] = useState(new Set());

  // Load persisted read IDs from AsyncStorage
  useEffect(() => {
    const loadReadIds = async () => {
      try {
        const stored = await AsyncStorage.getItem(DRIVER_READ_IDS_KEY);
        if (stored) {
          setReadIds(new Set(JSON.parse(stored)));
        }
      } catch (e) {
        console.log("[DriverNotifications] loadReadIds error:", e);
      }
    };
    loadReadIds();
  }, []);

  const persistReadIds = useCallback(async (ids) => {
    try {
      await AsyncStorage.setItem(DRIVER_READ_IDS_KEY, JSON.stringify([...ids]));
    } catch (e) {
      console.log("[DriverNotifications] persistReadIds error:", e);
    }
  }, []);

  // Mark all current notifications as read on screen open
  useEffect(() => {
    if (notifications.length > 0) {
      const allIds = new Set(readIds);
      let changed = false;
      for (const n of notifications) {
        if (!allIds.has(String(n.id))) {
          allIds.add(String(n.id));
          changed = true;
        }
      }
      if (changed) {
        setReadIds(allIds);
        persistReadIds(allIds);
      }
    }
  }, [notifications, persistReadIds]);

  useEffect(() => {
    const getDriver = async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const uid =
            payload.sub || payload.id || payload.userId || payload.user_id;
          setDriverId(uid);
        } catch {}
      }
    };
    getDriver();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await rateLimitedFetch(`${API_URL}/driver/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error("Fetch notifications error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds (was 15s), only when this screen is visible
    const interval = setInterval(() => {
      if (isFocusedRef.current) fetchNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotificationPress = (notification) => {
    // Mark this notification as read locally
    const newReadIds = new Set(readIds);
    newReadIds.add(String(notification.id));
    setReadIds(newReadIds);
    persistReadIds(newReadIds);

    try {
      // notification_log uses 'data' instead of 'metadata'
      const metadata = notification.data
        ? typeof notification.data === "string"
          ? JSON.parse(notification.data)
          : notification.data
        : notification.metadata
          ? typeof notification.metadata === "string"
            ? JSON.parse(notification.metadata)
            : notification.metadata
          : {};
      if (metadata.delivery_id || metadata.order_id) {
        navigation.navigate("ActiveDeliveries");
      }
    } catch {}
  };

  // notification_log has no is_read field - track locally via AsyncStorage
  const filtered = notifications;

  const unreadCount = notifications.filter(
    (n) => !readIds.has(String(n.id))
  ).length;

  const renderItem = ({ item }) => {
    const isUnread = !readIds.has(String(item.id));
    return (
      <TouchableOpacity
        style={[styles.notifCard, isUnread && styles.notifUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notifRow}>
          <View style={styles.notifIconWrap}>
            <Text style={styles.notifIconText}>{getNotifIcon(item.type)}</Text>
          </View>
          <View style={styles.notifContent}>
            <View style={styles.notifTitleRow}>
              <Text
                style={[styles.notifTitle, isUnread && styles.notifTitleUnread]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            <Text
              style={[styles.notifMessage, isUnread && styles.notifMessageUnread]}
              numberOfLines={2}
            >
              {item.body || item.message}
            </Text>
            <Text style={styles.notifTime}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <DriverScreenHeader
        title="Notifications"
        rightIcon="refresh"
        onBackPress={() => navigation.goBack()}
        onRightPress={() => {
          setRefreshing(true);
          fetchNotifications();
        }}
      />

      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {FILTER_TABS.map((tab) => {
          const count = notifications.length;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filter === tab && styles.tabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text
                style={[styles.tabText, filter === tab && styles.tabTextActive]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#3b82f6"
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications();
              }}
              colors={["#3b82f6"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}></Text>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyMessage}>
                {filter === "unread"
                  ? "You're all caught up!"
                  : "New notifications will appear here."}
              </Text>
            </View>
          }
          ListFooterComponent={
            <Text style={styles.footer}>Auto-refreshing every 60 seconds</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  unreadBadge: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
    marginTop: 2,
  },
  refreshBtn: { padding: 8 },
  refreshIcon: { fontSize: 22, color: "#6b7280" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 4,
    margin: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  notifCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: "#3b82f6" },
  notifRow: { flexDirection: "row", gap: 12 },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  notifIconText: { fontSize: 18 },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  notifTitle: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
    flex: 1,
    marginRight: 8,
  },
  notifTitleUnread: { color: "#111827", fontWeight: "700" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginTop: 4,
  },
  notifMessage: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
    lineHeight: 18,
  },
  notifMessageUnread: { color: "#374151" },
  notifTime: { fontSize: 11, color: "#9ca3af", marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 8,
  },
});
