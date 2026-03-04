import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";

export default function PendingDeliveriesScreen() {
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipInputs, setTipInputs] = useState({});
  const [submittingTip, setSubmittingTip] = useState({});
  const [successMap, setSuccessMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_URL}/manager/pending-deliveries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending deliveries:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 30000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  const handleTipSubmit = async (deliveryId) => {
    const tipValue = parseFloat(tipInputs[deliveryId]);
    if (isNaN(tipValue) || tipValue < 0) return;
    setSubmittingTip((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/manager/pending-deliveries/${deliveryId}/tip`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tip_amount: tipValue }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setSuccessMap((prev) => ({ ...prev, [deliveryId]: true }));
        setTimeout(
          () => setSuccessMap((prev) => ({ ...prev, [deliveryId]: false })),
          2000,
        );
        fetchDeliveries();
        setTipInputs((prev) => ({ ...prev, [deliveryId]: "" }));
      }
    } catch (err) {
      console.error("Failed to update tip:", err);
    } finally {
      setSubmittingTip((prev) => ({ ...prev, [deliveryId]: false }));
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getUrgencyColors = (minutes) => {
    if (minutes >= 30)
      return {
        bg: "#FEE2E2",
        text: "#B91C1C",
        dot: "#EF4444",
        border: "#FECACA",
      };
    if (minutes >= 20)
      return {
        bg: "#FFEDD5",
        text: "#C2410C",
        dot: "#F97316",
        border: "#FED7AA",
      };
    return {
      bg: "#FEF3C7",
      text: "#A16207",
      dot: "#F59E0B",
      border: "#FDE68A",
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDeliveries();
            }}
            colors={["#059669"]}
          />
        }
      >
        {/* Alert Banner */}
        {deliveries.length > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIcon}>
              <Ionicons name="warning-outline" size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {deliveries.length} delivery
                {deliveries.length !== 1 ? "ies" : ""} waiting for drivers
              </Text>
              <Text style={styles.alertSub}>
                Add tips to incentivize drivers to accept these orders
              </Text>
            </View>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{deliveries.length}</Text>
            </View>
          </View>
        )}

        {/* Summary Stats */}
        {deliveries.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>PENDING</Text>
              <Text style={styles.statBoxValue}>{deliveries.length}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>TIPPED</Text>
              <Text style={[styles.statBoxValue, { color: "#13ECB9" }]}>
                {
                  deliveries.filter((d) => parseFloat(d.tip_amount || 0) > 0)
                    .length
                }
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>AVG WAIT</Text>
              <Text style={[styles.statBoxValue, { color: "#EA580C" }]}>
                {formatTime(
                  Math.round(
                    deliveries.reduce((sum, d) => sum + d.waiting_minutes, 0) /
                      deliveries.length,
                  ),
                )}
              </Text>
            </View>
          </View>
        )}

        {/* Empty State */}
        {deliveries.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#13ECB9" />
            </View>
            <Text style={styles.emptyTitle}>All deliveries on track</Text>
            <Text style={styles.emptyText}>
              No deliveries are waiting for drivers longer than 10 minutes. Your
              customers are being served promptly!
            </Text>
            <Text style={styles.emptyRefresh}>
              Auto-refreshes every 30 seconds
            </Text>
          </View>
        )}

        {/* Delivery Cards */}
        {deliveries.map((d) => {
          const order = d.orders;
          if (!order) return null;
          const urgency = getUrgencyColors(d.waiting_minutes);
          const currentTip = parseFloat(d.tip_amount || 0);
          const hasTip = currentTip > 0;
          const isExpanded = expandedId === d.id;
          const items = order.order_items || [];

          return (
            <View
              key={d.id}
              style={[
                styles.deliveryCard,
                hasTip && {
                  borderColor: "#13ECB9",
                  shadowColor: "#13ECB9",
                  shadowOpacity: 0.15,
                },
              ]}
            >
              {/* Header */}
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.urgencyIcon,
                        { backgroundColor: urgency.bg },
                      ]}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={18}
                        color={urgency.text}
                      />
                      <View
                        style={[
                          styles.urgencyDot,
                          { backgroundColor: urgency.dot },
                        ]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.orderNumRow}>
                        <Text style={styles.orderNum}>
                          #{order.order_number}
                        </Text>
                        <View
                          style={[
                            styles.urgencyBadge,
                            { backgroundColor: urgency.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.urgencyBadgeText,
                              { color: urgency.text },
                            ]}
                          >
                            {formatTime(d.waiting_minutes)} waiting
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.restaurantName} numberOfLines={1}>
                        {order.restaurant_name}
                      </Text>
                    </View>
                  </View>
                  {hasTip && (
                    <View style={styles.tipBadge}>
                      <Text style={styles.tipBadgeText}>
                        Tip Rs.{currentTip.toFixed(0)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Pending Time Banner */}
                <View
                  style={[
                    styles.pendingBanner,
                    {
                      backgroundColor: urgency.bg,
                      borderColor: urgency.border,
                    },
                  ]}
                >
                  <View style={styles.pendingBannerLeft}>
                    <Ionicons
                      name="hourglass-outline"
                      size={16}
                      color={urgency.text}
                    />
                    <View>
                      <Text
                        style={[styles.pendingText, { color: urgency.text }]}
                      >
                        Pending for {formatTime(d.waiting_minutes)}
                      </Text>
                      <Text style={styles.pendingSince}>
                        Since{" "}
                        {order.accepted_at
                          ? new Date(order.accepted_at).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )
                          : "—"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pendingBannerRight}>
                    <Text style={[styles.pendingMins, { color: urgency.text }]}>
                      {d.waiting_minutes}
                    </Text>
                    <Text
                      style={[styles.pendingMinsLabel, { color: urgency.text }]}
                    >
                      MINUTES
                    </Text>
                  </View>
                </View>

                {/* Key Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>TOTAL</Text>
                    <Text style={styles.infoValue}>
                      Rs.{parseFloat(order.total_amount || 0).toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>DISTANCE</Text>
                    <Text style={styles.infoValue}>
                      {parseFloat(order.distance_km || 0).toFixed(1)} km
                    </Text>
                  </View>
                  <View style={[styles.infoBox, styles.infoBoxEarning]}>
                    <Text style={[styles.infoLabel, { color: "#059669" }]}>
                      EARNING
                    </Text>
                    <Text style={[styles.infoValue, { color: "#047857" }]}>
                      Rs.{(d.manager_earning || 0).toFixed(0)}
                    </Text>
                  </View>
                </View>

                {/* Food Items Preview */}
                <View style={styles.foodPreview}>
                  <Ionicons
                    name="restaurant-outline"
                    size={14}
                    color="#618980"
                  />
                  <Text style={styles.foodText} numberOfLines={1}>
                    {items.length > 0
                      ? items
                          .map((item) => `${item.quantity}× ${item.food_name}`)
                          .join(", ")
                      : "No items"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : d.id)}
                  >
                    <Text style={styles.detailsBtn}>
                      {isExpanded ? "Less" : "Details"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tip Input */}
                <View style={styles.tipInputRow}>
                  <View style={styles.tipInputWrap}>
                    <Text style={styles.tipPrefix}>Rs.</Text>
                    <TextInput
                      style={styles.tipInput}
                      keyboardType="numeric"
                      placeholder={hasTip ? currentTip.toFixed(0) : "Enter tip"}
                      placeholderTextColor="rgba(97,137,128,0.4)"
                      value={tipInputs[d.id] || ""}
                      onChangeText={(text) =>
                        setTipInputs((prev) => ({ ...prev, [d.id]: text }))
                      }
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.tipSubmitBtn,
                      successMap[d.id] && { backgroundColor: "#22C55E" },
                      (!tipInputs[d.id] || parseFloat(tipInputs[d.id]) < 0) && {
                        opacity: 0.4,
                      },
                    ]}
                    disabled={
                      submittingTip[d.id] ||
                      !tipInputs[d.id] ||
                      parseFloat(tipInputs[d.id]) < 0
                    }
                    onPress={() => handleTipSubmit(d.id)}
                  >
                    {submittingTip[d.id] ? (
                      <ActivityIndicator size="small" color="#111816" />
                    ) : successMap[d.id] ? (
                      <View style={styles.tipBtnContent}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={[styles.tipBtnText, { color: "#fff" }]}>
                          Done
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.tipBtnContent}>
                        <Ionicons
                          name="heart-outline"
                          size={14}
                          color="#111816"
                        />
                        <Text style={styles.tipBtnText}>
                          {hasTip ? "Update" : "Add Tip"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Quick Tip Presets */}
                <View style={styles.presetRow}>
                  <Text style={styles.presetLabel}>Quick:</Text>
                  {[20, 30, 50, 75, 100].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={styles.presetBtn}
                      onPress={() =>
                        setTipInputs((prev) => ({
                          ...prev,
                          [d.id]: val.toString(),
                        }))
                      }
                    >
                      <Text style={styles.presetBtnText}>Rs.{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Expanded Details */}
              {isExpanded && (
                <View style={styles.expandedSection}>
                  {/* Restaurant & Customer */}
                  <View style={styles.expandedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expandedLabel}>RESTAURANT</Text>
                      <Text style={styles.expandedName}>
                        {order.restaurant_name}
                      </Text>
                      <Text style={styles.expandedAddr} numberOfLines={2}>
                        {order.restaurant_address}
                      </Text>
                      {order.restaurant_phone && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${order.restaurant_phone}`)
                          }
                        >
                          <Text style={styles.phoneLink}>
                            {order.restaurant_phone}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expandedLabel}>CUSTOMER</Text>
                      <Text style={styles.expandedName}>
                        {order.customer_name}
                      </Text>
                      <Text style={styles.expandedAddr} numberOfLines={2}>
                        {order.delivery_address}
                      </Text>
                      {order.customer_phone && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${order.customer_phone}`)
                          }
                        >
                          <Text style={styles.phoneLink}>
                            {order.customer_phone}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Food Items */}
                  <Text style={styles.expandedLabel}>FOOD ITEMS</Text>
                  <View style={styles.itemsList}>
                    {items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        {item.food_image_url ? (
                          <Image
                            source={{ uri: item.food_image_url }}
                            style={styles.itemImage}
                          />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <Ionicons
                              name="fast-food-outline"
                              size={16}
                              color="#618980"
                            />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.food_name}
                          </Text>
                          <Text style={styles.itemMeta}>
                            {item.size && item.size !== "regular"
                              ? `${item.size} · `
                              : ""}
                            Qty: {item.quantity}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          Rs.{parseFloat(item.total_price || 0).toFixed(0)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Financial Breakdown */}
                  <Text style={styles.expandedLabel}>FINANCIAL BREAKDOWN</Text>
                  <View style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownKey}>Food Subtotal</Text>
                      <Text style={styles.breakdownVal}>
                        Rs.{parseFloat(order.subtotal || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownKey}>Delivery Fee</Text>
                      <Text style={styles.breakdownVal}>
                        Rs.{parseFloat(order.delivery_fee || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownKey}>Service Fee</Text>
                      <Text style={styles.breakdownVal}>
                        Rs.{parseFloat(order.service_fee || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownKeyBold}>
                        Total Collected
                      </Text>
                      <Text style={styles.breakdownValBold}>
                        Rs.{parseFloat(order.total_amount || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownKey, { color: "#D97706" }]}>
                        Restaurant Payout
                      </Text>
                      <Text style={[styles.breakdownVal, { color: "#D97706" }]}>
                        − Rs.{parseFloat(order.admin_subtotal || 0).toFixed(0)}
                      </Text>
                    </View>
                    {currentTip > 0 && (
                      <View style={styles.breakdownRow}>
                        <Text
                          style={[styles.breakdownKey, { color: "#13ECB9" }]}
                        >
                          Driver Tip (Your Cost)
                        </Text>
                        <Text
                          style={[styles.breakdownVal, { color: "#13ECB9" }]}
                        >
                          − Rs.{currentTip.toFixed(0)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text
                        style={[styles.breakdownKeyBold, { color: "#047857" }]}
                      >
                        Your Earning
                      </Text>
                      <Text
                        style={[styles.breakdownValBold, { color: "#047857" }]}
                      >
                        Rs.{(d.manager_earning || 0).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  {/* Distance & Timing */}
                  <View style={styles.infoGrid}>
                    <View style={[styles.infoBox, { backgroundColor: "#fff" }]}>
                      <Ionicons
                        name="navigate-outline"
                        size={18}
                        color="#618980"
                      />
                      <Text style={styles.infoValue}>
                        {parseFloat(order.distance_km || 0).toFixed(1)} km
                      </Text>
                      <Text style={styles.infoLabel}>DISTANCE</Text>
                    </View>
                    <View style={[styles.infoBox, { backgroundColor: "#fff" }]}>
                      <Ionicons name="time-outline" size={18} color="#618980" />
                      <Text style={styles.infoValue}>
                        {order.estimated_duration_min || "—"} min
                      </Text>
                      <Text style={styles.infoLabel}>EST. ETA</Text>
                    </View>
                    <View style={[styles.infoBox, { backgroundColor: "#fff" }]}>
                      <Ionicons name="card-outline" size={18} color="#618980" />
                      <Text style={styles.infoValue}>
                        {order.payment_method === "cash" ? "Cash" : "Card"}
                      </Text>
                      <Text style={styles.infoLabel}>PAYMENT</Text>
                    </View>
                  </View>

                  {/* Timestamps */}
                  <View style={styles.timestampCard}>
                    <Ionicons name="time-outline" size={14} color="#618980" />
                    <Text style={styles.timestampText}>
                      Placed:{" "}
                      {order.placed_at
                        ? new Date(order.placed_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            },
                          )
                        : "—"}{" "}
                      · Accepted:{" "}
                      {order.accepted_at
                        ? new Date(order.accepted_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            },
                          )
                        : "—"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 16, paddingBottom: 30 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Alert
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  alertTitle: { fontSize: 13, fontWeight: "700", color: "#991B1B" },
  alertSub: { fontSize: 11, color: "#DC2626", marginTop: 2 },
  alertBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  alertBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    padding: 12,
    alignItems: "center",
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#618980",
    letterSpacing: 1,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111816",
    marginTop: 4,
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(19,236,185,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#618980",
    textAlign: "center",
    maxWidth: 280,
  },
  emptyRefresh: { fontSize: 11, color: "rgba(97,137,128,0.6)", marginTop: 16 },

  // Delivery Card
  deliveryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: { padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  urgencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  urgencyDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  orderNumRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderNum: { fontSize: 13, fontWeight: "800", color: "#111816" },
  urgencyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  urgencyBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  restaurantName: { fontSize: 11, color: "#618980", marginTop: 2 },

  tipBadge: {
    backgroundColor: "rgba(19,236,185,0.1)",
    borderWidth: 1,
    borderColor: "rgba(19,236,185,0.3)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipBadgeText: { fontSize: 11, fontWeight: "700", color: "#065F46" },

  // Pending Banner
  pendingBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
  },
  pendingBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingText: { fontSize: 11, fontWeight: "700" },
  pendingSince: { fontSize: 9, color: "#618980", marginTop: 2 },
  pendingBannerRight: { alignItems: "flex-end" },
  pendingMins: { fontSize: 18, fontWeight: "800" },
  pendingMinsLabel: { fontSize: 8, fontWeight: "700", opacity: 0.7 },

  // Info Grid
  infoGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  infoBox: {
    flex: 1,
    backgroundColor: "#F6F8F8",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  infoBoxEarning: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#618980",
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
    marginTop: 2,
  },

  // Food Preview
  foodPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  foodText: { flex: 1, fontSize: 11, color: "#618980" },
  detailsBtn: { fontSize: 11, fontWeight: "600", color: "#13ECB9" },

  // Tip Input
  tipInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  tipInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F8F8",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  tipPrefix: {
    fontSize: 12,
    color: "#618980",
    fontWeight: "500",
    marginRight: 4,
  },
  tipInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
  },
  tipSubmitBtn: {
    backgroundColor: "#13ECB9",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tipBtnContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipBtnText: { fontSize: 12, fontWeight: "700", color: "#111816" },

  // Presets
  presetRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  presetLabel: { fontSize: 9, color: "#618980", fontWeight: "500" },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F6F8F8",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    borderRadius: 8,
  },
  presetBtnText: { fontSize: 9, fontWeight: "700", color: "#618980" },

  // Expanded
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: "#DBE6E3",
    backgroundColor: "rgba(246,248,248,0.5)",
    padding: 16,
    gap: 12,
  },
  expandedRow: { flexDirection: "row", gap: 12 },
  expandedLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#618980",
    letterSpacing: 1,
    marginBottom: 4,
  },
  expandedName: { fontSize: 13, fontWeight: "600", color: "#111816" },
  expandedAddr: { fontSize: 11, color: "#618980", marginTop: 2 },
  phoneLink: {
    fontSize: 11,
    color: "#13ECB9",
    fontWeight: "500",
    marginTop: 4,
  },

  // Items
  itemsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#DBE6E3",
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBE6E3",
  },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F6F8F8",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    justifyContent: "center",
    alignItems: "center",
  },
  itemName: { fontSize: 13, fontWeight: "500", color: "#111816" },
  itemMeta: { fontSize: 11, color: "#618980" },
  itemPrice: { fontSize: 13, fontWeight: "700", color: "#111816" },

  // Breakdown
  breakdownCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    padding: 12,
    gap: 8,
  },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownKey: { fontSize: 13, color: "#618980" },
  breakdownVal: { fontSize: 13, fontWeight: "500", color: "#111816" },
  breakdownKeyBold: { fontSize: 13, fontWeight: "700", color: "#111816" },
  breakdownValBold: { fontSize: 13, fontWeight: "700", color: "#111816" },
  breakdownDivider: { height: 1, backgroundColor: "#DBE6E3" },

  // Timestamp
  timestampCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timestampText: { fontSize: 11, color: "#618980" },
});
