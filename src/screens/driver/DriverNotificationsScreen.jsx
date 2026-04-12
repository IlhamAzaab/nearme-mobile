import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { DriverListLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";
import supabaseClient from "../../services/supabaseClient";

const READ_NOTIFICATIONS_STORAGE_PREFIX = "@driver_notifications_read_map_";

const getNotificationReadStorageKey = (driverId) =>
  `${READ_NOTIFICATIONS_STORAGE_PREFIX}${driverId || "unknown"}`;

const getNotificationId = (item) =>
  String(item?.id || item?.notification_id || "");

function getNotifIcon(type) {
  switch (type) {
    case "new_delivery":
    case "order_assigned":
      return "🛵";
    case "order_ready":
      return "📦";
    case "order_on_the_way":
      return "🚗";
    case "order_delivered":
      return "🎉";
    default:
      return "📢";
  }
}

function getTimeAgo(timestamp) {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMins = Math.floor((now - then) / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

async function authFetch(url, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

function normalizeRealtimeNotification(row) {
  const metadata = row?.data || {};
  return {
    id: row.id,
    title: row.title || "Notification",
    body: row.body || row.message || "",
    message: row.body || row.message || "",
    data: metadata,
    type: metadata?.type || row.type || "info",
    is_read: false,
    created_at: row.sent_at || row.created_at || new Date().toISOString(),
    source: "notification_log",
  };
}

export default function DriverNotificationsScreen({ navigation }) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [driverId, setDriverId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [readMap, setReadMap] = useState({});
  const prevFocusedRef = useRef(isFocused);

  useEffect(() => {
    const resolveDriverId = async () => {
      const savedUserId = await AsyncStorage.getItem("userId");
      if (savedUserId) {
        setDriverId(savedUserId);
        return;
      }

      const token = await getAccessToken();
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const uid =
          payload.sub || payload.id || payload.userId || payload.user_id;
        if (uid) setDriverId(String(uid));
      } catch {
        // Ignore invalid token payload.
      }
    };

    resolveDriverId();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadReadMap = async () => {
      if (!driverId) return;
      try {
        const raw = await AsyncStorage.getItem(
          getNotificationReadStorageKey(driverId),
        );
        if (!mounted) return;
        const parsed = raw ? JSON.parse(raw) : {};
        setReadMap(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        if (mounted) setReadMap({});
      }
    };

    loadReadMap();
    return () => {
      mounted = false;
    };
  }, [driverId]);

  const notificationsQuery = useQuery({
    queryKey: ["driver", "notifications"],
    queryFn: async () => {
      const data = await authFetch(`${API_URL}/driver/notifications?limit=50`);
      return data.notifications || [];
    },
    staleTime: 60 * 1000,
    refetchInterval: isFocused ? 60 * 1000 : false,
    initialData: () => queryClient.getQueryData(["driver", "notifications"]),
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!driverId) return;

    const channel = supabaseClient
      .channel(`mobile-driver-notifications-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_log",
          filter: `user_id=eq.${driverId}`,
        },
        (payload) => {
          const next = normalizeRealtimeNotification(payload.new);
          queryClient.setQueryData(["driver", "notifications"], (prev = []) => {
            if (prev.some((n) => String(n.id) === String(next.id))) return prev;
            return [next, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [driverId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ["driver", "notifications"],
      });
    } finally {
      setRefreshing(false);
    }
  };

  const notifications = notificationsQuery.data || [];

  const notificationsWithReadState = useMemo(() => {
    return notifications.map((item) => {
      const id = getNotificationId(item);
      const localRead = Boolean(id && readMap[id]);
      return {
        ...item,
        is_read: Boolean(item?.is_read) || localRead,
      };
    });
  }, [notifications, readMap]);

  const counts = useMemo(() => {
    const unread = notificationsWithReadState.filter((n) => !n.is_read).length;
    return {
      all: notificationsWithReadState.length,
      unread,
    };
  }, [notificationsWithReadState]);

  useEffect(() => {
    const persist = async (nextMap) => {
      if (!driverId) return;
      await AsyncStorage.setItem(
        getNotificationReadStorageKey(driverId),
        JSON.stringify(nextMap),
      );
    };

    const wasFocused = prevFocusedRef.current;
    const nowFocused = isFocused;

    if (wasFocused && !nowFocused && notificationsWithReadState.length > 0) {
      setReadMap((prev) => {
        let changed = false;
        const next = { ...prev };

        notificationsWithReadState.forEach((item) => {
          const id = getNotificationId(item);
          if (!id || next[id]) return;
          next[id] = true;
          changed = true;
        });

        if (changed) {
          persist(next).catch(() => {});
          return next;
        }

        return prev;
      });
    }

    prevFocusedRef.current = nowFocused;
  }, [isFocused, notificationsWithReadState, driverId]);

  const handleNotificationPress = (notification) => {
    const notificationId = getNotificationId(notification);
    if (notificationId) {
      setReadMap((prev) => {
        if (prev[notificationId]) return prev;
        const next = { ...prev, [notificationId]: true };
        if (driverId) {
          AsyncStorage.setItem(
            getNotificationReadStorageKey(driverId),
            JSON.stringify(next),
          ).catch(() => {});
        }
        return next;
      });
    }

    let metadata = {};
    if (typeof notification?.data === "string") {
      try {
        metadata = JSON.parse(notification.data);
      } catch {
        metadata = {};
      }
    } else {
      metadata = notification?.data || notification?.metadata || {};
    }

    const paymentId =
      metadata.paymentId || metadata.payment_id || metadata.paymentID;
    const type = metadata.type || notification?.type;

    if (type === "payment_received" || paymentId) {
      navigation.navigate("DriverWithdrawals", {
        paymentId: paymentId ? String(paymentId) : null,
      });
      return;
    }

    if (metadata.delivery_id || metadata.order_id) {
      navigation.navigate("DriverMap", {
        deliveryId: metadata.delivery_id || metadata.order_id,
      });
    }
  };

  const renderItem = ({ item }) => {
    const unread = !item.is_read;
    return (
      <TouchableOpacity
        style={[styles.notifCard, unread && styles.notifUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.notifRow}>
          <View style={styles.notifIconWrap}>
            <Text style={styles.notifIconText}>{getNotifIcon(item.type)}</Text>
          </View>

          <View style={styles.notifContent}>
            <View style={styles.notifTitleRow}>
              <Text
                style={[styles.notifTitle, unread && styles.notifTitleUnread]}
                numberOfLines={2}
              >
                {item.title || "Notification"}
              </Text>
              {unread ? <View style={styles.unreadDot} /> : null}
            </View>

            <Text
              style={[styles.notifMessage, unread && styles.notifMessageUnread]}
              numberOfLines={3}
            >
              {item.body || item.message || ""}
            </Text>

            <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DriverNotifications" sectionIndex={0}>
          <DriverScreenHeader
            title="Notifications"
            rightIcon="refresh"
            onBackPress={() => navigation.goBack()}
            onRightPress={onRefresh}
          />
        </DriverScreenSection>

        <DriverScreenSection screenKey="DriverNotifications" sectionIndex={1}>
          <View style={styles.actionsRow}>
            <Text style={styles.badgeText}>{`${counts.unread} unread`}</Text>
            <Text style={styles.allLabel}>{`All (${counts.all})`}</Text>
          </View>
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DriverNotifications"
          sectionIndex={2}
          style={{ flex: 1 }}
        >
          {notificationsQuery.isLoading ? (
            <DriverListLoadingSkeleton count={6} />
          ) : (
            <FlatList
              data={notificationsWithReadState}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#06C168"]}
                />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🔔</Text>
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptyMessage}>
                    New notifications will appear here
                  </Text>
                </View>
              }
              ListFooterComponent={
                <Text style={styles.footer}>
                  Auto-refreshing every 60 seconds
                </Text>
              }
            />
          )}
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loader: { marginTop: 40 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  badgeText: { color: "#374151", fontWeight: "700", fontSize: 12 },
  allLabel: { color: "#6b7280", fontWeight: "700", fontSize: 12 },
  list: { paddingHorizontal: 12, paddingBottom: 42 },
  notifCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: "#06C168" },
  notifRow: { flexDirection: "row", gap: 12 },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ecfdf3",
    alignItems: "center",
    justifyContent: "center",
  },
  notifIconText: { fontSize: 17 },
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
    backgroundColor: "#06C168",
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
  emptyIcon: { fontSize: 48, marginBottom: 14 },
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
