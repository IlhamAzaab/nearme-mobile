import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";
import usePageEnterAnimation from "../../hooks/usePageEnterAnimation";
import { getAccessToken } from "../../lib/authStorage";
import { supabase } from "../../services/supabaseClient";

const ADMIN_UNREAD_KEY = "@admin_notifications_unread_count";

const parseNotificationMetadata = (notification) => {
  try {
    const data =
      typeof notification?.data === "string"
        ? JSON.parse(notification.data)
        : notification?.data;
    if (data && typeof data === "object") return data;

    const metadata =
      typeof notification?.metadata === "string"
        ? JSON.parse(notification.metadata)
        : notification?.metadata;
    if (metadata && typeof metadata === "object") return metadata;

    return {};
  } catch {
    return {};
  }
};

const fetchAdminNotifications = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/notifications?limit=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.message || "Failed to fetch notifications");
  return data.notifications || [];
};

const markAdminNotificationsRead = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_URL}/admin/notifications/mark-all-read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to mark notifications as read");
  }

  await AsyncStorage.setItem(ADMIN_UNREAD_KEY, "0");
};

export default function AdminNotifications() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [adminId, setAdminId] = useState(null);
  const [filter, setFilter] = useState("all");
  const pageEnterStyle = usePageEnterAnimation();

  const notificationsQuery = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: fetchAdminNotifications,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAdminNotificationsRead,
    onSuccess: () => {
      queryClient.setQueryData(["admin", "notifications"], (prev = []) =>
        prev.map((notif) => ({
          ...notif,
          is_read: true,
          read_at: notif.read_at || new Date().toISOString(),
        })),
      );
    },
    onError: (e) => {
      console.error("Mark all read error:", e);
    },
  });

  const notifications = notificationsQuery.data || [];
  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((n) => {
          const metadata = parseNotificationMetadata(n);
          const notifType = metadata.type || n.type || null;
          return notifType === filter;
        });
  const loading = notificationsQuery.isLoading && !notificationsQuery.data;

  useEffect(() => {
    const init = async () => {
      const userId = await AsyncStorage.getItem("userId");
      setAdminId(userId);
    };

    init();
  }, []);

  useEffect(() => {
    if (notifications.length === 0) return;
    if (markReadMutation.isPending) return;

    const unreadExists = notifications.some((n) => !n.is_read);
    if (!unreadExists) return;

    markReadMutation.mutate();
  }, [notifications, markReadMutation]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!supabase || !adminId) return;

    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_log",
          filter: `user_id=eq.${adminId}`,
        },
        (payload) => {
          queryClient.setQueryData(["admin", "notifications"], (prev = []) => {
            const newNotif = payload.new;
            const mapped = {
              id: newNotif.id,
              title: newNotif.title,
              body: newNotif.body,
              message: newNotif.body,
              data: newNotif.data || {},
              metadata: newNotif.data || {},
              type: newNotif?.data?.type || "general",
              is_read: newNotif.status === "read",
              created_at: newNotif.sent_at || newNotif.created_at,
            };

            return [mapped, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "notifications"],
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_delivery":
        return { name: "cube-outline", color: "#0f766e" };
      case "driver_assigned":
        return { name: "bicycle-outline", color: "#7c3aed" };
      case "delivery_status_update":
        return { name: "navigate-outline", color: "#0284c7" };
      case "order_accepted":
        return { name: "checkmark-circle-outline", color: "#059669" };
      case "order_rejected":
        return { name: "close-circle-outline", color: "#dc2626" };
      case "restaurant_approval":
      case "admin_approval":
        return { name: "shield-checkmark-outline", color: "#059669" };
      case "restaurant_rejection":
        return { name: "alert-circle-outline", color: "#dc2626" };
      default:
        return { name: "notifications-outline", color: "#4b5563" };
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonContent}>
              <View style={[styles.skeletonLine, { width: "40%" }]} />
              <View
                style={[styles.skeletonLine, { width: "80%", marginTop: 8 }]}
              />
              <View
                style={[styles.skeletonLine, { width: "30%", marginTop: 8 }]}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  // Empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="notifications-off-outline" size={36} color="#6b7280" />
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>Check back soon for updates</Text>
    </View>
  );

  // Notification item
  const renderNotification = (n, index) => {
    const metadata = parseNotificationMetadata(n);

    const isUnread = !n.is_read;
    const orderId = metadata.order_id || metadata.orderId || null;
    const isClickable = !!orderId;
    const notifType = metadata.type || n.type;
    const icon = getNotificationIcon(notifType);
    const bodyText = n.body || n.message || "";

    return (
      <Animated.View
        key={n.id}
        style={[
          styles.notificationCard,
          isUnread
            ? styles.notificationCardUnread
            : styles.notificationCardRead,
          pageEnterStyle,
        ]}
      >
        <Pressable
          disabled={!isClickable}
          onPress={() => {
            if (!isClickable) return;
            navigation.navigate("Orders", {
              orderId,
              highlightOrderId: orderId,
            });
          }}
          style={({ pressed }) => [
            styles.notificationPressableBody,
            isClickable && pressed ? styles.notificationPressed : null,
          ]}
        >
          <View
            style={[
              styles.notificationBorder,
              isUnread ? styles.borderUnread : styles.borderRead,
            ]}
          />
          <View style={styles.notificationContent}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                isUnread
                  ? styles.iconContainerUnread
                  : styles.iconContainerRead,
              ]}
            >
              <Ionicons name={icon.name} size={22} color={icon.color} />
            </View>

            {/* Content */}
            <View style={styles.textContainer}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.notificationTitle,
                    isUnread ? styles.titleUnread : styles.titleRead,
                  ]}
                >
                  {n.title}
                </Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>

              <Text
                style={[
                  styles.notificationMessage,
                  isUnread ? styles.messageUnread : styles.messageRead,
                ]}
              >
                {bodyText}
              </Text>

              {/* Metadata Tags */}
              {orderId && (
                <View style={styles.tagsContainer}>
                  <View style={styles.tagOrder}>
                    <Text style={styles.tagOrderText}>
                      Order #{String(orderId).substring(0, 8)}
                    </Text>
                  </View>
                  {metadata.status && (
                    <View style={styles.tagStatus}>
                      <Text style={styles.tagStatusText}>
                        Status: {metadata.status}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Time */}
              <Text style={styles.timeText}>{getTimeAgo(n.created_at)}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#06C168"]}
            tintColor="#06C168"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {notifications.length > 0
              ? `You have ${notifications.length} notification${notifications.length > 1 ? "s" : ""}`
              : "Stay updated on all activities"}
          </Text>
        </View>

        <View style={styles.filterTabs}>
          {[
            { key: "all", label: "All" },
            { key: "new_delivery", label: "Orders" },
            { key: "delivery_status_update", label: "Delivery" },
          ].map((tab) => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                style={[
                  styles.filterTab,
                  active ? styles.filterTabActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    active ? styles.filterTabTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        {loading ? (
          renderSkeleton()
        ) : filteredNotifications.length === 0 ? (
          renderEmpty()
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((n, index) =>
              renderNotification(n, index),
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  filterTabActive: {
    backgroundColor: "#06C1681A",
    borderWidth: 1,
    borderColor: "#06C16840",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "#06C168",
  },

  // Skeleton
  skeletonContainer: {
    gap: 12,
  },
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 6,
  },

  // Notifications list
  notificationsList: {
    gap: 12,
  },

  // Notification card
  notificationCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  notificationPressableBody: {
    flexDirection: "row",
  },
  notificationPressed: {
    opacity: 0.86,
  },
  notificationCardUnread: {
    backgroundColor: "#EDFBF2",
  },
  notificationCardRead: {
    backgroundColor: "#fff",
  },
  notificationBorder: {
    width: 4,
  },
  borderUnread: {
    backgroundColor: "#06C168",
  },
  borderRead: {
    backgroundColor: "#e5e7eb",
  },
  notificationContent: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },

  // Icon
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerUnread: {
    backgroundColor: "#dcfce7",
  },
  iconContainerRead: {
    backgroundColor: "#f3f4f6",
  },
  iconText: {
    fontSize: 22,
  },

  // Text content
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "bold",
  },
  titleUnread: {
    color: "#111827",
  },
  titleRead: {
    color: "#374151",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#06C168",
  },
  notificationMessage: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  messageUnread: {
    color: "#1f2937",
  },
  messageRead: {
    color: "#4b5563",
  },

  // Tags
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  tagOrder: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagOrderText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4b5563",
  },
  tagStatus: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagStatusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#ea580c",
  },

  // Time
  timeText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 10,
  },
});
