import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OptimizedImage from "../../../components/common/OptimizedImage";
import { API_URL } from "../../../config/env";

const ProcessDriverPaymentScreen = ({ navigation, route }) => {
  const { driverId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [driver, setDriver] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchDriver = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [driverRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/manager/driver-payments/driver/${driverId}`, {
          headers,
        }),
        fetch(`${API_URL}/manager/driver-payments/driver/${driverId}/history`, {
          headers,
        }),
      ]);
      const driverData = await driverRes.json();
      const historyData = await historyRes.json();
      if (driverData.success) setDriver(driverData.driver);
      if (historyData.success) setHistory(historyData.payments || []);
    } catch (err) {
      console.error("Failed to fetch driver:", err);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const picked = result.assets[0];
        if (picked.size > 5 * 1024 * 1024) {
          Alert.alert("Error", "File size must be less than 5MB");
          return;
        }
        setFile(picked);
      }
    } catch (err) {
      console.error("File pick error:", err);
    }
  };

  const handleMaxAmount = () => {
    if (driver) setAmount(driver.withdrawal_balance.toFixed(2));
  };

  const handleSubmit = async () => {
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (payAmount > (driver?.withdrawal_balance || 0)) {
      Alert.alert(
        "Error",
        `Amount exceeds available balance of Rs.${driver.withdrawal_balance.toFixed(2)}`,
      );
      return;
    }
    if (!file) {
      Alert.alert("Error", "Please upload a payment receipt");
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();
      formData.append("amount", payAmount.toString());
      formData.append("proof", {
        uri: file.uri,
        type: file.mimeType || "image/jpeg",
        name: file.name || "receipt.jpg",
      });
      if (note) formData.append("note", note);

      const res = await fetch(
        `${API_URL}/manager/driver-payments/pay/${driverId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", data.message);
        setDriver((prev) => ({
          ...prev,
          withdrawal_balance: data.new_withdrawal_balance,
          total_paid: (prev.total_paid || 0) + payAmount,
        }));
        setAmount("");
        setNote("");
        setFile(null);
        fetchDriver();
      } else {
        Alert.alert("Error", data.message || "Payment failed");
      }
    } catch (err) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <Ionicons name="person-outline" size={48} color="#D1D5DB" />
          <Text style={{ color: "#6B7280", marginTop: 8 }}>
            Driver not found
          </Text>
          <TouchableOpacity
            style={styles.goBackBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Driver Profile */}
          <View style={styles.profileWrap}>
            <View style={styles.avatarWrap}>
              {driver.profile_photo_url ? (
                <OptimizedImage
                  uri={driver.profile_photo_url}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(driver.full_name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {driver.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.profileName}>
              {driver.full_name || "Unknown Driver"}
            </Text>
            <Text style={styles.profileId}>
              ID: #{(driver.id || "").substring(0, 8).toUpperCase()}
            </Text>
            {driver.is_verified && (
              <View style={styles.verifiedTag}>
                <Text style={styles.verifiedTagText}>Verified Partner</Text>
              </View>
            )}
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Current Available Balance</Text>
            <Text style={styles.balanceValue}>
              Rs.{driver.withdrawal_balance?.toFixed(2)}
            </Text>
          </View>

          {/* Earnings Breakdown */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownLabel}>TOTAL EARNINGS</Text>
              <Text style={styles.breakdownValue}>
                Rs.{driver.total_earnings?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownLabel}>TOTAL PAID</Text>
              <Text style={[styles.breakdownValue, { color: "#06C168" }]}>
                Rs.{driver.total_paid?.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>ENTER AMOUNT TO TRANSFER</Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={styles.maxBtn}>MAX AMOUNT</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.amountInputWrap}>
              <Ionicons
                name="swap-horizontal-outline"
                size={18}
                color="#6B7280"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(t) => {
                  setAmount(t);
                }}
                placeholder="0.00"
                placeholderTextColor="rgba(97,137,128,0.4)"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Upload Receipt */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>UPLOAD PAYMENT RECEIPT</Text>
            {!file ? (
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={handlePickFile}
                activeOpacity={0.7}
              >
                <View style={styles.uploadIcon}>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={24}
                    color="#13ECB9"
                  />
                </View>
                <Text style={styles.uploadText}>
                  Tap to upload transfer confirmation
                </Text>
                <Text style={styles.uploadHint}>PDF, JPG or PNG (Max 5MB)</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.filePreviewCard}>
                <View style={styles.fileRow}>
                  {file.mimeType?.startsWith("image/") ? (
                    <OptimizedImage uri={file.uri} style={styles.fileThumb} />
                  ) : (
                    <View
                      style={[
                        styles.fileThumb,
                        {
                          backgroundColor: "#FEF2F2",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={24}
                        color="#EF4444"
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setFile(null)}>
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Note */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g., Bank transfer ref #12345"
              placeholderTextColor="rgba(97,137,128,0.4)"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (submitting || !amount || !file) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !amount || !file}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#111816" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Payment</Text>
            )}
          </TouchableOpacity>

          {/* Payment History */}
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowHistory(!showHistory)}
            activeOpacity={0.7}
          >
            <View style={styles.historyToggleLeft}>
              <Ionicons name="time-outline" size={16} color="#13ECB9" />
              <Text style={styles.historyToggleText}>
                Payment History ({history.length})
              </Text>
            </View>
            <Ionicons
              name={showHistory ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showHistory && (
            <View style={styles.historyList}>
              {history.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Ionicons name="receipt-outline" size={28} color="#D1D5DB" />
                  <Text
                    style={{ color: "#6B7280", fontSize: 12, marginTop: 6 }}
                  >
                    No payment history yet
                  </Text>
                </View>
              ) : (
                history.map((payment) => (
                  <View key={payment.id} style={styles.historyCard}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyIconWrap}>
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#06C168"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyAmount}>
                          Rs.{parseFloat(payment.amount).toFixed(2)}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(payment.created_at).toLocaleDateString(
                            "en-LK",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </Text>
                      </View>
                      {payment.proof_url && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(payment.proof_url)}
                        >
                          <Ionicons
                            name="receipt-outline"
                            size={18}
                            color="#6B7280"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    {payment.note && (
                      <Text style={styles.historyNote}>{payment.note}</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },
  goBackBtn: {
    marginTop: 16,
    backgroundColor: "#13ECB9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  goBackText: { fontWeight: "700", color: "#111816", fontSize: 13 },

  /* Profile */
  profileWrap: { alignItems: "center", marginBottom: 16 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#DBE6E3",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(19,236,185,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#DBE6E3",
  },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#13ECB9" },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#06C168",
    borderRadius: 10,
    padding: 3,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111816",
    marginTop: 10,
  },
  profileId: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  verifiedTag: {
    marginTop: 6,
    backgroundColor: "#EDFBF2",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Balance */
  balanceCard: {
    backgroundColor: "#E8FDF6",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#B8E8D9",
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#618980",
    marginBottom: 4,
  },
  balanceValue: { fontSize: 28, fontWeight: "800", color: "#111816" },

  breakdownRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  breakdownCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
  },
  breakdownLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111816",
    marginTop: 4,
  },

  /* Fields */
  fieldGroup: { marginBottom: 14 },
  fieldHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111816",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  maxBtn: {
    fontSize: 10,
    fontWeight: "700",
    color: "#13ECB9",
    textTransform: "uppercase",
  },

  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amountInput: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111816" },

  /* Upload */
  uploadArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#DBE6E3",
    borderRadius: 20,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(19,236,185,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  uploadText: { fontSize: 13, fontWeight: "500", color: "#111816" },
  uploadHint: { fontSize: 11, color: "#618980", marginTop: 4 },

  filePreviewCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    borderRadius: 20,
    padding: 14,
  },
  fileRow: { flexDirection: "row", alignItems: "center" },
  fileThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE6E3",
  },
  fileName: { fontSize: 12, fontWeight: "600", color: "#111816" },
  fileSize: { fontSize: 10, color: "#618980", marginTop: 2 },

  noteInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DBE6E3",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#111816",
  },

  submitBtn: {
    backgroundColor: "#13ECB9",
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: "#E5E7EB" },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#111816" },

  /* History */
  historyToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  historyToggleLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyToggleText: { fontSize: 13, fontWeight: "700", color: "#111816" },

  historyList: { marginTop: 4 },
  historyEmpty: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    padding: 20,
    alignItems: "center",
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DBE6E3",
    padding: 12,
    marginBottom: 8,
  },
  historyRow: { flexDirection: "row", alignItems: "center" },
  historyIconWrap: { marginRight: 10 },
  historyAmount: { fontSize: 13, fontWeight: "700", color: "#111816" },
  historyDate: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  historyNote: {
    fontSize: 11,
    color: "#618980",
    marginTop: 6,
    marginLeft: 28,
    fontStyle: "italic",
  },
});

export default ProcessDriverPaymentScreen;
