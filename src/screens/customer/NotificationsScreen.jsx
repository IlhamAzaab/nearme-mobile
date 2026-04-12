import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useNotifications } from "../../app/providers/NotificationProvider";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";

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

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getNotificationPayload(item) {
  const candidates = [
    item?.data,
    item?.metadata,
    item?.meta,
    item?.payload,
    item?.extra_data,
    item?.details,
  ];
  for (const candidate of candidates) {
    const parsed = parseMaybeJson(candidate);
    if (parsed && typeof parsed === "object") return parsed;
  }
  return {};
}

function extractOrderId(item, payload = {}) {
  const directOrderId =
    item?.orderId ||
    item?.order_id ||
    payload?.orderId ||
    payload?.order_id ||
    payload?.orderID ||
    payload?.id;

  if (directOrderId) return String(directOrderId);

  const rawText = `${item?.title || ""} ${item?.message || ""}`;
  const orderNumberMatch = rawText.match(/order\s*#?\s*([a-zA-Z0-9-]{4,})/i);
  if (orderNumberMatch?.[1]) return String(orderNumberMatch[1]);

  return null;
}

function humanizeStatus(status) {
  if (!status) return "-";
  return String(status)
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getStatusScreenName(status) {
  const normalized = String(status || "").toLowerCase().trim();

  switch (normalized) {
    case "placed":
      return "PlacingOrder";
    case "pending":
    case "received":
    case "preparing":
    case "ready":
      return "OrderReceived";
    case "accepted":
    case "driver_accepted":
    case "driver_assigned":
      return "DriverAccepted";
    case "picked_up":
      return "OrderPickedUp";
    case "on_the_way":
      return "OrderOnTheWay";
    case "delivered":
      return "OrderDelivered";
    default:
      return "OrderReceived";
  }
}

function buildItemsFromOrder(order) {
  const items = order?.order_items || order?.items || [];
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const qty = Number(item?.quantity || 1);
      const name = item?.food_name || item?.name || item?.item_name || "Item";
      const size =
        item?.size && String(item.size).toLowerCase() !== "regular"
          ? ` (${item.size})`
          : "";
      return `${qty}x ${name}${size}`;
    })
    .filter(Boolean);
}

function buildItemsFromPayload(payload = {}) {
  if (payload?.itemsSummary && typeof payload.itemsSummary === "string") {
    return payload.itemsSummary
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (Array.isArray(payload?.items)) {
    return payload.items
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        const qty = Number(item?.quantity || 1);
        const name = item?.food_name || item?.name || item?.item_name || "Item";
        const size =
          item?.size && String(item.size).toLowerCase() !== "regular"
            ? ` (${item.size})`
            : "";
        return `${qty}x ${name}${size}`;
      })
      .filter(Boolean);
  }
  return [];
}

