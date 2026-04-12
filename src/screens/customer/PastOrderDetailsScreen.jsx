import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

const HERO_BG = "#ECFDF5";
const PAGE_BG = "#FFFFFF";
const TEXT_DARK = "#0F172A";
const TEXT_MUTED = "#4B5563";
const BORDER = "#E5E7EB";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatMoney = (value) => {
  const amount = toNumber(value, 0);
  const fixed = amount.toFixed(2);
  const [whole, decimal] = fixed.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `LKR ${withCommas}.${decimal}`;
};

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const normalizeOrder = (rawOrder, statusHint = "") => {
  if (!rawOrder || typeof rawOrder !== "object") return null;

  const source =
    rawOrder?.order || rawOrder?.data?.order || rawOrder?.data || rawOrder;

  const items = Array.isArray(source?.order_items)
    ? source.order_items
    : Array.isArray(source?.items)
      ? source.items
      : [];

  const normalizedItems = items.map((item) => {
    const quantity =
      toNumber(item?.quantity, 0) || toNumber(item?.qty, 0) || toNumber(item?.count, 0) || 1;
    const unitPrice = toNumber(
      item?.unit_price ?? item?.price ?? item?.item_price,
      0,
    );
    const lineTotal = toNumber(
      item?.line_total ?? item?.total_price ?? item?.subtotal,
      unitPrice * quantity,
    );

    return {
      name:
        item?.name ||
        item?.item_name ||
        item?.food_name ||
        item?.menu_item_name ||
        "Item",
      size: String(
        item?.size ||
          item?.selected_size ||
          item?.portion_size ||
          item?.variant_name ||
          item?.variant ||
          item?.item_size ||
          item?.food_size ||
          "",
      ).trim(),
      quantity,
      lineTotal,
    };
  });

  const itemTotal = normalizedItems.reduce(
    (sum, item) => sum + toNumber(item.lineTotal, 0),
    0,
  );

  const totalAmount =
    toNumber(source?.total_amount, NaN) ||
    toNumber(source?.total, NaN) ||
    toNumber(source?.grand_total, NaN) ||
    itemTotal;

  const normalizedStatusValue = String(
    source?.status ||
      source?.order_status ||
      source?.delivery_status ||
      rawOrder?.status ||
      rawOrder?.pastStatus ||
      statusHint ||
      "",
  )
    .trim()
    .toLowerCase();

  const cancelledAtValue =
    source?.cancelled_at ||
    source?.canceled_at ||
    source?.cancelledAt ||
    source?.rejected_at ||
    source?.rejectedAt;

  return {
    id: source?.id || source?.order_id || source?.orderId || "",
    customerName:
      source?.customer_name || source?.user_name || source?.user?.name || "Customer",
    restaurantName:
      source?.restaurant_name ||
      source?.restaurantName ||
      source?.restaurant?.name ||
      "Restaurant",
    totalAmount,
    status: normalizedStatusValue,
    createdAt: source?.created_at || source?.placed_at || source?.ordered_at,
    deliveredAt: source?.delivered_at || source?.deliveredAt,
    cancelledAt: cancelledAtValue,
    updatedAt: source?.updated_at || source?.updatedAt,
    items: normalizedItems,
  };
};

