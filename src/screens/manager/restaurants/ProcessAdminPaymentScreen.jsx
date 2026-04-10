import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../../config/env";

const parseStoredLocalDate = (dateStr) => {
  if (!dateStr) return null;

  const matched = String(dateStr).match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/,
  );

  if (matched) {
    return new Date(`${matched[1]}T${matched[2]}`);
  }

  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const ProcessAdminPaymentScreen = ({ navigation, route }) => {
  const { restaurantId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchRestaurant = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [restaurantRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/manager/admin-payments/restaurant/${restaurantId}`, {
          headers,
        }),
        fetch(
          `${API_URL}/manager/admin-payments/restaurant/${restaurantId}/history`,
          { headers },
        ),
      ]);

      const restaurantData = await restaurantRes.json();
      const historyData = await historyRes.json();

      if (restaurantData.success) setRestaurant(restaurantData.restaurant);
      if (historyData.success) setHistory(historyData.payments || []);
    } catch (err) {
      console.error("Failed to fetch restaurant:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  const handleFilePick = async () => {
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
    } catch (e) {
      console.error("File pick error", e);
    }
  };

  const handleMaxAmount = () => {
    if (restaurant) setAmount(restaurant.withdrawal_balance.toFixed(2));
  };

  const getReceiptImageUrl = (proofUrl, proofType) => {
    if (!proofUrl) return "";

    const isPdfProof = proofType === "pdf" || /\.pdf(\?|$)/i.test(proofUrl);
    if (!isPdfProof) return proofUrl;

    let imageUrl = proofUrl;
    if (imageUrl.includes("/raw/upload/")) {
      imageUrl = imageUrl.replace("/raw/upload/", "/image/upload/");
    }
    if (imageUrl.includes("/upload/")) {
      imageUrl = imageUrl.replace("/upload/", "/upload/f_jpg,pg_1,q_auto/");
    }
    if (!/\.pdf(\?|$)/i.test(imageUrl)) {
      imageUrl = `${imageUrl}.pdf`;
    }

    return imageUrl;
  };

  const formatSriLankaDateTime = (dateStr) => {
    const localDate = parseStoredLocalDate(dateStr);
    if (!localDate) return "-";

    return localDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTransferId = (id) => {
    if (!id) return "-";
    return String(id).substring(0, 12).toUpperCase();
  };

  const handleSubmit = async () => {
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (payAmount > (restaurant?.withdrawal_balance || 0)) {
      Alert.alert(
        "Error",
        `Amount exceeds available balance of Rs.${restaurant.withdrawal_balance.toFixed(2)}`,
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
        type: file.mimeType || "application/octet-stream",
        name: file.name || "receipt",
      });
      if (note) formData.append("note", note);

      const res = await fetch(
        `${API_URL}/manager/admin-payments/pay/${restaurantId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const data = await res.json();

      if (data.success) {
        Alert.alert("Success", data.message || "Payment processed");
        setRestaurant((prev) => ({
          ...prev,
          withdrawal_balance: data.new_withdrawal_balance,
          total_paid: (prev.total_paid || 0) + payAmount,
        }));
        setAmount("");
        setNote("");
        setFile(null);
        fetchRestaurant();
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
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={64} color="#9CA3AF" />
          <Text style={{ color: "#9CA3AF", marginTop: 8 }}>
            Restaurant not found
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
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Restaurant Profile */}
        <View style={styles.profileCard}>
          {restaurant.logo_url ? (
            <Image source={{ uri: restaurant.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>
                {(restaurant.name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.restName}>
            {restaurant.name || "Unknown Restaurant"}
          </Text>
          <Text style={styles.restEmail}>
            {restaurant.admin_email || "No admin email"}
          </Text>
          <Text style={styles.restPhone}>{restaurant.phone || "No phone"}</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Amount to Pay</Text>
          <Text style={styles.balanceAmount}>
            Rs.{restaurant.withdrawal_balance?.toFixed(2)}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={styles.statValue}>
              Rs.{restaurant.total_earnings?.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Paid</Text>
            <Text style={styles.statValue}>
              Rs.{restaurant.total_paid?.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{restaurant.order_count || 0}</Text>
        </View>

        {/* Payment Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Payment Details</Text>

          <Text style={styles.fieldLabel}>Payment Amount (Rs.)</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.maxBtn} onPress={handleMaxAmount}>
              <Text style={styles.maxBtnText}>Max</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note about this payment..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Payment Receipt (Required)</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleFilePick}>
            <Ionicons name="cloud-upload-outline" size={20} color="#4F46E5" />
            <Text style={styles.uploadBtnText}>
              {file ? file.name : "Choose File"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.uploadHint}>
            JPEG, PNG, WebP, or PDF. Max 5MB (PDF saves as first-page image)
          </Text>

          {file && file.mimeType?.startsWith("image/") && (
            <Image source={{ uri: file.uri }} style={styles.previewImg} />
          )}
          {file && file.mimeType === "application/pdf" && (
            <View style={styles.pdfWrap}>
              <Ionicons name="document-text" size={28} color="#DC2626" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.pdfName}>{file.name}</Text>
                <Text style={styles.pdfSize}>
                  {(file.size / 1024).toFixed(2)} KB
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>
              {submitting ? "Processing..." : "Process Payment"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment History */}
        <View style={styles.historyCard}>
          <TouchableOpacity
            style={styles.historyHeader}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text style={styles.historyTitle}>
              Payment History ({history.length})
            </Text>
            <Ionicons
              name={showHistory ? "chevron-up" : "chevron-down"}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showHistory && (
            <View style={{ marginTop: 12 }}>
              {history.length === 0 ? (
                <Text style={styles.noHistory}>No payment history</Text>
              ) : (
                history.map((p) => (
                  <View key={p.id} style={styles.historyItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAmount}>
                        Rs.{parseFloat(p.amount).toFixed(2)}
                      </Text>
                      <Text style={styles.historyDate}>
                        {formatSriLankaDateTime(p.created_at)}
                      </Text>
                      <Text style={styles.historyTxnId}>
                        Transfer ID: {formatTransferId(p.id)}
                      </Text>
                      {p.note ? (
                        <Text style={styles.historyNote}>{p.note}</Text>
                      ) : null}
                    </View>
                    {p.proof_url && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            getReceiptImageUrl(p.proof_url, p.proof_type),
                          )
                        }
                      >
                        <Ionicons
                          name="eye-outline"
                          size={20}
                          color="#4F46E5"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  goBackText: { fontWeight: "700", color: "#111816" },

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    marginBottom: 12,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  logoText: { fontSize: 24, fontWeight: "700", color: "#2563EB" },
  restName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  restEmail: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  restPhone: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  balanceCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 12, fontWeight: "600", color: "#DC2626" },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#B91C1C",
    marginTop: 4,
  },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardFull: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#6B7280" },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },

  amountRow: { flexDirection: "row", gap: 8 },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  maxBtn: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
  },
  maxBtnText: { fontWeight: "600", color: "#374151", fontSize: 13 },

  noteInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#111827",
    minHeight: 70,
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderStyle: "dashed",
  },
  uploadBtnText: { fontSize: 13, color: "#4F46E5", fontWeight: "600" },
  uploadHint: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
  previewImg: { width: "100%", height: 160, borderRadius: 10, marginTop: 10 },
  pdfWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pdfName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  pdfSize: { fontSize: 10, color: "#9CA3AF" },

  submitBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  noHistory: {
    textAlign: "center",
    color: "#9CA3AF",
    paddingVertical: 16,
    fontSize: 13,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  historyAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  historyDate: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
  historyTxnId: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 3,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  historyNote: { fontSize: 11, color: "#6B7280", marginTop: 4 },
});

export default ProcessAdminPaymentScreen;
