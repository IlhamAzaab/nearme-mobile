import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useNotifications } from "../../app/providers/NotificationProvider";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";

// ─── Black bell icon (SVG) ───
const BellIcon = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#111827" stroke="none">
    <Path d="M12 2a7 7 0 00-7 7c0 3.53-1.13 5.85-2.15 7.3A1 1 0 003.72 18h16.56a1 1 0 00.87-1.7C20.13 14.85 19 12.53 19 9a7 7 0 00-7-7zM9.17 21a3 3 0 005.66 0H9.17z" />
  </Svg>
);

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60) return "Just now";

  const minutes = Math.floor(diff / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }

  const hours = Math.floor(diff / 3600);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(diff / 86400);
  if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { markAllReadForCustomer } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        setLoading(true);
        const list = await markAllReadForCustomer();
        if (active) {
          setNotifications(Array.isArray(list) ? list : []);
          setLoading(false);
        }
      };

      run();

      return () => {
        active = false;
      };
    }, [markAllReadForCustomer]),
  );

  const markSingleAsRead = async (notificationId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(
        `${API_BASE_URL}/customer/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
    } catch (error) {
      console.log("Error marking notification as read:", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={["top"]}>
        <View style={st.header}>
          <Pressable onPress={() => navigation.goBack()} style={st.backBtn}>
            <Text style={st.backIcon}>‹</Text>
          </Pressable>
          <Text style={st.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={st.skeletonCard}>
              <SkeletonBlock width={46} height={46} borderRadius={14} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="55%" height={14} borderRadius={6} />
                <SkeletonBlock width="85%" height={12} borderRadius={6} />
                <SkeletonBlock width="25%" height={10} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backIcon}>‹</Text>
        </Pressable>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>Notifications</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isUnread = !item.is_read;
          return (
            <Pressable
              onPress={() => markSingleAsRead(item.id)}
              style={({ pressed }) => [
                st.card,
                isUnread && st.cardUnread,
                pressed && st.cardPressed,
              ]}
            >
              {/* Bell Icon */}
              <View style={st.iconWrap}>
                <BellIcon size={22} />
              </View>

              {/* Content */}
              <View style={st.content}>
                <View style={st.titleRow}>
                  <Text style={[st.title, isUnread && st.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={st.time}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={st.message} numberOfLines={2}>
                  {item.message}
                </Text>
              </View>

              {/* Unread indicator */}
              {isUnread && <View style={st.unreadDot} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyCircle}>
              <Text style={st.emptyIcon}>📭</Text>
            </View>
            <Text style={st.emptyTitle}>All caught up!</Text>
            <Text style={st.emptySubtext}>
              You don't have any notifications yet.{"\n"}We'll let you know when something arrives.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: "#111827",
    marginTop: -2,
    fontWeight: "600",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  badge: {
    backgroundColor: "#06C168",
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },

  /* ── List ── */
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  /* ── Card ── */
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardUnread: {
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },

  /* ── Icon ── */
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Content ── */
  content: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
    marginRight: 8,
  },
  titleUnread: {
    fontWeight: "800",
    color: "#111827",
  },
  message: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },

  /* ── Unread dot ── */
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#06C168",
    marginTop: 6,
    marginLeft: 4,
  },

  /* ── Empty state ── */
  emptyWrap: {
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  /* ── Skeleton ── */
  skeletonCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
});