const PastOrderDetailsScreen = ({ navigation, route }) => {
  const seededOrder = route?.params?.order || null;
  const routeStatusHint = route?.params?.status || route?.params?.pastStatus || "";
  const routeOrderId =
    route?.params?.orderId ||
    seededOrder?.id ||
    seededOrder?.order_id ||
    seededOrder?.orderId;

  const [order, setOrder] = useState(() =>
    normalizeOrder(seededOrder, routeStatusHint),
  );
  const [loading, setLoading] = useState(!seededOrder && !!routeOrderId);

  useEffect(() => {
    let mounted = true;

    const fetchOrderDetails = async () => {
      if (!routeOrderId) return;

      try {
        setLoading(true);
        const response = await api.get(`/orders/${routeOrderId}`);
        if (!mounted) return;

        const nextOrder = normalizeOrder(response?.data, routeStatusHint);
        if (nextOrder) {
          setOrder((previous) => {
            // Preserve cancelled state from navigation hint when backend response is inconsistent.
            const previousStatus = String(previous?.status || "").toLowerCase();
            const previousCancelled =
              previousStatus.includes("cancel") ||
              previousStatus.includes("reject") ||
              Boolean(previous?.cancelledAt);

            if (previousCancelled) {
              return {
                ...nextOrder,
                status: "cancelled",
                cancelledAt:
                  nextOrder?.cancelledAt || previous?.cancelledAt || nextOrder?.updatedAt,
              };
            }

            return nextOrder;
          });
        }
      } catch (error) {
        console.warn("Failed to fetch order details:", error?.message || error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOrderDetails();

    return () => {
      mounted = false;
    };
  }, [routeOrderId, routeStatusHint]);

  const normalizedStatusText = String(order?.status || "").toLowerCase();
  const isCancelledStatus =
    String(routeStatusHint).toLowerCase().includes("cancel") ||
    String(routeStatusHint).toLowerCase().includes("reject") ||
    normalizedStatusText.includes("cancel") ||
    normalizedStatusText.includes("reject") ||
    normalizedStatusText === "canceled" ||
    Boolean(order?.cancelledAt);

  const normalizedStatus = isCancelledStatus ? "cancelled" : "delivered";
  const statusLabel = normalizedStatus === "cancelled" ? "Cancelled" : "Delivered";

  const displayDateSource =
    normalizedStatus === "cancelled"
      ? order?.cancelledAt || order?.updatedAt || order?.createdAt
      : order?.deliveredAt || order?.updatedAt || order?.createdAt;
  const dateLabel = formatDateLabel(displayDateSource);
  const timeLabel = formatTimeLabel(displayDateSource);

  const headlineName = useMemo(() => {
    const fullName = order?.customerName || "Customer";
    return String(fullName).trim() || "Customer";
  }, [order?.customerName]);

  if (loading && !order) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#111827" />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Order details are unavailable.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backOnlyBtn}>
            <Text style={styles.backOnlyBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="arrow-back" size={26} color="#111111" />
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Thanks for ordering.</Text>
          <Text style={styles.heroSubtitle}>
            Here's your receipt for {order.restaurantName}.
          </Text>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  normalizedStatus === "cancelled"
                    ? "rgba(220,38,38,0.12)"
                    : "rgba(5,150,105,0.12)",
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                {
                  color:
                    normalizedStatus === "cancelled" ? "#B91C1C" : "#047857",
                },
              ]}
            >
              {statusLabel}
            </Text>
          </View>

          <View style={styles.dateRow}>
            {dateLabel ? <Text style={styles.dateText}>{dateLabel}</Text> : null}
            {dateLabel && timeLabel ? <Text style={styles.dot}>•</Text> : null}
            {timeLabel ? <Text style={styles.dateText}>{timeLabel}</Text> : null}
          </View>

          <View style={styles.heroCurve} />
        </View>

        <View style={styles.totalRowWrap}>
          <Text
            style={styles.totalLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Total
          </Text>
          <Text
            style={styles.totalValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {formatMoney(order.totalAmount)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsSection}>
          {order.items.length > 0 ? (
            order.items.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={[
                  styles.itemRow,
                  index === order.items.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                </View>
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSize}>
                    Size: {item.size || "Not specified"}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noItemsText}>No item details available for this order.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 15,
    color: "#DC2626",
    marginBottom: 14,
    fontWeight: "600",
  },
  backOnlyBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  backOnlyBtnText: {
    color: TEXT_DARK,
    fontWeight: "700",
    fontSize: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 100,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    color: "#111111",
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 30,
  },
  hero: {
    backgroundColor: HERO_BG,
    minHeight: 300,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 44,
    overflow: "hidden",
  },
  heroTitle: {
    fontSize: SCREEN_WIDTH < 380 ? 46 : 52,
    lineHeight: SCREEN_WIDTH < 380 ? 52 : 58,
    fontWeight: "500",
    color: "#0B0B0B",
    letterSpacing: -1.2,
    maxWidth: "95%",
  },
  heroSubtitle: {
    marginTop: 20,
    fontSize: 18,
    lineHeight: 26,
    color: "#0F172A",
    maxWidth: "92%",
  },
  dateRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  statusPill: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  dateText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },
  dot: {
    marginHorizontal: 8,
    color: "#334155",
    fontWeight: "700",
  },
  heroCurve: {
    position: "absolute",
    right: -120,
    bottom: -120,
    width: 320,
    height: 210,
    borderRadius: 140,
    backgroundColor: PAGE_BG,
  },
  totalRowWrap: {
    marginTop: 28,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 36,
    fontWeight: "500",
    letterSpacing: 1,
    color: "#09090B",
    marginRight: 10,
  },
  totalValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 36,
    fontWeight: "500",
    letterSpacing: -1,
    color: "#09090B",
  },
  divider: {
    marginTop: 20,
    marginHorizontal: 22,
    height: 1,
    backgroundColor: BORDER,
  },
  itemsSection: {
    marginTop: 20,
    paddingHorizontal: 22,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  qtyBadge: {
    width: 40,
    height: 40,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  qtyText: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  itemName: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  itemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemSize: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  noItemsText: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: "500",
  },
});

export default PastOrderDetailsScreen;
