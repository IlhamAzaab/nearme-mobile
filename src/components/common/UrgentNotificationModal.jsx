/**
 * UrgentNotificationModal
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
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

const QUICK_REASONS = [
  "Food unavailable",
  "We are busy now. Please order in few minutes",
];

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
      .map((entry) => {
        const quantityMatch = entry.match(/^\s*(\d+)\s*x\s*/i);
        const parsedQuantity = quantityMatch
          ? Number.parseInt(quantityMatch[1], 10)
          : 1;
        const cleanedName = entry.replace(/^\s*\d+\s*x\s*/i, "").trim();

        return {
          quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 1,
          foodName: cleanedName || "Item",
          size: "regular",
          lineTotal: 0,
        };
      });
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
  // Default to first quick reason pre-selected
  const [selectedQuickReason, setSelectedQuickReason] = useState(QUICK_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
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
      setSelectedQuickReason(QUICK_REASONS[0]);
      setCustomReason("");
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

  // Dismiss: stop alarm + close (backdrop or X button)
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

  // The final reason used when submitting: custom text takes priority, else selected quick reason
  const finalRejectReason = customReason.trim() || selectedQuickReason || "";

  const handleSubmitReject = async () => {
    if (!finalRejectReason || submitting) return;
    setSubmitting(true);
    await onReject?.(data, finalRejectReason);
    setSubmitting(false);
  };

  const orderTitle =
    (typeof title === "string" ? title.trim() : "") || "New Order Arrived!";
  const waitingMinutes = Number(data?.waitingMinutes);
  const shouldShowWaitingTime =
    data?.type === "order_reminder" &&
    Number.isFinite(waitingMinutes) &&
    waitingMinutes > 0;

  const customerPhone = data?.customerPhone || data?.customer_phone || null;

  return (
    // Backdrop: full-screen pressable that dismisses the modal
    <Pressable style={styles.overlay} onPress={handleDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ width: "100%" }}
        // Stop backdrop tap from propagating through the card
      >
        <Pressable onPress={() => {}} style={styles.cardPressBlock}>
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
              },
            ]}
          >
            {/* X dismiss button — always visible */}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.dismissCircle}>
                <Text style={styles.dismissText}>✕</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {/* Smaller title */}
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

            {/* Bigger food items */}
            <ScrollView
              style={styles.itemsArea}
              contentContainerStyle={styles.itemsAreaContent}
              showsVerticalScrollIndicator={false}
            >
              {items.length > 0 ? (
                items.map((item, index) => {
                  const qty = Number(item.quantity || 1);
                  const sizeText =
                    item.size && item.size !== "regular"
                      ? ` (${item.size})`
                      : "";
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

              {shouldShowWaitingTime ? (
                <Text style={styles.waitingText}>Waiting {waitingMinutes} min</Text>
              ) : null}
            </ScrollView>

            {/* Customer phone row — only when phone is available */}
            {customerPhone ? (
              <TouchableOpacity
                style={styles.phoneRow}
                onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                activeOpacity={0.75}
              >
                <View style={styles.phoneIconWrap}>
                  <Text style={styles.phoneIcon}>📞</Text>
                </View>
                <Text style={styles.phoneNumber}>{customerPhone}</Text>
                <Text style={styles.phoneCallLabel}>Call</Text>
              </TouchableOpacity>
            ) : null}

            {showRejectInput ? (
              <View style={styles.reasonWrap}>
                <Text style={styles.reasonLabel}>Reason for rejection *</Text>

                {/* Quick-select chips — pre-selected first by default */}
                <View style={styles.chipsRow}>
                  {QUICK_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.chip,
                        selectedQuickReason === reason &&
                          !customReason.trim() &&
                          styles.chipSelected,
                      ]}
                      onPress={() => {
                        setSelectedQuickReason(reason);
                        setCustomReason(""); // clear manual text when chip selected
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedQuickReason === reason &&
                            !customReason.trim() &&
                            styles.chipTextSelected,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Manual text input (optional) */}
                <TextInput
                  style={styles.reasonInput}
                  value={customReason}
                  onChangeText={(text) => {
                    setCustomReason(text);
                    if (text.trim()) setSelectedQuickReason(null); // deselect chip when typing
                  }}
                  placeholder="Or type a custom reason..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setShowRejectInput(false);
                      setSelectedQuickReason(QUICK_REASONS[0]);
                      setCustomReason("");
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.rejectConfirmButton,
                      (!finalRejectReason || submitting) && styles.disabledButton,
                    ]}
                    onPress={handleSubmitReject}
                    activeOpacity={0.8}
                    disabled={!finalRejectReason || submitting}
                  >
                    <Text style={styles.rejectConfirmButtonText}>
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
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 9999,
    elevation: 9999,
  },
  cardPressBlock: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: Math.min(width - 20, 420),
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1.8,
    borderColor: "#06C168",
    paddingHorizontal: 14,
    paddingTop: 38, // extra top space for X button
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 16,
  },
  dismissButton: {
    position: "absolute",
    top: 8,
    right: 10,
    zIndex: 10,
  },
  dismissCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingRight: 4,
  },
  headerLeft: {
    flex: 1,
  },
  // Smaller title (was 22)
  titleText: {
    fontSize: 20,
    lineHeight: 20,
    color: "#111827",
    fontWeight: "800",
  },
  orderNoText: {
    marginTop: 3,
    color: "#06C168",
    fontSize: 14,
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
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "800",
    color: "#06C168",
  },
  itemsArea: {
    marginTop: 10,
    maxHeight: 160,
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
  // Bigger food text (was 13)
  itemText: {
    flex: 1,
    fontSize: 22,
    lineHeight: 22,
    color: "#111827",
    fontWeight: "700",
  },
  itemAmount: {
    fontSize: 15,
    color: "#06C168",
    fontWeight: "700",
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4b5563",
  },
  waitingText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
  },
  // Phone row — icon + number side by side, full row tappable
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    backgroundColor: "#E6F9F1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phoneIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneIcon: {
    fontSize: 14,
  },
  phoneNumber: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#15803d",
  },
  phoneCallLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#06C168",
  },
  reasonWrap: {
    marginTop: 10,
  },
  reasonLabel: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 8,
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  chipSelected: {
    backgroundColor: "#ecfdf5",
    borderColor: "#06C168",
  },
  chipText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#15803d",
    fontWeight: "700",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    minHeight: 60,
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
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minWidth: 80,
    borderRadius: 11,
    borderWidth: 1.4,
    borderColor: "#06C168",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: "#06C168",
    fontSize: 15,
    fontWeight: "700",
  },
  rejectConfirmButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 11,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  rejectConfirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.4,
  },
});