export default function NotificationsScreen({ navigation, route }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const {
    notifications: inAppNotifications,
    markAsRead,
    unreadCount,
    refreshUnreadCount,
    fetchCustomerNotifications,
  } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        setLoading(true);
        const list = await fetchCustomerNotifications();
        if (active) {
          setNotifications(Array.isArray(list) ? list : []);
          refreshUnreadCount({ force: true });
          setLoading(false);
        }
      };

      run();

      return () => {
        active = false;
      };
    }, [fetchCustomerNotifications, refreshUnreadCount]),
  );

  const markSingleAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) =>
        String(n.id) === String(notificationId) ? { ...n, is_read: true } : n,
      ),
    );

    try {
      const token = (await getAccessToken()) || (await AsyncStorage.getItem("token"));
      if (!token) {
        refreshUnreadCount({ force: true });
        return;
      }
      await fetch(
        `${API_BASE_URL}/customer/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (error) {
      console.log("Error marking notification as read:", error);
    } finally {
      refreshUnreadCount({ force: true });
    }
  }, [markAsRead, refreshUnreadCount]);

  const fetchOrderDetails = useCallback(async (orderId) => {
    const token = (await getAccessToken()) || (await AsyncStorage.getItem("token"));
    if (!token || !orderId) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      return data?.order || data;
    } catch {
      return null;
    }
  }, []);

  const openNotificationDetails = useCallback(
    async (item) => {
      const payload = getNotificationPayload(item);
      const orderId = extractOrderId(item, payload);

      setSelectedNotification({
        item,
        payload,
        orderId,
        order: null,
      });

      if (item?.id && !item?._transient && !item?.is_read) {
        await markSingleAsRead(item.id);
      }

      if (!orderId) return;

      setDetailsLoading(true);
      const order = await fetchOrderDetails(orderId);
      setSelectedNotification((prev) =>
        prev
          ? {
              ...prev,
              order,
            }
          : prev,
      );
      setDetailsLoading(false);
    },
    [fetchOrderDetails, markSingleAsRead],
  );

  const closeNotificationDetails = useCallback(() => {
    setSelectedNotification(null);
    setDetailsLoading(false);
  }, []);

  useEffect(() => {
    const shouldOpenFromPush = !!route?.params?.openFromPush;
    const incoming = route?.params?.notification;
    if (!shouldOpenFromPush || !incoming) return;

    const incomingId = incoming?.id ? String(incoming.id) : "";
    const selectedId = selectedNotification?.item?.id
      ? String(selectedNotification.item.id)
      : "";
    if (incomingId && incomingId === selectedId) {
      return;
    }

    openNotificationDetails(incoming);
    navigation.setParams({
      openFromPush: false,
      notification: null,
    });
  }, [
    navigation,
    openNotificationDetails,
    route?.params?.notification,
    route?.params?.openFromPush,
    selectedNotification?.item?.id,
  ]);

  const mergedNotifications = useMemo(() => {
    const byId = new Map();
    const merged = [
      ...(Array.isArray(notifications) ? notifications : []),
      ...(Array.isArray(inAppNotifications) ? inAppNotifications : []),
    ];

    merged.forEach((n) => {
      if (!n) return;
      const key = String(
        n.id ||
          n.notification_id ||
          n.notificationId ||
          `${n.title || ""}-${n.message || ""}-${n.created_at || n.createdAt || ""}`,
      );

      if (!byId.has(key)) {
        byId.set(key, { ...n, id: key });
        return;
      }

      const existing = byId.get(key);
      byId.set(key, {
        ...existing,
        ...n,
        id: key,
        // Keep unread if at least one source says unread.
        is_read: Boolean(existing?.is_read && n?.is_read),
      });
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = new Date(a?.created_at || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.created_at || b?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [inAppNotifications, notifications]);

  const unreadInList = mergedNotifications.filter((n) => !n.is_read).length;
  const effectiveUnreadCount = Math.max(unreadCount || 0, unreadInList);

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
        {effectiveUnreadCount > 0 ? (
          <View style={st.badge}>
            <Text style={st.badgeText}>
              {effectiveUnreadCount > 99 ? "99+" : effectiveUnreadCount}
            </Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <FlatList
        data={mergedNotifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          effectiveUnreadCount > 0 ? (
            <View style={st.listIntroCard}>
              <Text style={st.listIntroTitle}>
                {effectiveUnreadCount} new notification{effectiveUnreadCount > 1 ? "s" : ""}
              </Text>
              <Text style={st.listIntroSub}>
                Tap any item to view full report and details.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isUnread = !item.is_read;
          return (
            <Pressable
              onPress={() => openNotificationDetails(item)}
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

      <Modal
        visible={!!selectedNotification}
        transparent
        animationType="fade"
        onRequestClose={closeNotificationDetails}
      >
        <View style={st.modalBackdrop}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle} numberOfLines={2}>
              {selectedNotification?.item?.title || "Notification Details"}
            </Text>

            <View style={st.reportMessageBox}>
              <Text style={st.reportMessageLabel}>MESSAGE</Text>
              <Text style={st.reportMessageText}>
                {selectedNotification?.item?.message || "No message available."}
              </Text>
            </View>

            <View style={st.metaBox}>
              <View style={st.reportPill}>
                <Text style={st.reportPillText}>Notification Report</Text>
              </View>

              <View style={st.reportRow}>
                <Text style={st.reportLabel}>Received</Text>
                <Text style={st.reportValue}>
                  {selectedNotification?.item?.created_at
                    ? new Date(selectedNotification.item.created_at).toLocaleString()
                    : "-"}
                </Text>
              </View>

              <View style={st.reportDivider} />

              <View style={st.reportRow}>
                <Text style={st.reportLabel}>Type</Text>
                <Text style={st.reportValue}>
                  {humanizeStatus(
                    selectedNotification?.item?.type ||
                      selectedNotification?.payload?.type ||
                      "general",
                  )}
                </Text>
              </View>

              <View style={st.reportDivider} />

              <View style={st.reportRow}>
                <Text style={st.reportLabel}>Status</Text>
                <Text style={st.reportValue}>
                  {humanizeStatus(
                    selectedNotification?.order?.status ||
                      selectedNotification?.payload?.status ||
                      selectedNotification?.item?.status,
                  )}
                </Text>
              </View>

              {selectedNotification?.orderId ? (
                <>
                  <View style={st.reportDivider} />
                  <View style={st.reportRow}>
                    <Text style={st.reportLabel}>Order ID</Text>
                    <Text style={st.reportValue}>{selectedNotification.orderId}</Text>
                  </View>
                </>
              ) : null}

              <View style={st.reportDivider} />

              <View style={st.reportRow}>
                <Text style={st.reportLabel}>Driver</Text>
                <Text style={st.reportValue}>
                  {selectedNotification?.order?.driver_name ||
                    selectedNotification?.order?.driverName ||
                    selectedNotification?.order?.driver?.name ||
                    selectedNotification?.payload?.driverName ||
                    selectedNotification?.payload?.driver_name ||
                    "Not assigned yet"}
                </Text>
              </View>

              {selectedNotification?.order?.total_amount != null ? (
                <>
                  <View style={st.reportDivider} />
                  <View style={st.reportRow}>
                    <Text style={st.reportLabel}>Order Total</Text>
                    <Text style={st.reportValueStrong}>
                      LKR {Number(selectedNotification.order.total_amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {detailsLoading ? (
              <View style={st.loadingWrap}>
                <ActivityIndicator size="small" color="#06C168" />
                <Text style={st.loadingText}>Loading order details...</Text>
              </View>
            ) : null}

            {(() => {
              const orderItems = buildItemsFromOrder(selectedNotification?.order);
              const payloadItems = buildItemsFromPayload(
                selectedNotification?.payload,
              );
              const itemsToShow = orderItems.length > 0 ? orderItems : payloadItems;

              if (itemsToShow.length === 0) return null;

              return (
                <View style={st.itemsBox}>
                  <Text style={st.itemsHeader}>Items</Text>
                  {itemsToShow.map((line, idx) => (
                    <Text key={`${line}-${idx}`} style={st.itemLine}>
                      • {line}
                    </Text>
                  ))}
                </View>
              );
            })()}

            <View style={st.modalActions}>
              {selectedNotification?.orderId ? (
                <Pressable
                  style={({ pressed }) => [
                    st.trackBtn,
                    pressed && st.actionPressed,
                  ]}
                  onPress={() => {
                    const orderId = selectedNotification?.orderId;
                    const status =
                      selectedNotification?.order?.effective_status ||
                      selectedNotification?.order?.delivery_status ||
                      selectedNotification?.order?.status ||
                      selectedNotification?.payload?.effective_status ||
                      selectedNotification?.payload?.delivery_status ||
                      selectedNotification?.payload?.status ||
                      selectedNotification?.item?.status;
                    const target = getStatusScreenName(status);
                    closeNotificationDetails();
                    if (orderId) {
                      navigation.navigate(target, {
                        orderId,
                        status,
                        statusScreenMode: true,
                      });
                    }
                  }}
                >
                  <Text style={st.trackBtnText}>Track Order</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  st.closeBtn,
                  pressed && st.actionPressed,
                ]}
                onPress={closeNotificationDetails}
              >
                <Text style={st.closeBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  listIntroCard: {
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  listIntroTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
  },
  listIntroSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#047857",
    fontWeight: "500",
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.42)",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  modalMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
  },
  reportMessageBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reportMessageLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reportMessageText: {
    fontSize: 14,
    color: "#065F46",
    lineHeight: 20,
    fontWeight: "600",
  },
  metaBox: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    gap: 3,
  },
  reportPill: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  reportPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
    letterSpacing: 0.4,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  reportLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  reportValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  reportValueStrong: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
    color: "#06C168",
  },
  reportDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  metaLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metaValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  loadingWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
  },
  itemsBox: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
    marginBottom: 6,
  },
  itemLine: {
    fontSize: 13,
    color: "#065F46",
    lineHeight: 19,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  trackBtn: {
    backgroundColor: "#06C168",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  trackBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  closeBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  closeBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  actionPressed: {
    opacity: 0.82,
  },
});
