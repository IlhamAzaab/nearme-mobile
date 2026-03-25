import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
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
import DriverScreenHeader from "../../components/driver/DriverScreenHeader";
import { API_URL } from "../../config/env";

export default function DriverDepositsScreen({ navigation }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [bRes, hRes] = await Promise.all([
        fetch(`${API_URL}/driver/deposits/balance`, { headers }),
        fetch(`${API_URL}/driver/deposits/history`, { headers }),
      ]);
      const bData = await bRes.json();
      if (bData.success) setBalance(bData.balance || {});
      const hData = await hRes.json();
      if (hData.success) setHistory(hData.deposits || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 60 seconds (was 30s), only when screen is focused
    const interval = setInterval(() => {
      if (isFocusedRef.current) fetchData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pickProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant media library permission");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProofFile(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Alert.alert("Error", "Please enter a valid amount");
    }
    if (!proofFile)
      return Alert.alert("Error", "Please attach proof of payment");
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
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
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Deposit submitted successfully!");
        setShowModal(false);
        setAmount("");
        setProofFile(null);
        fetchData();
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

  if (loading)
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator
          size="large"
          color="#06C168"
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.container}>
      <DriverScreenHeader
        title="Remittance History"
        rightIcon="refresh"
        onBackPress={() => navigation.goBack()}
        onRightPress={() => {
          setRefreshing(true);
          fetchData();
        }}
      />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            colors={["#06C168"]}
          />
        }
      >
        {/* Balance Card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Pending Deposit (Owed to Manager)</Text>
          <Text style={s.balanceAmount}>
            ?{Number(balance?.pending_deposit || 0).toFixed(2)}
          </Text>
          <Text style={s.balanceSubtext}>LKR</Text>

          {/* In Process & Available Breakdown */}
          <View style={s.breakdownBox}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>In Process:</Text>
              <Text style={s.breakdownAmount}>
                ?
                {history
                  .filter((d) => d.status === "pending")
                  .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                  .toFixed(2)}
              </Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Available to Submit:</Text>
              <Text style={s.breakdownAmount}>
                ?
                {(
                  Number(balance?.pending_deposit || 0) -
                  history
                    .filter((d) => d.status === "pending")
                    .reduce((sum, d) => sum + Number(d.amount || 0), 0)
                ).toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Status */}
          <View style={s.statusSection}>
            <Text style={s.statusText}>
              {history.filter((d) => d.status === "pending").length} transfer(s)
              in process
            </Text>
            <Text style={s.statusSubtext}>Waiting for manager approval</Text>
          </View>

          {/* New Transfer Button */}
          <TouchableOpacity
            style={s.newTransferBtn}
            onPress={() => setShowModal(true)}
          >
            <Text style={s.newTransferBtnText}>+ New Transfer</Text>
          </TouchableOpacity>
        </View>

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
                    ?{Number(item.amount).toFixed(2)}
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
                    <Text style={s.modalClose}>?</Text>
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
                      ?{Number(balance?.pending_deposit || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.infoRow}>
                    <Text style={[s.infoLabel, { color: "#ca8a04" }]}>
                      In Process:
                    </Text>
                    <Text style={[s.infoValue, { color: "#ca8a04" }]}>
                      ?
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
                      ?
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
  scroll: { padding: 16, paddingBottom: 40 },
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
    color: "#618968",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: "800",
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
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  newTransferBtnText: {
    fontSize: 15,
    fontWeight: "700",
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
