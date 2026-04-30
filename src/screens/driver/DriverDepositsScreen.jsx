import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "@react-navigation/native";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import { DriverDashboardLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

export default function DriverDepositsScreen({ navigation }) {
  const { user } = useAuth();
  const userScope = String(user?.id || "anon");
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const depositsQueryKey = ["driver", userScope, "deposits", "overview"];

  const depositsQuery = useQuery({
    queryKey: depositsQueryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication session is unavailable");
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [bRes, hRes, mRes] = await Promise.all([
        fetch(`${API_URL}/driver/deposits/balance`, { headers }),
        fetch(`${API_URL}/driver/deposits/history`, { headers }),
        fetch(`${API_URL}/driver/deposits/manager-bank-details`, { headers }),
      ]);

      const [bData, hData, mData] = await Promise.all([
        bRes.json().catch(() => ({})),
        hRes.json().catch(() => ({})),
        mRes.json().catch(() => ({})),
      ]);

      if (bRes.status === 401 || bRes.status === 403) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      if (!bRes.ok) {
        throw new Error(bData?.message || "Failed to fetch deposit balance");
      }

      const normalizedBalance =
        bData?.balance || bData?.data?.balance || bData?.result?.balance || {};
      const normalizedHistory = Array.isArray(hData?.deposits)
        ? hData.deposits
        : Array.isArray(hData?.data?.deposits)
          ? hData.data.deposits
          : [];
      const normalizedManagerBank =
        mData?.bankDetails ||
        mData?.data?.bankDetails ||
        mData?.result?.bankDetails ||
        null;

      return {
        balance: normalizedBalance,
        history: normalizedHistory,
        managerBank: normalizedManagerBank,
      };
    },
    initialData: () => queryClient.getQueryData(depositsQueryKey),
    staleTime: 60 * 1000,
    refetchInterval: isFocused ? 60 * 1000 : false,
    placeholderData: (previousData) => previousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const balance = depositsQuery.data?.balance || {};
  const history = depositsQuery.data?.history || [];
  const managerBank = depositsQuery.data?.managerBank || null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKey,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const pickProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant media library permission");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const selectedAsset = result.assets?.[0];
    if (!selectedAsset) {
      Alert.alert("Error", "No image selected. Please try again.");
      return;
    }
    if (selectedAsset.type && selectedAsset.type !== "image") {
      Alert.alert("Invalid File", "Please select an image file only.");
      return;
    }
    setProofFile(selectedAsset);
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert("Error", "Please enter a valid amount");
    }
    if (!proofFile)
      return Alert.alert("Error", "Please attach proof of payment");
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert("Session issue", "Authentication session is unavailable.");
        return;
      }
      const formData = new FormData();
      formData.append("amount", String(amount));
      formData.append("proof", {
        uri: proofFile.uri,
        type: proofFile.mimeType || "image/jpeg",
        name: proofFile.fileName || "proof.jpg",
      });
      const res = await fetch(`${API_URL}/driver/deposits/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Deposit submitted successfully!");
        setShowModal(false);
        setAmount("");
        setProofFile(null);
        await queryClient.invalidateQueries({
          queryKey: depositsQueryKey,
        });
      } else {
        Alert.alert("Error", data.message || "Failed to submit deposit");
      }
    } catch (e) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColors = (status) => {
    switch (status) {
      case "approved":
        return { bg: "#dcfce7", text: "#06C168" };
      case "pending":
        return { bg: "#fef9c3", text: "#ca8a04" };
      case "rejected":
        return { bg: "#fee2e2", text: "#dc2626" };
      default:
        return { bg: "#f3f4f6", text: "#6b7280" };
    }
  };

  const loading = depositsQuery.isLoading && !depositsQuery.data;
  const queryErrorMessage = depositsQuery.isError
    ? depositsQuery.error?.message || "Unable to load deposits"
    : "";

  if (loading)
    return (
      <SafeAreaView style={s.container} edges={["left", "right", "top"]}>
        <DriverDashboardLoadingSkeleton />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.container} edges={["left", "right", "top"]}>
      <View style={{ flex: 1 }}>
        <View style={s.headerSection}>
          <DriverScreenHeader
            title="Deposit to Meezo"
            rightIcon="refresh"
            onBackPress={() => navigation.goBack()}
            onRightPress={onRefresh}
          />
        </View>
        <DriverScreenSection
          screenKey="DriverDeposits"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#06C168"]}
              />
            }
          >
            {queryErrorMessage ? (
              <View style={s.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={s.errorBannerText}>{queryErrorMessage}</Text>
              </View>
            ) : null}

            {/* Balance Card */}
            <View style={s.balanceCard}>
              <Text style={s.balanceLabel}>Pending Deposit</Text>
              <Text style={s.balanceAmount}>
                Rs {Number(balance?.pending_deposit || 0).toFixed(2)}
              </Text>

              {/* In Process & Available Breakdown */}
              <View style={s.breakdownBox}>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>In Process:</Text>
                  <Text style={s.breakdownAmount}>
                    Rs
                    {history
                      .filter((d) => d.status === "pending")
                      .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                      .toFixed(2)}
                  </Text>
                </View>
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Available to Submit:</Text>
                  <Text style={s.breakdownAmount}>
                    Rs
                    {(
                      Number(balance?.pending_deposit || 0) -
                      history
                        .filter((d) => d.status === "pending")
                        .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* New Transfer Button */}
              <TouchableOpacity
                style={s.newTransferBtn}
                onPress={() => setShowModal(true)}
              >
                <Text style={s.newTransferBtnText}>+ New Transfer</Text>
              </TouchableOpacity>
            </View>

            {managerBank ? (
              <View style={s.bankCard}>
                <View style={s.bankHeaderRow}>
                  <Ionicons name="menu" size={16} color="#2563eb" />
                  <Text style={s.bankHeaderTitle}>Deposit to This Account</Text>
                </View>

                <View style={s.bankBody}>
                  <View>
                    <Text style={s.bankLabel}>Account Number</Text>
                    <Text style={s.bankAccountNumber}>
                      {managerBank.account_number || "-"}
                    </Text>
                  </View>

                  <View style={s.bankDivider} />

                  <View style={s.bankGrid}>
                    <View style={s.bankCell}>
                      <Text style={s.bankLabel}>Account Holder</Text>
                      <Text style={s.bankValue}>
                        {managerBank.account_holder_name || "-"}
                      </Text>
                    </View>

                    <View style={s.bankCell}>
                      <Text style={s.bankLabel}>Bank Name</Text>
                      <Text style={s.bankValue}>
                        {managerBank.bank_name || "-"}
                      </Text>
                    </View>
                  </View>

                  {managerBank.branch_name ? (
                    <View style={s.bankBranchWrap}>
                      <Text style={s.bankLabel}>Branch</Text>
                      <Text style={s.bankValue}>{managerBank.branch_name}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* History */}
            <Text style={s.sectionTitle}>Recent Transfers</Text>
            {history.length === 0 ? (
              <View style={s.empty}>
                <Ionicons
                  name="document"
                  size={40}
                  color="#d1d5db"
                  style={{ marginBottom: 12 }}
                />
                <Text style={s.emptyText}>No transfer history</Text>
              </View>
            ) : (
              history.map((item) => {
                const sc = getStatusColors(item.status);
                return (
                  <View key={item.id} style={s.historyItem}>
                    <View style={[s.historyIcon, { backgroundColor: sc.bg }]}>
                      <Ionicons name="arrow-up" size={20} color="#fff" />
                    </View>
                    <View style={s.historyContent}>
                      <Text style={s.historyAmount}>
                        Rs {Number(item.amount).toFixed(2)}
                      </Text>
                      <Text style={s.historyDate}>
                        {new Date(item.created_at).toLocaleDateString()} at{" "}
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.statusText, { color: sc.text }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </DriverScreenSection>
      </View>

      {/* Submit Modal with Keyboard Handling */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.keyboardAvoidingView}
        >
          <TouchableOpacity
            style={s.modalOverlay}
            onPress={() => setShowModal(false)}
            activeOpacity={1}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={s.modalCard}
            >
              <ScrollView
                contentContainerStyle={s.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Header */}
                <View style={s.modalHeader}>
                  <View>
                    <Text style={s.modalTitle}>Submit Bank Transfer</Text>
                    <Text style={s.modalSub}>Transfer Amount (LKR)</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowModal(false);
                      setAmount("");
                      setProofFile(null);
                    }}
                  >
                    <Text style={s.modalClose}>x</Text>
                  </TouchableOpacity>
                </View>

                {/* Amount Display */}
                <Text style={s.amountDisplay}>
                  {Number(amount || 0).toFixed(2)}
                </Text>

                {/* Breakdown Info */}
                <View style={s.infoBox}>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Total Owed:</Text>
                    <Text style={s.infoValue}>
                      Rs {Number(balance?.pending_deposit || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.infoRow}>
                    <Text style={[s.infoLabel, { color: "#ca8a04" }]}>
                      In Process:
                    </Text>
                    <Text style={[s.infoValue, { color: "#ca8a04" }]}>
                      Rs
                      {history
                        .filter((d) => d.status === "pending")
                        .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                        .toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.infoRow}>
                    <Text style={[s.infoLabel, { color: "#06C168" }]}>
                      Available to Submit:
                    </Text>
                    <Text style={[s.infoValue, { color: "#06C168" }]}>
                      Rs
                      {(
                        Number(balance?.pending_deposit || 0) -
                        history
                          .filter((d) => d.status === "pending")
                          .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                      ).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Input Field */}
                <Text style={s.label}>Amount (LKR)</Text>
                <TextInput
                  style={s.input}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />

                {/* Proof Upload */}
                <Text style={s.label}>Proof of Transfer *</Text>
                <TouchableOpacity style={s.filePickerBtn} onPress={pickProof}>
                  <Text style={s.filePickerPlaceholder}>
                    Upload screenshot or PDF
                  </Text>
                  <Ionicons
                    name="cloud-upload"
                    size={24}
                    color="#9ca3af"
                    style={{ marginLeft: 8 }}
                  />
                  {proofFile && (
                    <Text style={s.filePickerName}>
                      {proofFile.fileName || "File selected"}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[s.confirmBtn, submitting && s.confirmBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.confirmBtnText}>Submit Transfer</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerSection: {
    zIndex: 20,
    elevation: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  scroll: { padding: 16, paddingBottom: 40 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "600",
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#168C068",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 0,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: "600",
    color: "#111816",
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
    marginBottom: 16,
  },
  breakdownBox: {
    backgroundColor: "#fef9c3",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#ca8a04",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "600",
  },
  breakdownAmount: {
    fontSize: 13,
    color: "#b45309",
    fontWeight: "700",
  },
  statusSection: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111816",
  },
  statusSubtext: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  newTransferBtn: {
    backgroundColor: "#13ecb9",
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  newTransferBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111816",
  },
  bankCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    overflow: "hidden",
    backgroundColor: "#eff6ff",
    marginBottom: 16,
  },
  bankHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#dbeafe",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe",
  },
  bankHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  bankBody: {
    padding: 10,
    gap: 5,
  },
  bankDivider: {
    height: 1,
    backgroundColor: "#bfdbfe",
  },
  bankGrid: {
    flexDirection: "row",
    gap: 12,
  },
  bankCell: {
    flex: 1,
  },
  bankBranchWrap: {
    marginTop: 2,
  },
  bankLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#3b82f6",
    marginBottom: 2,
  },
  bankAccountNumber: {
    fontSize: 31,
    fontWeight: "700",
    color: "#111816",
    letterSpacing: 0.8,
  },
  bankValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111816",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111816",
    marginBottom: 12,
  },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#6b7280" },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  historyIconText: {
    fontSize: 20,
  },
  historyContent: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111816",
  },
  historyDate: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  // Modal Styles
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalContent: {
    padding: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111816",
    marginBottom: 2,
  },
  modalSub: {
    fontSize: 13,
    color: "#6b7280",
  },
  modalClose: {
    fontSize: 24,
    fontWeight: "600",
    color: "#6b7280",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  amountDisplay: {
    fontSize: 36,
    fontWeight: "800",
    color: "#111816",
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#111816",
    fontWeight: "700",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "700",
    color: "#111816",
    backgroundColor: "#EDFBF2",
    marginBottom: 20,
  },
  filePickerBtn: {
    borderWidth: 2,
    borderColor: "#dbe6dd",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    marginBottom: 20,
  },
  filePickerIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  filePickerPlaceholder: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  filePickerName: {
    fontSize: 12,
    color: "#13ecb9",
    fontWeight: "600",
    marginTop: 8,
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#13ecb9",
    alignItems: "center",
    marginTop: 8,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111816",
  },
});
