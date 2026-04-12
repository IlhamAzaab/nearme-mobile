import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SRI_LANKA_TIME_ZONE = "Asia/Colombo";

const VerifyDepositScreen = ({ navigation, route }) => {
  const { depositId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deposit, setDeposit] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDeposit();
  }, [depositId]);

  const fetchDeposit = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/driver/deposits/manager/deposit/${depositId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setDeposit(data.deposit);
        setApprovedAmount(data.deposit.amount.toString());
      } else {
        setError(data.message || "Failed to fetch deposit");
      }
    } catch (err) {
      console.error("Failed to fetch deposit:", err);
      setError("Failed to load deposit details");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvedAmount || parseFloat(approvedAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid approved amount");
      return;
    }

    if (parseFloat(approvedAmount) > deposit.driver_pending_balance) {
      Alert.alert(
        "Warning",
        `The approved amount (Rs.${approvedAmount}) exceeds the driver's pending balance (Rs.${deposit.driver_pending_balance.toFixed(2)}). Continue anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => submitApprove() },
        ],
      );
      return;
    }

    submitApprove();
  };

  const submitApprove = async () => {
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/driver/deposits/manager/review/${depositId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "approve",
            approved_amount: parseFloat(approvedAmount),
            review_note: reviewNote || null,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Deposit approved successfully!", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to approve deposit");
      }
    } catch (err) {
      console.error("Approve error:", err);
      Alert.alert("Error", "Failed to approve deposit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    Alert.alert("Confirm", "Are you sure you want to reject this deposit?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: submitReject },
    ]);
  };

  const submitReject = async () => {
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/driver/deposits/manager/review/${depositId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "reject",
            review_note: reviewNote || "Rejected by manager",
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Deposit rejected", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to reject deposit");
      }
    } catch (err) {
      console.error("Reject error:", err);
      Alert.alert("Error", "Failed to reject deposit");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: SRI_LANKA_TIME_ZONE,
    });
  };

  const transferId = String(deposit?.id || "-")
    .substring(0, 12)
    .toUpperCase();

  const getDriverInitials = (name) => {
    if (!name) return "DR";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isPdf =
    deposit?.proof_type === "pdf" || deposit?.proof_url?.includes(".pdf");

  const getPreviewUrl = () => {
    if (!deposit?.proof_url) return "";
    if (isPdf && deposit.proof_url.includes("cloudinary.com")) {
      let url = deposit.proof_url;
      if (url.includes("/raw/upload/"))
        url = url.replace("/raw/upload/", "/image/upload/");
      return url.replace("/upload/", "/upload/pg_1/").replace(".pdf", ".jpg");
    }
    return deposit.proof_url;
  };

  const openProof = () => {
    if (deposit?.proof_url) Linking.openURL(deposit.proof_url);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
          <Text style={styles.loadingText}>Loading deposit...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !deposit) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>{error || "Deposit not found"}</Text>
          <TouchableOpacity
            style={styles.goBackBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const amountDiffers =
    approvedAmount && parseFloat(approvedAmount) !== parseFloat(deposit.amount);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Receipt Preview */}
        <View style={styles.section}>
          <View style={styles.receiptHeader}>
            <Text style={styles.sectionLabel}>DRIVER UPLOADED RECEIPT</Text>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setShowImageModal(true)}
            >
              <Ionicons name="search-outline" size={14} color="#13ECB9" />
              <Text style={styles.zoomBtnText}>Tap to Zoom</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.receiptContainer}
            onPress={() => setShowImageModal(true)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: getPreviewUrl() }}
              style={styles.receiptImage}
              resizeMode="cover"
            />
            <View style={styles.receiptBadge}>
              <Ionicons
                name={isPdf ? "document-outline" : "image-outline"}
                size={14}
                color="#fff"
              />
              <Text style={styles.receiptBadgeText}>
                {isPdf ? "receipt.pdf" : "receipt.jpg"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Driver Info Card */}
        <View style={styles.section}>
          <View style={styles.driverCard}>
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getDriverInitials(deposit.driver?.full_name)}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={styles.driverName}>
                    {deposit.driver?.full_name || "Driver"}
                  </Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>PENDING</Text>
                  </View>
                </View>
                <Text style={styles.driverPhone}>
                  {deposit.driver?.phone || "No phone"}
                </Text>
              </View>
            </View>

            {/* Info grid row 1 */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>REPORTED AMOUNT</Text>
                <Text style={styles.infoValueLarge}>
                  {formatCurrency(deposit.amount)}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>DEPOSIT DATE</Text>
                <Text style={styles.infoValueSmall}>
                  {formatDateTime(deposit.created_at)}
                </Text>
              </View>
            </View>

            {/* Info grid row 2 */}
            <View style={[styles.infoGrid, { marginTop: 16 }]}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>DRIVER'S PENDING BALANCE</Text>
                <Text style={[styles.infoValueLarge, { color: "#D97706" }]}>
                  {formatCurrency(deposit.driver_pending_balance)}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>COLLECTION DATE</Text>
                <Text style={styles.infoValueSmall}>
                  {deposit.collection_date || "-"}
                </Text>
              </View>
            </View>

            <View style={styles.transferRow}>
              <Text style={styles.infoLabel}>TRANSFER ID</Text>
              <Text style={styles.transferIdValue}>{transferId}</Text>
            </View>
          </View>
        </View>

        {/* Verification Form */}
        <View style={styles.section}>
          {/* Verified Amount */}
          <Text style={styles.fieldLabel}>Type Verified Amount</Text>
          <View style={styles.amountInputWrapper}>
            <Text style={styles.amountPrefix}>Rs.</Text>
            <TextInput
              style={styles.amountInput}
              value={approvedAmount}
              onChangeText={setApprovedAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
            />
          </View>
          <View style={styles.hintRow}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#94A3B8"
            />
            <Text style={styles.hintText}>
              Enter the exact amount shown on the physical receipt. This amount
              will be deducted from the driver's pending balance.
            </Text>
          </View>
          {amountDiffers && (
            <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={14} color="#D97706" />
              <Text style={styles.warningText}>
                Amount differs from driver's reported amount (
                {formatCurrency(deposit.amount)})
              </Text>
            </View>
          )}

          {/* Review Note */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
            Manager's Internal Note
          </Text>
          <TextInput
            style={styles.noteInput}
            value={reviewNote}
            onChangeText={setReviewNote}
            placeholder="Optional: Reason for discrepancies or audit notes..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Spacer for bottom buttons */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.approveBtn,
            (submitting || !approvedAmount) && styles.btnDisabled,
          ]}
          onPress={handleApprove}
          disabled={submitting || !approvedAmount}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#111816" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#111816" />
              <Text style={styles.approveBtnText}>Approve & Mark as Paid</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rejectBtn, submitting && styles.btnDisabled]}
          onPress={handleReject}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
          <Text style={styles.rejectBtnText}>Reject Deposit</Text>
        </TouchableOpacity>
      </View>

      {/* Image Modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {isPdf && (
            <TouchableOpacity style={styles.modalOpenPdf} onPress={openProof}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.modalOpenPdfText}>Open Original PDF</Text>
            </TouchableOpacity>
          )}
          <Image
            source={{ uri: getPreviewUrl() }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748B" },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
    textAlign: "center",
  },
  goBackBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#13ECB9",
    borderRadius: 12,
  },
  goBackBtnText: { color: "#111816", fontWeight: "600", fontSize: 14 },

  scroll: { paddingBottom: 20 },
  section: { paddingHorizontal: 16, marginBottom: 16 },

  // Receipt
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  zoomBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  zoomBtnText: { fontSize: 13, fontWeight: "600", color: "#13ECB9" },
  receiptContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  receiptImage: { width: "100%", height: "100%" },
  receiptBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  receiptBadgeText: { color: "#fff", fontSize: 11, fontWeight: "500" },

  // Driver card
  driverCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(19,236,185,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(19,236,185,0.2)",
  },
  avatarText: { color: "#13ECB9", fontWeight: "700", fontSize: 16 },
  driverInfo: { flex: 1 },
  driverNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  driverName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: { fontSize: 9, fontWeight: "800", color: "#B45309" },
  driverPhone: { fontSize: 13, color: "#64748B", marginTop: 2 },

  infoGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  infoItem: { flex: 1 },
  infoLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValueLarge: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  infoValueSmall: { fontSize: 13, fontWeight: "500", color: "#334155" },
  transferRow: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 16,
    paddingTop: 12,
  },
  transferIdValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  // Form
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  amountInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  amountPrefix: {
    color: "#94A3B8",
    fontWeight: "500",
    fontSize: 15,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 8,
  },
  hintText: { flex: 1, fontSize: 11, color: "#94A3B8", lineHeight: 16 },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  warningText: { flex: 1, fontSize: 11, color: "#D97706", fontWeight: "500" },
  noteInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 80,
  },

  // Bottom actions
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  approveBtn: {
    backgroundColor: "#13ECB9",
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  approveBtnText: { color: "#111816", fontWeight: "700", fontSize: 15 },
  rejectBtn: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  rejectBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  modalOpenPdf: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
  },
  modalOpenPdfText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  modalImage: { width: SCREEN_WIDTH - 32, height: "70%" },
});

export default VerifyDepositScreen;
