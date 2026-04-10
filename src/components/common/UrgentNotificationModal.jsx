/**
 * UrgentNotificationModal
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import alarmService from "../../services/alarmService";

const { width } = Dimensions.get("window");

const parseAmount = (value) => {
  const num = Number.parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
};

const getOrderItems = (data) => {
  if (Array.isArray(data?.itemsDetails) && data.itemsDetails.length > 0) {
    return data.itemsDetails.map((item) => ({
      quantity: Number(item.quantity || 1),
      foodName: item.food_name || item.foodName || "Item",
      size: item.size || "regular",
      lineTotal: parseAmount(item.total_price ?? item.totalPrice),
    }));
  }

  if (typeof data?.itemsSummary === "string" && data.itemsSummary.trim()) {
    return data.itemsSummary
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((entry) => ({
        quantity: 1,
        foodName: entry,
        size: "regular",
        lineTotal: 0,
      }));
  }

  return [];
};

export default function UrgentNotificationModal({
  visible,
  title,
  body,
  data,
  onAccept,
  onReject,
  onDismiss,
}) {
  const slideAnim = useRef(new Animated.Value(-220)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef(null);

  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isNewOrder =
    data?.type === "new_order" || data?.type === "order_reminder";
  const items = useMemo(() => getOrderItems(data), [data]);

  const totalPrice = useMemo(() => {
    const directAmount = parseAmount(
      data?.restaurantTotal ?? data?.totalAmount ?? data?.restaurant_total,
    );
    if (directAmount > 0) return directAmount;

    const sum = items.reduce(
      (acc, item) => acc + parseAmount(item.lineTotal),
      0,
    );
    if (sum > 0) return sum;

    const amountFromBody = String(body || "").match(/Rs\.?\s*([\d,.]+)/i);
    if (amountFromBody?.[1]) {
      return parseAmount(amountFromBody[1].replace(/,/g, ""));
    }

    return 0;
  }, [body, data, items]);

  useEffect(() => {
    if (visible) {
      setShowRejectInput(false);
      setRejectReason("");
      setSubmitting(false);

      alarmService.start();

      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 62,
        useNativeDriver: true,
      }).start();

      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 620,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 620,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();

      Vibration.vibrate([0, 450, 220, 450], true);

      return () => {
        pulseRef.current?.stop();
        Vibration.cancel();
        alarmService.stop();
      };
    }

    slideAnim.setValue(-220);
    pulseRef.current?.stop();
    Vibration.cancel();
    alarmService.stop();
  }, [pulseAnim, slideAnim, visible]);

  if (!visible) return null;

  const silenceAlarmNow = () => {
    Vibration.cancel();
    alarmService.stop();
  };

  const handleDismiss = () => {
    silenceAlarmNow();
    onDismiss?.();
  };

  const handleRejectPress = () => {
    silenceAlarmNow();
    if (isNewOrder) {
      setShowRejectInput(true);
      return;
    }
    onReject?.(data, null);
  };

  const handleSubmitReject = async () => {
    if (!rejectReason.trim() || submitting) return;
    silenceAlarmNow();
    setSubmitting(true);
    await onReject?.(data, rejectReason.trim());
    setSubmitting(false);
  };

  const orderTitle =
    (typeof title === "string" ? title.trim() : "") || "New Order Arrived!";

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.75}
        >
          <Text style={styles.dismissText}>x</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.titleText}>{orderTitle}</Text>
            {data?.orderNumber ? (
              <Text style={styles.orderNoText}>#{data.orderNumber}</Text>
            ) : null}
          </View>

          <View style={styles.headerPriceWrap}>
            <Text style={styles.priceLabel}>PRICE</Text>
            <Text style={styles.priceValue}>Rs.{totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.itemsArea}
          contentContainerStyle={styles.itemsAreaContent}
          showsVerticalScrollIndicator={false}
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const qty = Number(item.quantity || 1);
              const sizeText =
                item.size && item.size !== "regular" ? ` (${item.size})` : "";
              return (
                <View key={`${item.foodName}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemText} numberOfLines={2}>
                    {qty}x {item.foodName}
                    {sizeText}
                  </Text>
                  {item.lineTotal > 0 ? (
                    <Text style={styles.itemAmount}>
                      Rs.{item.lineTotal.toFixed(2)}
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.bodyText}>
              {body || "You have a new order."}
            </Text>
          )}

          {data?.waitingMinutes ? (
            <Text style={styles.waitingText}>
              Waiting {Number(data.waitingMinutes)} min
            </Text>
          ) : null}
        </ScrollView>

        {showRejectInput ? (
          <View style={styles.reasonWrap}>
            <Text style={styles.reasonLabel}>Reason for rejection *</Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Out of stock, item unavailable..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              autoFocus
              textAlignVertical="top"
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowRejectInput(false);
                  setRejectReason("");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!rejectReason.trim() || submitting) && styles.disabledButton,
                ]}
                onPress={handleSubmitReject}
                activeOpacity={0.8}
                disabled={!rejectReason.trim() || submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? "Rejecting..." : "Confirm Reject"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                silenceAlarmNow();
                onAccept?.(data);
              }}
              activeOpacity={0.82}
            >
              <Text style={styles.primaryButtonText}>Accept Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRejectPress}
              activeOpacity={0.82}
            >
              <Text style={styles.secondaryButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    width: Math.min(width - 20, 420),
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1.8,
    borderColor: "#06C168",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 16,
  },
  dismissButton: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  dismissText: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingRight: 22,
  },
  headerLeft: {
    flex: 1,
  },
  titleText: {
    fontSize: 22,
    lineHeight: 25,
    color: "#111827",
    fontWeight: "800",
  },
  orderNoText: {
    marginTop: 3,
    color: "#06C168",
    fontSize: 13,
    fontWeight: "700",
  },
  headerPriceWrap: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: "700",
    color: "#9ca3af",
  },
  priceValue: {
    marginTop: 2,
    fontSize: 33,
    lineHeight: 34,
    fontWeight: "800",
    color: "#06C168",
  },
  itemsArea: {
    marginTop: 8,
    maxHeight: 150,
  },
  itemsAreaContent: {
    paddingRight: 3,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#4b5563",
    fontWeight: "500",
  },
  itemAmount: {
    fontSize: 13,
    color: "#06C168",
    fontWeight: "700",
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4b5563",
  },
  waitingText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
  },
  reasonWrap: {
    marginTop: 10,
  },
  reasonLabel: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 6,
    fontWeight: "600",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 9,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#06C168",
    borderRadius: 11,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minWidth: 92,
    borderRadius: 11,
    borderWidth: 1.4,
    borderColor: "#06C168",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    minHeight: 40,
  },
  secondaryButtonText: {
    color: "#06C168",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
