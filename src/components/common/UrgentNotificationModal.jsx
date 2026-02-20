/**
 * UrgentNotificationModal
 *
 * Full-screen overlay for urgent notifications (new order / new delivery).
 * Shows Accept / Reject buttons. When Reject is tapped (for orders), an
 * inline reason input slides in so the admin can type a reason before
 * submitting — the reason is stored in the orders table.
 */

import { useEffect, useRef, useState } from "react";
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

export default function UrgentNotificationModal({
  visible,
  title,
  body,
  data,
  onAccept,
  onReject,
  onDismiss,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-400)).current;
  const pulseRef = useRef(null);

  // Rejection reason state (only used for new_order)
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset reject state each time modal opens
      setShowRejectInput(false);
      setRejectReason("");
      setSubmitting(false);

      // Start alarm sound (idempotent — no-op if already playing)
      alarmService.start();

      // Slide in from top
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();

      // Repeating vibration as tactile complement to the audio
      Vibration.vibrate([0, 500, 200, 500, 200, 500], true);

      return () => {
        pulseRef.current?.stop();
        Vibration.cancel();
        // Ensure alarm stops if modal unmounts before accept/reject
        alarmService.stop();
      };
    } else {
      slideAnim.setValue(-400);
      pulseRef.current?.stop();
      Vibration.cancel();
      // Safety net: ensure alarm is silenced whenever modal hides
      alarmService.stop();
    }
  }, [visible]);

  if (!visible) return null;

  const isNewOrder = data?.type === "new_order";
  const isNewDelivery = data?.type === "new_delivery";
  const hasTip = data?.tipAmount && parseFloat(data.tipAmount) > 0;

  const icon = isNewOrder ? "🔔" : isNewDelivery ? "🚗" : "📢";
  const accentColor = isNewOrder
    ? "#22c55e"
    : isNewDelivery
      ? "#3b82f6"
      : "#f59e0b";

  // ── Dismiss (X button) - stop alarm but leave order status unchanged ────
  const handleDismiss = () => {
    silenceAlarmNow();
    onDismiss?.();
  };

  // ── Shared: immediately silence alarm + vibration on any user action ────
  const silenceAlarmNow = () => {
    Vibration.cancel();
    alarmService.stop(); // fire-and-forget — stops audio immediately
  };

  // ── Reject button pressed ─────────────────────────────────────
  const handleRejectPress = () => {
    silenceAlarmNow();
    if (isNewOrder) {
      // Show inline reason input
      setShowRejectInput(true);
    } else {
      // Driver just dismisses — no reason needed
      onReject?.(data, null);
    }
  };

  // ── Submit rejection reason ───────────────────────────────────
  const handleSubmitReject = async () => {
    if (!rejectReason.trim() || submitting) return;
    silenceAlarmNow();
    setSubmitting(true);
    await onReject?.(data, rejectReason.trim());
    setSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
            borderColor: accentColor,
          },
        ]}
      >
        {/* X Dismiss Button */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissButtonText}>✕</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View
            style={[styles.iconCircle, { backgroundColor: accentColor + "20" }]}
          >
            <Text style={styles.icon}>{icon}</Text>
          </View>

          {/* Title & Body */}
          <Text style={styles.title}>{title || "Urgent Notification"}</Text>
          <Text style={styles.body}>{body || ""}</Text>

          {/* Food items list */}
          {isNewOrder && data?.itemsSummary ? (
            <View style={styles.itemsContainer}>
              <Text style={styles.itemsHeader}>🍽️ Items Ordered</Text>
              {data.itemsSummary.split(",").map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemBullet}>•</Text>
                  <Text style={styles.itemText}>{item.trim()}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Tip badge */}
          {hasTip && (
            <View style={[styles.tipBadge, { backgroundColor: "#f59e0b20" }]}>
              <Text style={styles.tipText}>
                💰 Tip: Rs. {parseFloat(data.tipAmount).toFixed(2)}
              </Text>
            </View>
          )}

          {/* ── Inline rejection reason ── */}
          {showRejectInput ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>
                Reason for rejection <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="e.g. Item not available, restaurant closed..."
                placeholderTextColor="#9ca3af"
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={3}
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelReasonButton]}
                  onPress={() => {
                    setShowRejectInput(false);
                    setRejectReason("");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelReasonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.submitRejectButton,
                    (!rejectReason.trim() || submitting) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleSubmitReject}
                  activeOpacity={0.7}
                  disabled={!rejectReason.trim() || submitting}
                >
                  <Text style={styles.submitRejectText}>
                    {submitting ? "Submitting..." : "Submit Rejection"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Accept / Reject buttons ── */
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={handleRejectPress}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectButtonText}>
                  {isNewOrder ? "✕ Reject" : "✕ Decline"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.acceptButton,
                  { backgroundColor: accentColor },
                ]}
                onPress={() => {
                  silenceAlarmNow();
                  onAccept?.(data);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.acceptButtonText}>
                  {isNewOrder ? "✓ Accept Order" : "✓ Accept"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 60,
    zIndex: 9999,
    elevation: 9999,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: width - 48,
    maxWidth: 420,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    maxHeight: "85%",
  },
  dismissButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  dismissButtonText: {
    fontSize: 18,
    color: "#6b7280",
    fontWeight: "600",
  },
  scrollContent: {
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 14,
  },
  itemsContainer: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  itemBullet: {
    fontSize: 14,
    color: "#6b7280",
    marginRight: 6,
    lineHeight: 20,
  },
  itemText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
    lineHeight: 20,
  },
  tipBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  tipText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f59e0b",
  },
  // ── Reason input ──────────────────────────────────────────────
  reasonBox: {
    width: "100%",
    marginTop: 4,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  required: { color: "#ef4444" },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1f2937",
    minHeight: 80,
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  cancelReasonButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  cancelReasonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  submitRejectButton: {
    backgroundColor: "#ef4444",
  },
  submitRejectText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  disabledButton: { opacity: 0.4 },
  // ── Action buttons ────────────────────────────────────────────
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
  },
  acceptButton: {
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
