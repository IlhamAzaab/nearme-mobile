import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../services/supabaseClient";
import { API_URL } from "../../config/env";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminId, setAdminId] = useState(null);

  // Animation
  const fadeAnim = useState(new Animated.Value(0))[0];

  const markAllAsRead = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/admin/notifications/mark-all-read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error("Mark all read error:", e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNotifications(data.notifications || []);

      // Mark all as read after fetching
      await markAllAsRead();

      // Update local state to reflect read status
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          is_read: true,
          read_at: new Date().toISOString(),
        }))
      );
    } catch (e) {
      console.error("Fetch error:", e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [markAllAsRead]);

  useEffect(() => {
    const init = async () => {
      const userId = await AsyncStorage.getItem("userId");
      setAdminId(userId);
      await fetchNotifications();

      // Start animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    };

    init();
  }, [fetchNotifications, fadeAnim]);

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
          table: "notifications",
          filter: `recipient_id=eq.${adminId}`,
        },
        (payload) => {
          console.log("New notification:", payload);
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "new_delivery":
        return "📦";
      case "driver_assigned":
        return "🛵";
      case "delivery_status_update":
        return "📍";
      case "order_accepted":
        return "✅";
      case "order_rejected":
        return "❌";
      default:
        return "📢";
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
              <View style={[styles.skeletonLine, { width: "80%", marginTop: 8 }]} />
              <View style={[styles.skeletonLine, { width: "30%", marginTop: 8 }]} />
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
        <Text style={styles.emptyIcon}>🔔</Text>
      </View>
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>Check back soon for updates</Text>
    </View>
  );

  // Notification item
  const renderNotification = (n, index) => {
    let metadata = {};
    try {
      metadata = n.metadata ? JSON.parse(n.metadata) : {};
    } catch (e) {
      metadata = {};
    }

    const isUnread = !n.is_read;

    return (
      <Animated.View
        key={n.id}
        style={[
          styles.notificationCard,
          isUnread ? styles.notificationCardUnread : styles.notificationCardRead,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
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
              isUnread ? styles.iconContainerUnread : styles.iconContainerRead,
            ]}
          >
            <Text style={styles.iconText}>{getNotificationIcon(n.type)}</Text>
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
              {n.message}
            </Text>

            {/* Metadata Tags */}
            {metadata.order_id && (
              <View style={styles.tagsContainer}>
                <View style={styles.tagOrder}>
                  <Text style={styles.tagOrderText}>
                    Order #{metadata.order_id.substring(0, 8)}
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
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#22c55e"]}
            tintColor="#22c55e"
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

        {/* Content */}
        {loading ? (
          renderSkeleton()
        ) : notifications.length === 0 ? (
          renderEmpty()
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((n, index) => renderNotification(n, index))}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    flexDirection: "row",
    marginBottom: 12,
  },
  notificationCardUnread: {
    backgroundColor: "#f0fdf4",
  },
  notificationCardRead: {
    backgroundColor: "#fff",
  },
  notificationBorder: {
    width: 4,
  },
  borderUnread: {
    backgroundColor: "#22c55e",
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
    backgroundColor: "#22c55e",
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
